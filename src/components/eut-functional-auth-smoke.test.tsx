// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { authReturnUrl } from "@/lib/auth-domain";
import { readSignupIntent } from "@/lib/signup-intent";

const mock = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: {
    signUp: mock.signUp,
    signInWithPassword: mock.signInWithPassword,
    signInWithOAuth: mock.signInWithOAuth,
    resetPasswordForEmail: mock.resetPasswordForEmail,
  } },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

import { AuthDialogProvider, useAuthDialog } from "@/components/auth-dialog";

function Launcher({ profile }: { profile: "tecnico" | "cliente" | "entrar" }) {
  const openAuth = useAuthDialog();
  return <button type="button" onClick={() => {
    if (profile === "entrar") openAuth?.("entrar");
    else openAuth?.("cadastrar", profile);
  }}>Abrir autenticação</button>;
}

function open(profile: "tecnico" | "cliente" | "entrar") {
  render(<AuthDialogProvider><Launcher profile={profile} /></AuthDialogProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Abrir autenticação" }));
}
function fill(email = "qa-cliente@example.invalid", password = "SenhaTeste2026!") {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: password } });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});
afterEach(() => { cleanup(); sessionStorage.clear(); });

describe("EUT — homologação funcional simulada do cadastro de técnico e cliente", () => {
  it.each(["tecnico", "cliente"] as const)(
    "exige aceite dos termos no cadastro de %s antes de solicitar criação Auth",
    (profile) => {
      open(profile);
      fill();
      const create = screen.getByRole("button", { name: "Criar conta" });
      expect(create.hasAttribute("disabled")).toBe(true);
      fireEvent.click(create);
      expect(mock.signUp).not.toHaveBeenCalled();
    }
  );

  it.each(["tecnico", "cliente"] as const)(
    "envia cadastro de %s pelo Supabase e preserva intenção sem criar papel no navegador",
    async (profile) => {
      mock.signUp.mockResolvedValue({ data: { session: null }, error: null });
      open(profile);
      fill(" qa-novo@example.invalid ");
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
      await waitFor(() => expect(mock.signUp).toHaveBeenCalledWith({
        email: "qa-novo@example.invalid",
        password: "SenhaTeste2026!",
        options: { emailRedirectTo: authReturnUrl("/entrar", window.location.origin) },
      }));
      expect(readSignupIntent()).toBe(profile);
      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Confira o seu e-mail"));
      expect(mock.signInWithPassword).not.toHaveBeenCalled();
    }
  );

  it("trocar técnico para cliente não concede permissão nem cria outra conta", () => {
    open("tecnico");
    expect(screen.getByRole("button", { name: "Sou técnico" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Sou cliente" }));
    expect(screen.getByRole("button", { name: "Sou cliente" }).getAttribute("aria-pressed")).toBe("true");
    expect(readSignupIntent()).toBe("cliente");
    expect(mock.signUp).not.toHaveBeenCalled();
  });

  it("retorna erro genérico de criação sem expor diagnóstico de identidade restrita", async () => {
    mock.signUp.mockResolvedValue({ data: { session: null }, error: { message: "internal-supabase-block-diagnostics" } });
    open("cliente");
    fill();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Não foi possível criar a conta"));
    expect(screen.getByRole("alert").textContent).not.toContain("internal-supabase");
  });

  it("não expõe erros de login nem aceita autenticação fictícia sem resposta do servidor", async () => {
    mock.signInWithPassword.mockResolvedValue({ error: { message: "invalid-user/provider-id" } });
    open("entrar");
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Entrar na minha conta" }));
    await waitFor(() => expect(mock.signInWithPassword).toHaveBeenCalledWith({
      email: "qa-cliente@example.invalid", password: "SenhaTeste2026!",
    }));
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível entrar");
    expect(screen.getByRole("alert").textContent).not.toContain("invalid-user");
    expect(mock.signUp).not.toHaveBeenCalled();
  });
});
