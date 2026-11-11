// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  refreshRoles: vi.fn(),
  auth: { user: null as null | { id: string; email: string }, roles: [] as string[], loading: false },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mock.rpc },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({
  ...mock.auth, refreshRoles: mock.refreshRoles,
}) }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: Record<string, unknown>) => config,
  Link: ({ to, children, onClick }: { to: string; children: ReactNode; onClick?: () => void }) =>
    <a href={to} onClick={(e) => { e.preventDefault(); onClick?.(); }}>{children}</a>,
}));
vi.mock("@/components/page-placeholder", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { AdminInvitesManager } from "@/components/admin-invites-manager";
import { AdminInvitationPage } from "@/routes/convite-administrativo";

beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.user = null;
  mock.auth.roles = [];
  mock.auth.loading = false;
  mock.refreshRoles.mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("EUT — convites administrativos (Supabase RPC simulado)", () => {
  it("não apresenta gestão de convites quando o servidor recusa a consulta", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    const { container } = render(<AdminInvitesManager />);
    await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("eut_owner_admin_invites_snapshot"));
    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryByRole("button", { name: "Criar convite seguro" })).toBeNull();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it("proprietário cria convite pendente somente depois de confirmação e motivo", async () => {
    mock.rpc.mockImplementation(async (action: string) =>
      action === "eut_owner_admin_invites_snapshot"
        ? { data: { invites: [] }, error: null }
        : { data: { ok: true, action: "create", id: "00000000-0000-4000-8000-000000000001" }, error: null });
    render(<AdminInvitesManager />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar convite seguro" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText("E-mail do destinatário"), {
      target: { value: "Novo.Convidado@Example.Invalid" },
    });
    fireEvent.change(screen.getByLabelText("Justificativa administrativa"), {
      target: { value: "Acesso temporário para homologação" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar convite seguro" }));
    await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith(
      "eut_owner_admin_invite_action",
      expect.objectContaining({
        _action: "create",
        _target_email: "novo.convidado@example.invalid",
        _reason: "Acesso temporário para homologação",
      }),
    ));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Nenhum e-mail foi enviado automaticamente"));
  });

  it("não cria convite quando a confirmação foi cancelada", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    mock.rpc.mockResolvedValue({ data: { invites: [] }, error: null });
    render(<AdminInvitesManager />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar convite seguro" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText("E-mail do destinatário"), { target: { value: "qa@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Justificativa administrativa"), { target: { value: "Somente uma simulação" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar convite seguro" }));
    expect(mock.rpc).not.toHaveBeenCalledWith("eut_owner_admin_invite_action", expect.anything());
  });

  it("sem login direciona ao fluxo existente sem consultar convite ou conceder papel", () => {
    render(<AdminInvitationPage />);
    fireEvent.click(screen.getByText("Entrar ou criar conta"));
    expect(sessionStorage.getItem("eut-after-login")).toBe("/convite-administrativo");
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.refreshRoles).not.toHaveBeenCalled();
  });

  it("pessoa autenticada sem convite não consegue aceitar", async () => {
    mock.auth.user = { id: "qa-client", email: "cliente@example.invalid" };
    mock.rpc.mockResolvedValue({ data: {}, error: null });
    render(<AdminInvitationPage />);
    await waitFor(() => expect(screen.getByText(/Nenhum convite pendente para o e-mail/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Aceitar convite administrativo" })).toBeNull();
    expect(mock.rpc).toHaveBeenCalledWith("eut_my_admin_invitation");
    expect(mock.rpc).not.toHaveBeenCalledWith("eut_accept_admin_invitation", expect.anything());
  });

  it("destinatário autenticado aceita convite válido; servidor é autoridade, depois recarrega papéis", async () => {
    mock.auth.user = { id: "qa-invited", email: "convidado@example.invalid" };
    mock.rpc.mockImplementation(async (name: string) => {
      if (name === "eut_my_admin_invitation") return {
        data: { id: "00000000-0000-4000-8000-000000000001", pending: true, expires_at: "2099-01-01T00:00:00Z" },
        error: null,
      };
      if (name === "eut_accept_admin_invitation") return { data: { ok: true, accepted: true }, error: null };
      return { data: null, error: { message: "unexpected rpc" } };
    });
    render(<AdminInvitationPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Aceitar convite administrativo" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Aceitar convite administrativo" }));
    await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("eut_accept_admin_invitation", {
      _invite_id: "00000000-0000-4000-8000-000000000001",
    }));
    await waitFor(() => expect(mock.refreshRoles).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Acesso administrativo confirmado para esta conta.")).toBeTruthy());
  });

  it("rejeição no servidor não resulta em permissão administrativa no navegador", async () => {
    mock.auth.user = { id: "qa-blocked", email: "bloqueado@example.invalid" };
    mock.rpc.mockImplementation(async (name: string) =>
      name === "eut_my_admin_invitation"
        ? { data: { id: "00000000-0000-4000-8000-000000000002", pending: true }, error: null }
        : { data: null, error: { message: "blocked identity private details" } });
    render(<AdminInvitationPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Aceitar convite administrativo" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Aceitar convite administrativo" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Não foi possível aceitar o convite"));
    expect(screen.getByRole("alert").textContent).not.toContain("blocked identity private details");
    expect(mock.refreshRoles).not.toHaveBeenCalled();
    expect(screen.queryByText("Acesso administrativo confirmado para esta conta.")).toBeNull();
  });
});
