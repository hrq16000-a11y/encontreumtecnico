// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rangeMock, profilesMock, rpcMock } = vi.hoisted(() => ({
  rangeMock: vi.fn(),
  profilesMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params?: { secao?: string } }) => (
    <a href={"/admin/" + (params?.secao ?? "usuarios")}>{children}</a>
  ),
}));
vi.mock("@/components/admin-accounts-manager", () => ({
  AdminAccountsManager: ({ exactAccountId }: { exactAccountId?: string }) => <div data-testid="account-manager-stub">{exactAccountId}</div>,
}));
vi.mock("@/components/admin-technician-manager", () => ({
  AdminTechnicianManager: ({ selectedTechnicianId }: { selectedTechnicianId?: string }) =>
    <div data-testid="portal-editor-stub">{selectedTechnicianId}</div>,
}));
vi.mock("@/components/legacy-review-queue", () => ({
  LegacyReviewQueue: ({ exactRecord }: { exactRecord: { kind: string; id: number } }) =>
    <div data-testid="legacy-editor-stub">{exactRecord.kind}:{exactRecord.id}</div>,
}));
vi.mock("@/components/admin-technician-record-editor", () => ({
  AdminTechnicianRecordEditor: ({ existing, onSaved, onCancel }: {
    existing: { technician_id: string }; onSaved: (message: string) => void; onCancel: () => void;
  }) => <div data-testid="editor-exato">
    <span>{existing.technician_id}</span>
    <button onClick={() => onSaved("Ficha salva e conferida")}>Salvar ficha sintética</button>
    <button onClick={onCancel}>Cancelar ficha sintética</button>
  </div>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      if (table === "user_roles") {
        return { select: () => ({ eq: () => ({ order: () => ({ range: rangeMock }) }) }) };
      }
      if (table === "profiles") {
        return { select: () => ({ in: profilesMock }) };
      }
      throw new Error("Unexpected synthetic Supabase table: " + table);
    },
    rpc: rpcMock,
  },
}));

import { AdminUsersHub } from "./admin-users-hub";

type Role = { user_id: string; created_at: string };
type RoleResult = { data: Role[] | null; count: number | null; error: { message: string } | null };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const roles: Role[] = [
  { user_id: "11111111-1111-4111-8111-111111111111", created_at: "2026-11-01" },
  { user_id: "22222222-2222-4222-8222-222222222222", created_at: "2026-11-02" },
];

beforeEach(() => {
  rangeMock.mockReset();
  profilesMock.mockReset();
  rpcMock.mockReset();
  window.history.replaceState(null, "", "/admin/usuarios");
});
afterEach(cleanup);

