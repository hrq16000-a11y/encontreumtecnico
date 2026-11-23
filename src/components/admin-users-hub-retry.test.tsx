// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  AdminAccountsManager: () => <div data-testid="account-manager-stub" />,
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
        { id: roles[0].user_id, full_name: "Administradora Sintética A", phone: "SENTINELA_PRIVADA" },
        { id: roles[1].user_id, full_name: "Administrador Sintético B", phone: "SENTINELA_PRIVADA" },
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
