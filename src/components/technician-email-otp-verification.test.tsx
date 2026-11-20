// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { User, UserIdentity } from "@supabase/supabase-js";

type MockUser = Pick<User, "id" | "email"> & Partial<Pick<User, "email_confirmed_at" | "identities">>;

function identity(provider: "google" | "email", data: Record<string, unknown>) {
  return { provider, identity_data: data } as unknown as UserIdentity;
}

const mockAuth = vi.hoisted(() => ({
  user: { id: "own-tech", email: "tecnico@example.com" },
  signInWithOtp: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: mockAuth.user }, error: null }),
      signInWithOtp: mockAuth.signInWithOtp,
    },
    rpc: mockAuth.rpc,
  },
}));

import { TechnicianEmailOtpVerification } from "./technician-email-otp-verification";

function view(user: MockUser = { id: "own-tech", email: "tecnico@example.com" }) {
  render(<TechnicianEmailOtpVerification user={user as User} />);
  const summary = screen.queryByText("Verificar titularidade do meu e-mail para publicar");
  if (summary) fireEvent.click(summary);
}

describe("prova de e-mail do técnico", () => {
  beforeEach(() => {
    mockAuth.user = { id: "own-tech", email: "tecnico@example.com" };
    mockAuth.signInWithOtp.mockReset().mockResolvedValue({ error: null });
    mockAuth.rpc.mockReset().mockResolvedValue({ data: { ok: true, verified: true }, error: null });
  });
  afterEach(() => cleanup());

  it("não apresenta OTP a titular Google já confirmado pelo contrato do servidor", () => {
    view({
      id: "own-tech", email: "tecnico@example.com", email_confirmed_at: "2026-11-20T12:00:00Z",
      identities: [identity("google", {
        email: "tecnico@example.com", email_verified: true,
      })],
    });
    expect(screen.queryByText("Verificar titularidade do meu e-mail para publicar")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar link ao meu e-mail" })).toBeNull();
    expect(mockAuth.rpc).not.toHaveBeenCalled();
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("preserva solicitação de OTP para identidade e-mail sem confirmação enviada", async () => {
    view({
      id: "own-tech", email: "tecnico@example.com", email_confirmed_at: "2026-11-20T12:00:00Z",
      identities: [identity("email", { email: "tecnico@example.com" })],
    });
    expect(screen.getByRole("button", { name: "Enviar link ao meu e-mail" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Confirmar verificação" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Enviar link ao meu e-mail" }));
    await waitFor(() => expect(mockAuth.signInWithOtp).toHaveBeenCalledTimes(1));
    expect(mockAuth.rpc).toHaveBeenCalledWith("eut_begin_technician_email_otp");
  });

  it("não presume confirmação Google com e-mail divergente ou flag falsa", () => {
    view({
      id: "own-tech", email: "tecnico@example.com", email_confirmed_at: "2026-11-20T12:00:00Z",
      identities: [identity("google", {
        email: "outra@example.com", email_verified: true,
      })],
    });
    expect(screen.getByRole("button", { name: "Enviar link ao meu e-mail" })).toBeEnabled();
    cleanup();
    view({
      id: "own-tech", email: "tecnico@example.com", email_confirmed_at: "2026-11-20T12:00:00Z",
      identities: [identity("google", {
        email: "tecnico@example.com", email_verified: false,
      })],
    });
    expect(screen.getByRole("button", { name: "Enviar link ao meu e-mail" })).toBeEnabled();
  });

  it("exige também email_confirmed_at antes de ocultar OTP para Google", () => {
    view({
      id: "own-tech", email: "tecnico@example.com",
      identities: [identity("google", {
        email: "tecnico@example.com", email_verified: "true",
      })],
    });
    expect(screen.getByRole("button", { name: "Enviar link ao meu e-mail" })).toBeEnabled();
  });

  it("envia link exclusivamente ao e-mail da própria sessão, sem criar contas", async () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Enviar link ao meu e-mail" }));
    await waitFor(() => expect(mockAuth.signInWithOtp).toHaveBeenCalledTimes(1));
    const request = mockAuth.signInWithOtp.mock.calls[0]![0];
    expect(mockAuth.rpc).toHaveBeenCalledWith("eut_begin_technician_email_otp");
    expect(mockAuth.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mockAuth.signInWithOtp.mock.invocationCallOrder[0]!);
    expect(request.email).toBe("tecnico@example.com");
    expect(request.options.shouldCreateUser).toBe(false);
    expect(request.options.emailRedirectTo).toMatch(/\/area-tecnico$/);
    expect(screen.getByRole("status").textContent).toMatch(/rascunho.*não foi apagado/i);
  });

  it("não envia OTP quando o servidor recusa iniciar o desafio", async () => {
    mockAuth.rpc.mockResolvedValueOnce({ data: null, error: { message: "sem papel técnico" } });
    view();
    fireEvent.click(screen.getByRole("button", { name: "Enviar link ao meu e-mail" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/não iniciou a prova/i));
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("recusa solicitar link ou confirmar se a sessão pertence a outro usuário", async () => {
    mockAuth.user = { id: "outra-conta", email: "outra@example.com" };
    view();
    fireEvent.click(screen.getByRole("button", { name: "Enviar link ao meu e-mail" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/sessão mudou/i));
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar verificação" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/mesma conta/i));
    expect(mockAuth.rpc).not.toHaveBeenCalled();
  });

  it("só informa prova concluída com confirmação explícita do servidor", async () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar verificação" }));
    await waitFor(() => expect(mockAuth.rpc).toHaveBeenCalledWith("eut_attest_technician_email_otp"));
    expect(screen.getByRole("status").textContent).toMatch(/comprovado pelo servidor/i);
    expect(screen.getByRole("button", { name: "Confirmar verificação" })).toBeDisabled();
  });

  it("não expõe detalhes internos se o servidor recusar a prova", async () => {
    mockAuth.rpc.mockResolvedValue({ data: null, error: { message: "auth.sessions secret@example.com" } });
    view();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar verificação" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/ainda não foi comprovada/i));
    expect(screen.getByRole("status").textContent).not.toMatch(/auth.sessions|secret@example.com/);
  });
});
