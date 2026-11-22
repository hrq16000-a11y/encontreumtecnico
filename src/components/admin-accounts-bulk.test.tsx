// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockDb = vi.hoisted(() => ({
  accounts: [] as Array<Record<string, unknown>>,
  actions: [] as Array<Record<string, unknown>>,
  edits: [] as Array<Record<string, unknown>>,
  checks: [] as string[],
  delayNextSnapshot: null as Promise<void> | null,
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
        return { data: {
          accounts: rows, total: rows.length, page: 0, page_size: 20,
          audit: [], blocked_phones: [],
        }, error: null };
      }
      if (name === "eut_admin_account_edit_name") {
        mockDb.edits.push(args);
        const target = mockDb.accounts.find((row) => row["id"] === args["_user_id"]);
        if (!target) return { data: null, error: { message: "not_found" } };
        target["full_name"] = args["_full_name"];
        return { data: { ok: true, user_id: args["_user_id"], full_name: args["_full_name"] }, error: null };
      }
      if (name === "eut_admin_contact_action") {
        mockDb.actions.push(args);
        const target = mockDb.accounts.find((row) => row["id"] === args["_user_id"]);
        if (!target) return { data: null, error: { message: "not_found" } };
        target["blocked_account"] = args["_action"] === "block_account";
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
  mockDb.edits = [];
  mockDb.checks = [];
  mockDb.delayNextSnapshot = null;
  vi.spyOn(window, "confirm").mockReturnValue(true);
  window.history.replaceState({}, "", "/admin/clientes");
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("moderação administrativa em lote", () => {
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

  it("abre ficha somente com dados autorizados da tabela e contatos mascarados", async () => {
    mockDb.accounts[1]!["masked_phone"] = "•••• 1234";
    render(<AdminAccountsManager initialLayout="table" />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver ficha de Cliente Um" }));
    expect(screen.getByRole("dialog", { name: /Ficha rápida de pessoa · Cliente Um/ })).toBeTruthy();
    expect(screen.getAllByText("a•••@example.test").length).toBeGreaterThan(0);
    expect(screen.getByText("•••• 1234")).toBeTruthy();
    expect(screen.getByText("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb")).toBeTruthy();
    expect(mockDb.actions).toHaveLength(0);
    expect(mockDb.edits).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Fechar ficha" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("abre ficha em cartões e fecha com Escape sem executar ações", async () => {
    render(<AdminAccountsManager />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver ficha de Cliente Dois" }));
    expect(screen.getByRole("dialog", { name: /Ficha rápida de pessoa · Cliente Dois/ })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mockDb.actions).toHaveLength(0);
  });

  it("exibe administradores em modo exclusivamente de consulta", async () => {
    render(<AdminAccountsManager initialLayout="table" />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver ficha de Administrador" }));
    expect(screen.getByRole("dialog", { name: /Ficha rápida de pessoa · Administrador/ })).toBeTruthy();
    expect(screen.getByText(/Administrador protegido — somente consulta/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar nome na ficha" })).toBeNull();
    expect(mockDb.edits).toHaveLength(0);
  });

  it("reutiliza edição existente e RPC auditada depois de fechar a ficha", async () => {
    render(<AdminAccountsManager initialLayout="table" />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver ficha de Cliente Um" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar nome na ficha" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("form", { name: "Confirmar alteração de conta" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Nome completo" }), { target: { value: "Cliente Atualizado" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo administrativo obrigatório" }), {
      target: { value: "Correção solicitada e conferida" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e registrar" }));
    await waitFor(() => expect(mockDb.edits).toHaveLength(1));
    expect(mockDb.edits[0]?.["_user_id"]).toBe("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb");
    expect(mockDb.edits[0]?.["_reason"]).toBe("Correção solicitada e conferida");
    expect(await screen.findByText("Cliente Atualizado")).toBeTruthy();
    expect(mockDb.actions).toHaveLength(0);
  });

  it("abre conta autorizada por registro na URL sem consultar outros dados", async () => {
    window.history.replaceState({}, "", "/admin/usuarios?registro=bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb");
    render(<AdminAccountsManager initialLayout="table" />);
    expect(await screen.findByRole("dialog", { name: /Ficha rápida de pessoa · Cliente Um/ })).toBeTruthy();
    expect(mockDb.checks).toContain("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb");
    expect(mockDb.actions).toHaveLength(0);
  });

  it("fecha ficha durante atualização e não reabre dados anteriores", async () => {
    render(<AdminAccountsManager initialLayout="table" />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver ficha de Cliente Um" }));
    let finishRead: () => void = () => {};
    mockDb.delayNextSnapshot = new Promise<void>((resolve) => { finishRead = resolve; });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    finishRead();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ver ficha de Cliente Um" })).toBeTruthy());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

});
