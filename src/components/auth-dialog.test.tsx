// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mock = vi.hoisted(() => ({ reset: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { resetPasswordForEmail: mock.reset } },
}));

// Focus here is Supabase request and the user-facing result, not Radix styling.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

import { AuthDialogProvider, useAuthDialog } from "./auth-dialog";
import { authReturnUrl } from "@/lib/auth-domain";

function OpenRecovery() {
  const openAuth = useAuthDialog();
  return <button type="button" onClick={() => openAuth?.("recuperar")}>Abrir recuperação</button>;
}
function openRecovery() {
  render(<AuthDialogProvider><OpenRecovery /></AuthDialogProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Abrir recuperação" }));
}
function sendRecovery() {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "usuario@exemplo.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar instruções" }));
}

describe("recuperação pelo modal universal", () => {
  beforeEach(() => { mock.reset.mockReset(); });
  afterEach(() => { cleanup(); });

  it("usa a rota de redefinição autorizada e dá retorno neutro ao usuário", async () => {
    mock.reset.mockResolvedValue({ error: null });
    openRecovery();
    sendRecovery();
    await waitFor(() => expect(mock.reset).toHaveBeenCalledWith("usuario@exemplo.com", {
      redirectTo: authReturnUrl("/redefinir-senha", window.location.origin),
    }));
    await waitFor(() => expect(screen.getByRole("status").textContent)
      .toContain("Se este e-mail possuir uma conta"));
  });

  it("informa falha de envio sem revelar existência de e-mail ou dados do provedor", async () => {
    mock.reset.mockResolvedValue({ error: { message: "SMTP internal diagnostics" } });
    openRecovery();
    sendRecovery();
    await waitFor(() => expect(screen.getByRole("alert").textContent)
      .toContain("Não foi possível enviar a recuperação"));
    expect(screen.getByRole("alert").textContent).not.toContain("SMTP");
  });
});
