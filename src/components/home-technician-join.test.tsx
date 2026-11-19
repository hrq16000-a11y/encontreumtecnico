// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn() }));

import { HomeTechnicianJoin } from "./home-technician-join";

const auth = (overrides: Record<string, unknown>) => {
  vi.mocked(useAuth).mockReturnValue({
    user: null, roles: [], rolesError: false, loading: false, refreshRoles: vi.fn(async () => {}), ...overrides,
  } as ReturnType<typeof useAuth>);
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Home: cadastro e recuperação sem enumeração pública", () => {
  it("oferece cadastro e recuperação ao visitante sem consultar dados de terceiros", () => {
    auth({});
    render(<HomeTechnicianJoin />);
    expect(screen.getByRole("link", { name: /Cadastrar gratuitamente/i }).getAttribute("href")).toBe("/cadastro");
    expect(screen.getByRole("link", { name: /Entrar ou recuperar cadastro/i }).getAttribute("href")).toBe("/entrar");
    expect(screen.getByRole("link", { name: /Não consigo acessar/i }).getAttribute("href")).toBe("/ajuda-acesso");
    expect(screen.getByText(/CNPJ não é obrigatório/)).toBeTruthy();
  });

  it("reconhece a sessão de técnico e abre o painel sem duplicar cadastro", () => {
    auth({ user: { id: "tecnico-1" }, roles: ["tecnico"] });
    render(<HomeTechnicianJoin />);
    expect(screen.getByText(/Identificamos seu acesso de técnico/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Abrir meu painel/i }).getAttribute("href")).toBe("/area-tecnico");
    expect(screen.queryByRole("link", { name: /Entrar ou recuperar cadastro/i })).toBeNull();
  });

  it("não classifica conta autenticada sem papel como novo cadastro", () => {
    auth({ user: { id: "perfil-a-conferir" }, roles: [] });
    render(<HomeTechnicianJoin />);
    expect(screen.getByText(/Falta conferir a função da conta/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Conferir meu cadastro/i }).getAttribute("href")).toBe("/entrar");
  });

  it("não interpreta erro de papéis como ausência de conta", () => {
    auth({ user: { id: "perfil-erro" }, rolesError: true });
    render(<HomeTechnicianJoin />);
    expect(screen.getByText(/Não foi possível confirmar suas permissões/i)).toBeTruthy();
    expect(screen.queryByText(/Identificamos seu acesso de técnico/i)).toBeNull();
  });
});