describe("Painel 360° — recuperação funcional de Administradores", () => {
  it("tenta novamente sem trocar de aba, bloqueia durante loading e mantém a consulta unificada", async () => {
    const pendingRetry = deferred<RoleResult>();
    rangeMock
      .mockResolvedValueOnce({ data: null, count: null, error: { message: "falha sintética" } })
      .mockReturnValueOnce(pendingRetry.promise);
    profilesMock.mockResolvedValue({
      data: [
        { id: roles[0]!.user_id, full_name: "Administradora Sintética A", phone: "SENTINELA_PRIVADA" },
        { id: roles[1]!.user_id, full_name: "Administrador Sintético B", phone: "SENTINELA_PRIVADA" },
      ],
      error: null,
    });
    rpcMock.mockResolvedValue({
      data: { total: 0, items: [], has_more: false, next_cursor: null },
      error: null,
    });

    render(<AdminUsersHub adminOwnerId="admin-sintetico" />);
    fireEvent.click(screen.getByRole("tab", { name: "Admins" }));

    const retry = await screen.findByRole("button", { name: "Tentar novamente" });
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível consultar");
    expect(retry).toBeEnabled();
    fireEvent.click(retry);

    await waitFor(() => expect(rangeMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Atualizar lista" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Admins" })).toHaveAttribute("aria-selected", "true");

    await act(async () => {
      pendingRetry.resolve({ data: roles, count: 2, error: null });
    });
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Consultar conta" })).toHaveLength(2));
    expect(screen.getByText("Administradora Sintética A")).toBeInTheDocument();
    expect(screen.getByText("Administrador Sintético B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar lista" })).toBeEnabled();
    expect(screen.queryByText("SENTINELA_PRIVADA")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Clientes" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith(
      "eut_admin_users_unified_360",
      expect.objectContaining({ _role: "cliente", _limit: 30 }),
    ));
    expect(screen.getByRole("tab", { name: "Clientes" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Painel 360° — edição direta de registros administrativos", () => {
  const a = "33333333-3333-4333-8333-333333333333";
  const b = "44444444-4444-4444-8444-444444444444";
  const c = "55555555-5555-4555-8555-555555555555";
  const sameName = "Técnico Sintético Homônimo";
  const row = (id: string, extra = {}) => ({
    user_key: "registry:" + id, record_key: "registry:" + id,
    auth_user_id: null, name: sameName, roles: ["tecnico"], status: "ATIVO",
    linked_imports: [], ...extra,
  });
  const result = (items: unknown[]) => ({
    data: { total: items.length, items, has_more: false, next_cursor: null }, error: null,
  });
  const exactRow = (id: string) => ({
    technician_id: id, display_name: sameName, origin: "manual",
    source_id: "sintetico:" + id, updated_at: "2026-11-28T01:00:00Z", total_count: 2,
  });

  it("abre a ficha manual sem Auth nem vínculo importado, confirma UUID e atualiza a mesma consulta após salvar", async () => {
    const items = [
      row(a), row(b, { linked_imports: [{ record_key: "imported:" + c }] }),
      row(c, { record_key: "imported:" + c, user_key: "imported:" + c }),
    ];
    rpcMock.mockImplementation((name: string) => {
      if (name === "eut_admin_users_unified_360") return Promise.resolve(result(items));
      if (name === "eut_admin_technician_registry_list") return Promise.resolve({
        data: [exactRow(b), exactRow(a)], error: null,
      });
      throw new Error("RPC inesperada: " + name);
    });
    render(<AdminUsersHub adminOwnerId="admin-sintetico" />);
    const buttons = await screen.findAllByRole("button", { name: "Editar ficha" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);
    const editor = await screen.findByTestId("editor-exato");
    expect(editor).toHaveTextContent(a);
    expect(editor).not.toHaveTextContent(b);
    fireEvent.click(within(editor).getByRole("button", { name: "Salvar ficha sintética" }));
    expect(await screen.findByText("Ficha salva e conferida")).toBeInTheDocument();
    await waitFor(() => expect(rpcMock.mock.calls.filter(([name]) =>
      name === "eut_admin_users_unified_360")).toHaveLength(2));
    expect(screen.queryByTestId("editor-exato")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Todos" })).toHaveAttribute("aria-selected", "true");
  });

  it("não oferece edição direta de importado órfão, identidade divergente, cliente ou chave inválida", async () => {
    rpcMock.mockResolvedValue(result([
      row(a, { record_key: "imported:" + a, user_key: "imported:" + a }),
      row(b, { user_key: "account:" + b }),
      row(c, { roles: ["cliente"] }),
      row("invalido"),
    ]));
    render(<AdminUsersHub adminOwnerId="admin-sintetico" />);
    expect(await screen.findByText(/4 usuário\(s\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar ficha" })).not.toBeInTheDocument();
    expect(screen.getByText(/consulta é somente leitura/)).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("cancela a edição ao mudar o filtro e não reabre automaticamente a ficha", async () => {
    rpcMock.mockImplementation((name: string) => Promise.resolve(name === "eut_admin_users_unified_360"
      ? result([row(a)]) : { data: [exactRow(a)], error: null }));
    render(<AdminUsersHub adminOwnerId="admin-sintetico" />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar ficha" }));
    await screen.findByTestId("editor-exato");
    fireEvent.change(screen.getByRole("combobox", { name: "Situação" }), { target: { value: "ativo" } });
    expect(await screen.findByRole("button", { name: "Editar ficha" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("editor-exato")).not.toBeInTheDocument();
  });
});

describe("Painel 360° — gestão de identidade selecionada", () => {
  const accountId = "66666666-6666-4666-8666-666666666666";
  const portalId = "77777777-7777-4777-8777-777777777777";
  const customer = { user_key: "account:" + accountId, record_key: "account:" + accountId,
    auth_user_id: accountId, name: "Cliente sintético", roles: ["cliente"], status: "ATIVO" };
  const portal = { ...customer, record_key: "portal:" + portalId, name: "Técnico sintético", roles: ["tecnico"] };
  const legacy = { user_key: "wp:employer:321", record_key: "wp:employer:321", auth_user_id: null,
    name: "Contratante sintético", roles: ["cliente"], status: "ATIVO" };
  const page = (items: unknown[]) => ({ data: { total: items.length, items, next_cursor: null, has_more: false }, error: null });

  it("abre conta por UUID sem trocar a aba nem perder busca e situação; relê ao fechar", async () => {
    rpcMock.mockResolvedValue(page([customer]));
    render(<AdminUsersHub adminOwnerId="admin-sintetico" />);
    fireEvent.click(screen.getByRole("tab", { name: "Clientes" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Buscar usuário/ }), { target: { value: "Cliente" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Situação" }), { target: { value: "ativo" } });
    fireEvent.click(await screen.findByRole("button", { name: "Gerenciar conta" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("account-manager-stub")).toHaveTextContent(accountId);
    expect(window.location.search).toBe("?perfil=clientes");
    const before = rpcMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao diretório de usuários" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "Clientes" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: /Buscar usuário/ })).toHaveValue("Cliente");
    expect(screen.getByRole("combobox", { name: "Situação" })).toHaveValue("ativo");
    await waitFor(() => expect(rpcMock.mock.calls.length).toBeGreaterThan(before));
    expect(rpcMock).toHaveBeenLastCalledWith("eut_admin_users_unified_360",
      expect.objectContaining({ _role: "cliente", _search: "Cliente", _state: "ativo" }));
  });

  it("abre perfil operacional e contratante WordPress com IDs distintos, sem encaminhar pelo nome", async () => {
    rpcMock.mockResolvedValue(page([portal, legacy]));
    render(<AdminUsersHub adminOwnerId="admin-sintetico" />);
    fireEvent.click(await screen.findByRole("button", { name: "Gerenciar ficha técnica" }));
    expect(await screen.findByTestId("portal-editor-stub")).toHaveTextContent(portalId);
    fireEvent.click(await screen.findByRole("button", { name: "Voltar ao diretório de usuários" }));
    fireEvent.click(await screen.findByRole("button", { name: "Gerenciar ficha histórica" }));
    expect(await screen.findByTestId("legacy-editor-stub")).toHaveTextContent("employer:321");
    expect(window.location.pathname).toBe("/admin/usuarios");
  });

  it("não libera gestão com identificador de conta divergente ou perfil histórico inválido", async () => {
    rpcMock.mockResolvedValue(page([{...customer, user_key: "account:" + portalId},
      {...legacy, user_key: "wp:employer:invalid", record_key: "wp:employer:invalid"}]));
    render(<AdminUsersHub adminOwnerId="admin-sintetico" />);
    await screen.findByText("Cliente sintético");
    expect(screen.queryByRole("button", { name: "Gerenciar conta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Gerenciar ficha histórica" })).toBeNull();
  });
});
