// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

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

function view(email = "tecnico@example.com") {
  render(<TechnicianEmailOtpVerification userId="own-tech" email={email} />);
  fireEvent.click(screen.getByText("Verificar titularidade do meu e-mail para publicar"));
}

describe("prova de e-mail do técnico", () => {
  beforeEach(() => {
    mockAuth.user = { id: "own-tech", email: "tecnico@example.com" };
    mockAuth.signInWithOtp.mockReset().mockResolvedValue({ error: null });
    mockAuth.rpc.mockReset().mockResolvedValue({ data: { ok: true, verified: true }, error: null });
  });
  afterEach(() => cleanup());

  it("envia link exclusivamente ao e-mail da própria sessão, sem criar contas", async () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Enviar link ao meu e-mail" }));
    await waitFor(() => expect(mockAuth.signInWithOtp).toHaveBeenCalledTimes(1));
    const request = mockAuth.signInWithOtp.mock.calls[0][0];
    expect(request.email).toBe("tecnico@example.com");
    expect(request.options.shouldCreateUser).toBe(false);
    expect(request.options.emailRedirectTo).toMatch(/\/area-tecnico$/);
    expect(screen.getByRole("status").textContent).toMatch(/rascunho.*não foi apagado/i);
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
