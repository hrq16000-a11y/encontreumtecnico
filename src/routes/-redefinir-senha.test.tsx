// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  openAuth: vi.fn(),
  listener: null as null | ((event: string, session: unknown) => void),
  unsubscribe: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) =>
    <a href={to}>{children}</a>,
}));
vi.mock("../components/page-placeholder", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/auth-dialog", () => ({ useAuthDialog: () => mock.openAuth }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mock.getUser,
      updateUser: mock.updateUser,
      onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
        mock.listener = listener;
        return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
      },
    },
  },
}));

import { Route } from "./redefinir-senha";
const ResetPage = (Route as unknown as { component: React.ComponentType }).component;

describe("recuperação de senha do Encontre um Técnico", () => {
  beforeEach(() => {
    mock.listener = null;
    mock.getUser.mockReset();
    mock.updateUser.mockReset();
    mock.openAuth.mockReset();
    mock.unsubscribe.mockReset();
    window.history.replaceState({}, "", "/redefinir-senha");
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mock.updateUser.mockResolvedValue({ error: null });
  });

  afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

  it("não permite salvar uma nova senha sem uma sessão validada", async () => {
    render(<ResetPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Salvar nova senha" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Solicitar novo link" }));
    expect(mock.openAuth).toHaveBeenCalledWith("recuperar");
    expect(mock.updateUser).not.toHaveBeenCalled();
  });

  it("recusa callback expirado mesmo que o navegador já tenha outra sessão", async () => {
    window.history.replaceState({}, "", "/redefinir-senha?error_code=otp_expired");
    mock.getUser.mockResolvedValue({ data: { user: { id: "already-signed-in" } }, error: null });
    render(<ResetPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Salvar nova senha" })).toBeNull();
    expect(mock.getUser).not.toHaveBeenCalled();
  });

  it("exibe recuperação validada e atualiza a senha após confirmar os dois campos", async () => {
    window.history.replaceState({}, "", "/redefinir-senha#type=recovery");
    mock.getUser.mockResolvedValue({ data: { user: { id: "recovering" } }, error: null });
    render(<ResetPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar nova senha" })).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Redefinir senha" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "SegredoSeguro2026!" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "SegredoSeguro2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    await waitFor(() => expect(mock.updateUser).toHaveBeenCalledWith({ password: "SegredoSeguro2026!" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Senha atualizada"));
  });

  it("bloqueia senhas diferentes e não chama updateUser", async () => {
    mock.getUser.mockResolvedValue({ data: { user: { id: "signed-in" } }, error: null });
    render(<ResetPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar nova senha" })).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Alterar senha" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "SegredoSeguro2026!" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "SegredoOutro2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(screen.getByRole("alert").textContent).toContain("não coincidem");
    expect(mock.updateUser).not.toHaveBeenCalled();
  });

  it("trata evento PASSWORD_RECOVERY como recuperação e revalida a sessão", async () => {
    render(<ResetPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    mock.getUser.mockResolvedValue({ data: { user: { id: "returning-user" } }, error: null });
    await act(async () => {
      mock.listener?.("PASSWORD_RECOVERY", { user: { id: "returning-user" } });
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar nova senha" })).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Redefinir senha" })).toBeTruthy();
  });

  it("bloqueia o formulário se a sessão for encerrada", async () => {
    mock.getUser.mockResolvedValue({ data: { user: { id: "signed-in" } }, error: null });
    render(<ResetPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar nova senha" })).toBeTruthy());
    act(() => mock.listener?.("SIGNED_OUT", null));
    expect(screen.queryByRole("button", { name: "Salvar nova senha" })).toBeNull();
  });
});
