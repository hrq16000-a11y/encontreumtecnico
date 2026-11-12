// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemberInviteAcceptance } from "./member-invite-acceptance";
import { AdminMemberInvites } from "./admin-member-invites";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), refreshRoles: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));

const pendingTechnician = {
  pending: true, target_role: "tecnico", expires_at: "2099-01-01T00:00:00Z",
};

beforeEach(() => {
  mock.rpc.mockReset();
  mock.refreshRoles.mockReset();
  mock.refreshRoles.mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function invite(termsAccepted = true) {
  return render(<MemberInviteAcceptance
    userId="qa-account" termsAccepted={termsAccepted} refreshRoles={mock.refreshRoles}
  />);
}

describe("QA #153 adaptada à main: convite de técnico/cliente sem SQL ou contas reais", () => {
  it("não exibe aceite nem solicita papel quando não há convite confirmado", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: null });
    invite();
    await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("eut_my_member_invitation"));
    expect(screen.queryByRole("button", { name: /Aceitar convite/ })).toBeNull();
    expect(mock.refreshRoles).not.toHaveBeenCalled();
  });

  it("ignora uma resposta de convite para papel administrativo inesperado", async () => {
    mock.rpc.mockResolvedValue({
      data: { pending: true, target_role: "admin" }, error: null,
    });
    invite();
    await waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /Aceitar convite/ })).toBeNull();
    expect(mock.refreshRoles).not.toHaveBeenCalled();
  });

  it("exige aceite dos termos antes de qualquer RPC de aceitação", async () => {
    mock.rpc.mockResolvedValue({ data: pendingTechnician, error: null });
    invite(false);
    const button = await screen.findByRole("button", { name: /Aceitar convite/ });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(mock.rpc).not.toHaveBeenCalledWith("eut_accept_member_invitation");
    expect(mock.refreshRoles).not.toHaveBeenCalled();
  });

  it("cancelamento do usuário não aceita convite nem atualiza papéis", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    mock.rpc.mockResolvedValue({ data: pendingTechnician, error: null });
    invite();
    fireEvent.click(await screen.findByRole("button", { name: /Aceitar convite/ }));
    expect(mock.rpc).not.toHaveBeenCalledWith("eut_accept_member_invitation");
    expect(mock.refreshRoles).not.toHaveBeenCalled();
  });

  it("rejeita sucesso com papel incompatível e não confia no navegador", async () => {
    mock.rpc.mockImplementation(async (name: string) =>
      name === "eut_my_member_invitation"
        ? { data: pendingTechnician, error: null }
        : { data: { ok: true, state: "accepted", target_role: "cliente" }, error: null }
    );
    invite();
    fireEvent.click(await screen.findByRole("button", { name: /Aceitar convite/ }));
    await screen.findByRole("alert");
    expect(mock.refreshRoles).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível aceitar");
  });

  it("não divulga diagnóstico interno quando servidor rejeita convite", async () => {
    mock.rpc.mockImplementation(async (name: string) =>
      name === "eut_my_member_invitation"
        ? { data: pendingTechnician, error: null }
        : { data: null, error: { message: "private moderation secret details" } }
    );
    invite();
    fireEvent.click(await screen.findByRole("button", { name: /Aceitar convite/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("private moderation secret details");
    expect(mock.refreshRoles).not.toHaveBeenCalled();
  });

  it("só atualiza os papéis após confirmação idêntica do servidor", async () => {
    mock.rpc.mockImplementation(async (name: string) =>
      name === "eut_my_member_invitation"
        ? { data: pendingTechnician, error: null }
        : { data: { ok: true, state: "accepted", target_role: "tecnico" }, error: null }
    );
    invite();
    fireEvent.click(await screen.findByRole("button", { name: /Aceitar convite/ }));
    await waitFor(() => expect(mock.refreshRoles).toHaveBeenCalledTimes(1));
    expect(mock.rpc).toHaveBeenCalledWith("eut_accept_member_invitation");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Aceitar convite/ })).toBeNull()
    );
  });
});

describe("QA #153 adaptada à main: painel de convite auditado", () => {
  it("não expõe erro privado da consulta administrativa", async () => {
    mock.rpc.mockResolvedValue({
      data: null, error: { message: "private-admin-permission-detail" },
    });
    render(<AdminMemberInvites />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível carregar os convites");
    expect(alert.textContent).not.toContain("private-admin-permission-detail");
  });

  it("cancelar confirmação impede a chamada administrativa de escrita", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    mock.rpc.mockResolvedValue({ data: { invites: [] }, error: null });
    render(<AdminMemberInvites initialRole="cliente" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar convite auditado" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText("E-mail do destinatário"), {
      target: { value: " qa@example.invalid " },
    });
    fireEvent.change(screen.getByLabelText("Motivo administrativo (auditado)"), {
      target: { value: "Convite exclusivamente para teste" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar convite auditado" }));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(mock.rpc).not.toHaveBeenCalledWith("eut_admin_member_invite_action", expect.anything());
  });

  it("envia somente técnico/cliente à RPC, com e-mail normalizado e motivo", async () => {
    mock.rpc.mockImplementation(async (name: string) =>
      name === "eut_admin_member_invites_snapshot"
        ? { data: { invites: [] }, error: null }
        : { data: { ok: true, action: "create", target_role: "cliente" }, error: null }
    );
    render(<AdminMemberInvites initialRole="cliente" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar convite auditado" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText("E-mail do destinatário"), {
      target: { value: " QA.CliEnTe@Example.Invalid " },
    });
    fireEvent.change(screen.getByLabelText("Motivo administrativo (auditado)"), {
      target: { value: "Teste com identidade sintética" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar convite auditado" }));
    await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("eut_admin_member_invite_action", {
      _action: "create", _email: "qa.cliente@example.invalid", _role: "cliente",
      _invite_id: null, _reason: "Teste com identidade sintética",
    }));
    expect(mock.rpc).not.toHaveBeenCalledWith("eut_admin_member_invite_action",
      expect.objectContaining({ _role: "admin" }));
    await screen.findByText(/Convite registrado e auditado/);
  });
});
