// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const dbState = vi.hoisted(() => ({
  accounts: [] as Array<Record<string, unknown>>,
  edits: [] as Array<Record<string, unknown>>,
  readbacks: [] as string[],
  persistName: true,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "eut_admin_accounts_snapshot") {
        const search = String(args["_search"] ?? "");
        if (search.includes("-")) dbState.readbacks.push(search);
        const accounts = dbState.accounts.filter((account) =>
          !search || account["id"] === search ||
          String(account["full_name"]).toLowerCase().includes(search.toLowerCase()));
        return { data: {
          accounts, total: accounts.length, page: 0, page_size: 20,
          blocked_phones: [], audit: [],
        }, error: null };
      }
      if (name === "eut_admin_account_edit_name") {
        dbState.edits.push(args);
        const account = dbState.accounts.find((entry) => entry["id"] === args["_user_id"]);
        if (!account) return { data: null, error: { code: "P0002" } };
        if (dbState.persistName) account["full_name"] = args["_full_name"];
        return { data: {
          ok: true, user_id: args["_user_id"], full_name: args["_full_name"],
        }, error: null };
      }
      throw new Error("RPC não esperada");
    },
  },
}));

import { AdminAccountsManager } from "./admin-accounts-manager";

const userId = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

beforeEach(() => {
  dbState.accounts = [{
    id: userId, full_name: "Cliente Um", masked_email: null, masked_phone: null,
    email_confirmed: true, roles: "cliente", is_admin: false, is_client: true,
    is_technician: false, technician_id: null, technician_status: null,
    blocked_account: false, blocked_phone: false, created_at: "2026-11-10T00:00:00Z",
  }];
  dbState.edits = [];
  dbState.readbacks = [];
  dbState.persistName = true;
  vi.spyOn(window, "confirm").mockReturnValue(true);
  window.history.replaceState({}, "", "/admin/clientes");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function editName() {
  render(<AdminAccountsManager initialFilter="clientes" />);
  expect(await screen.findByText("Cliente Um")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Editar nome" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Nome completo" }), {
    target: { value: "Cliente Corrigido" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Motivo administrativo obrigatório" }), {
    target: { value: "Correção cadastral confirmada pelo titular" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar e registrar" }));
}

describe("edição auditada do nome da conta", () => {
  it("confirma a persistência por releitura do UUID antes de informar sucesso", async () => {
    await editName();
    await waitFor(() => expect(dbState.readbacks).toEqual([userId]));
    expect(await screen.findByText("Cliente Corrigido")).toBeTruthy();
    expect(screen.getByText(/operação confirmada e auditada no Supabase/)).toBeTruthy();
    expect(dbState.edits).toHaveLength(1);
    expect(dbState.edits[0]?.["_reason"]).toBe("Correção cadastral confirmada pelo titular");
  });

  it("não informa sucesso nem repete a escrita quando o nome não aparece na releitura", async () => {
    dbState.persistName = false;
    await editName();
    expect(await screen.findByText(/a releitura administrativa não confirmou o nome/)).toBeTruthy();
    expect(screen.queryByText(/operação confirmada e auditada no Supabase/)).toBeNull();
    expect(dbState.readbacks).toEqual([userId]);
    expect(dbState.edits).toHaveLength(1);
    expect(screen.queryByRole("form", { name: "Confirmar alteração de conta" })).toBeNull();
  });
});
