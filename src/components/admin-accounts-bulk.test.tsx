// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mockDb = vi.hoisted(() => ({
  accounts: [] as Array<Record<string, unknown>>,
  actions: [] as Array<Record<string, unknown>>,
  checks: [] as string[],
  delayNextSnapshot: null as Promise<void> | null,
  persistAction: true,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "eut_admin_accounts_snapshot") {
        const pending = mockDb.delayNextSnapshot;
        mockDb.delayNextSnapshot = null;
        if (pending) await pending;
        const search = String(args["_search"] ?? "");
        const filter = String(args["_filter"] ?? "todos");
        const rows = mockDb.accounts.filter((row) =>
          (!search || String(row["id"]) === search || String(row["full_name"]).toLowerCase().includes(search.toLowerCase())) &&
          (filter !== "bloqueados" || row["blocked_account"] === true));
        if (search.includes("-")) mockDb.checks.push(search);
        const page = Number(args["_page"] ?? 0);
        return { data: {
          accounts: rows.slice(page * 20, (page + 1) * 20),
          total: rows.length, page, page_size: 20,
          audit: [], blocked_phones: [],
        }, error: null };
      }
      if (name === "eut_admin_contact_action") {
        mockDb.actions.push(args);
        const target = mockDb.accounts.find((row) => row["id"] === args["_user_id"]);
        if (!target) return { data: null, error: { message: "not_found" } };
        if (mockDb.persistAction) target["blocked_account"] = args["_action"] === "block_account";
        return { data: { ok: true, action: args["_action"] }, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
  },
}));

import { AdminAccountsManager } from "./admin-accounts-manager";

const account = (id: string, name: string, isAdmin = false, blocked = false) => ({
  id, full_name: name, masked_email: "a•••@example.test", masked_phone: null,
  email_confirmed: true, roles: isAdmin ? "admin" : "cliente", is_admin: isAdmin,
  is_client: !isAdmin, is_technician: false, technician_id: null,
  technician_status: null, blocked_account: blocked, blocked_phone: false,
  created_at: "2026-11-10T00:00:00Z",
});

