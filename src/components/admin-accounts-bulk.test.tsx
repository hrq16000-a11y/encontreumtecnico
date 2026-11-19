// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockDb = vi.hoisted(() => ({
  accounts: [] as Array<Record<string, unknown>>,
  actions: [] as Array<Record<string, unknown>>,
  checks: [] as string[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "eut_admin_accounts_snapshot") {
        const search = String(args["_search"] ?? "");
        const rows = mockDb.accounts.filter((row) =>
          !search || String(row["id"]) === search || String(row["full_name"]).toLowerCase().includes(search.toLowerCase()));
        if (search.includes("-")) mockDb.checks.push(search);
        return { data: {
          accounts: rows, total: rows.length, page: 0, page_size: 20,
          audit: [], blocked_phones: [],
        }, error: null };
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
  mockDb.checks = [];
  vi.spyOn(window, "confirm").mockReturnValue(true);
  window.history.replaceState({}, "", "/admin/clientes");
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("moderação administrativa em lote", () => {
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
});