beforeEach(() => {
  mockDb.accounts = [
    account("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", "Administrador", true),
    account("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb", "Cliente Um"),
    account("cccccccc-cccc-4ccc-cccc-cccccccccccc", "Cliente Dois"),
  ];
  mockDb.actions = [];
  mockDb.checks = [];
  mockDb.delayNextSnapshot = null;
  mockDb.persistAction = true;
  vi.spyOn(window, "confirm").mockReturnValue(true);
  window.history.replaceState({}, "", "/admin/clientes");
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("moderação administrativa em lote", () => {
  it("retorna à última página existente quando o total de contas diminui", async () => {
    mockDb.accounts = Array.from({ length: 24 }, (_, i) =>
      account(`bbbbbbbb-bbbb-4bbb-bbbb-${String(i).padStart(12, "0")}`, `Cliente ${i + 1}`));
    render(<AdminAccountsManager initialLayout="table" />);
    expect(await screen.findByText(/24 conta\(s\) · página 1 de 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cadastros mais antigos" }));
    expect(await screen.findByText(/24 conta\(s\) · página 2 de 2/)).toBeTruthy();

    mockDb.accounts = mockDb.accounts.slice(0, 2);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(await screen.findByText(/2 conta\(s\) · página 1 de 1/)).toBeTruthy();
    expect(screen.getByText("Cliente 1")).toBeTruthy();
    expect(mockDb.actions).toHaveLength(0);
  });

  it("fecha a confirmação anterior durante a atualização de contas", async () => {
    let finishRead: () => void = () => {};
    render(<AdminAccountsManager />);
    expect(await screen.findByText("Cliente Um")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Banir conta" })[0]!);
    expect(screen.getByRole("form", { name: "Confirmar alteração de conta" })).toBeTruthy();
    mockDb.delayNextSnapshot = new Promise<void>((resolve) => { finishRead = resolve; });

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(screen.queryByRole("form", { name: "Confirmar alteração de conta" })).toBeNull();
    expect(screen.queryByText("Cliente Um")).toBeNull();

    finishRead();
    expect(await screen.findByText("Cliente Um")).toBeTruthy();
    expect(mockDb.actions).toHaveLength(0);
  });

  it("retira os cartões e ações anteriores enquanto um novo filtro é carregado", async () => {
    let finishRead: () => void = () => {};
    render(<AdminAccountsManager />);
    expect(await screen.findByText("Cliente Um")).toBeTruthy();
    mockDb.delayNextSnapshot = new Promise<void>((resolve) => { finishRead = resolve; });

    fireEvent.click(screen.getByRole("button", { name: "Bloqueados" }));
    expect(screen.getByText("Consultando contas…")).toBeTruthy();
    expect(screen.queryByText("Cliente Um")).toBeNull();
    expect(screen.queryByRole("button", { name: "Banir conta" })).toBeNull();

    finishRead();
    expect(await screen.findByText(/Nenhuma conta neste filtro/)).toBeTruthy();
    expect(mockDb.actions).toHaveLength(0);
  });

  it("exclui administradores e confirma a persistência de cada conta no RPC", async () => {
    render(<AdminAccountsManager initialFilter="clientes" />);
    expect(await screen.findByText("Cliente Um")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Selecionar Administrador" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Selecionar contas desta página/ }));
    fireEvent.click(screen.getByRole("button", { name: "Banir selecionadas" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Motivo administrativo para auditoria do lote/ }), {
      target: { value: "Homologação controlada da ação em lote" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ações auditadas" }));
    await waitFor(() => expect(screen.getByText(/2 conta\(s\) com estado persistido confirmado/)).toBeTruthy());
    expect(mockDb.actions).toHaveLength(2);
    expect(mockDb.actions.every((action) => action["_action"] === "block_account" &&
      typeof action["_reason"] === "string" && (action["_reason"] as string).length >= 8)).toBe(true);
    expect(mockDb.actions.some((action) => action["_user_id"] === mockDb.accounts[0]?.["id"])).toBe(false);
    expect(mockDb.checks).toEqual([
      "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-cccc-cccccccccccc",
    ]);
  });

  it("não altera nenhuma conta antes do motivo e da confirmação explícita", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<AdminAccountsManager initialFilter="clientes" />);
    expect(await screen.findByText("Cliente Um")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Cliente Um" }));
    fireEvent.click(screen.getByRole("button", { name: "Banir selecionadas" }));
    const submit = screen.getByRole("button", { name: "Confirmar ações auditadas" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: /Motivo administrativo para auditoria do lote/ }), {
      target: { value: "Operação administrativa autorizada" },
    });
    fireEvent.click(submit);
    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    expect(mockDb.actions).toHaveLength(0);
  });
  it("apresenta tabela compacta e alterna a visualização sem alterar contas", async () => {
    render(<AdminAccountsManager initialLayout="table" />);
    expect(await screen.findByRole("table", { name: "Contas cadastradas" })).toBeTruthy();
    expect(screen.getByText("Cliente Um")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tabela" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("checkbox", { name: "Selecionar Administrador" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cartões" }));
    expect(screen.queryByRole("table", { name: "Contas cadastradas" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cartões" }).getAttribute("aria-pressed")).toBe("true");
    expect(mockDb.actions).toHaveLength(0);
  });

  it("mantém confirmação e motivos auditados na tabela operacional", async () => {
    render(<AdminAccountsManager initialLayout="table" />);
    expect(await screen.findByRole("table", { name: "Contas cadastradas" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Cliente Um" }));
    expect(screen.getByText(/1 selecionada\(s\)/)).toBeTruthy();
    expect(mockDb.actions).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Banir selecionadas" }));
    expect(screen.getByRole("button", { name: "Confirmar ações auditadas" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect(mockDb.actions).toHaveLength(0);
  });

  it("abre ficha rápida sanitizada e devolve o foco ao botão após fechar", async () => {
    mockDb.accounts[1] = { ...mockDb.accounts[1], masked_phone: "(**) *****-1234", technician_status: "habilitado" };
    render(<AdminAccountsManager initialLayout="table" />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver ficha de Cliente Um" }));
    const panel = screen.getByRole("region", { name: "Ficha rápida de Cliente Um" });
    expect(within(panel).getByText("(**) *****-1234")).toBeTruthy();
    expect(within(panel).getByText("habilitado")).toBeTruthy();
    expect(within(panel).getByText("a•••@example.test")).toBeTruthy();
    expect(mockDb.actions).toHaveLength(0);
    fireEvent.click(within(panel).getByRole("button", { name: "Fechar ficha" }));
    expect(screen.queryByRole("region", { name: "Ficha rápida de Cliente Um" })).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Ver ficha de Cliente Um");
  });

  it("remove a ficha antiga ao atualizar a consulta sem executar moderação", async () => {
    render(<AdminAccountsManager />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver ficha de Cliente Um" }));
    expect(screen.getByRole("region", { name: "Ficha rápida de Cliente Um" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Ficha rápida de Cliente Um" })).toBeNull());
    expect(mockDb.actions).toHaveLength(0);
  });

});

describe("gestão individual por UUID", () => {
  const id = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
  it("ignora o homônimo retornado por busca parcial e só escreve a conta exata", async () => {
    mockDb.accounts = [account("cccccccc-cccc-4ccc-cccc-cccccccccccc", "Outra conta " + id), account(id, "Conta exata")];
    render(<AdminAccountsManager exactAccountId={id} initialLayout="table" />);
    expect(await screen.findByText("Conta exata")).toBeInTheDocument();
    expect(screen.queryByText("Outra conta " + id)).toBeNull();
    expect(screen.queryByRole("button", { name: "Restringir número" })).toBeNull();
    expect(screen.queryByLabelText("Pesquisar contas")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Banir conta" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo administrativo obrigatório" }), { target: { value: "Teste sintético da conta exata" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e registrar" }));
    await waitFor(() => expect(mockDb.actions).toHaveLength(1));
    expect(mockDb.actions[0]).toMatchObject({ _user_id: id, _action: "block_account" });
    expect(await screen.findByText("Conta banida")).toBeInTheDocument();
  });
  it("não declara moderação bem-sucedida quando a releitura contradiz a resposta de escrita", async () => {
    mockDb.persistAction = false;
    render(<AdminAccountsManager exactAccountId={id} initialLayout="table" />);
    await screen.findByText("Cliente Um");
    fireEvent.click(screen.getByRole("button", { name: "Banir conta" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo administrativo obrigatório" }), { target: { value: "Teste sintético sem persistência" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e registrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("não foi confirmada pela releitura");
    expect(screen.queryByText(/operação confirmada e auditada/)).toBeNull();
    expect(mockDb.actions).toHaveLength(1);
  });
  it("não libera controles se a conta exata não existir no resultado", async () => {
    mockDb.accounts = [account("cccccccc-cccc-4ccc-cccc-cccccccccccc", "Outra conta " + id)];
    render(<AdminAccountsManager exactAccountId={id} initialLayout="table" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Conta exata não localizada");
    expect(screen.queryByRole("button", { name: "Banir conta" })).toBeNull();
    expect(mockDb.actions).toHaveLength(0);
  });
  it("mantém um administrador protegido mesmo quando seu UUID está confirmado", async () => {
    render(<AdminAccountsManager exactAccountId="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" initialLayout="table" />);
    expect(await screen.findByText("Administrador protegido")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar nome" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Banir conta" })).toBeNull();
  });
});
