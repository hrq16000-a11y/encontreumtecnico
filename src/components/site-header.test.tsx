import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SiteHeader } from "./site-header";
const authState = vi.hoisted(() => ({
  value: { user: null as { id: string } | null,
    roles: [] as Array<"admin" | "tecnico" | "cliente">, loading: false },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState.value }));


vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, onClick, ...props }: {
    to: string; children: React.ReactNode; onClick?: () => void; [key: string]: unknown;
  }) => <a href={to} onClick={onClick} aria-label={typeof props["aria-label"] === "string" ? props["aria-label"] : undefined}>{children}</a>,
}));

afterEach(() => { cleanup(); authState.value = { user: null, roles: [], loading: false }; });

describe("Cabeçalho do novo portal", () => {
  it("abre o menu móvel com destinos públicos e caminhos de cadastro preservados", () => {
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "Abrir menu" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Fechar menu" }).getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("navigation", { name: "Navegação móvel" });
    expect(menu.querySelector('a[href="/tecnicos"]')).toBeTruthy();
    expect(menu.querySelector('a[href="/area-cliente"]')).toBeTruthy();
    expect(menu.querySelector('a[href="/area-tecnico"]')).toBeTruthy();
    expect(menu.querySelector('a[href="/entrar"]')).toBeTruthy();
  });

  it("oferece três atalhos móveis sem substituir o menu completo", () => {
    render(<SiteHeader />);
    const quick = screen.getByRole("navigation", { name: "Acesso rápido no celular" });
    for (const path of ["/", "/tecnicos", "/entrar"]) {
      expect(quick.querySelector(`a[href="${path}"]`)).toBeTruthy();
    }
    expect(quick.textContent).toContain("Minha área");
    expect(quick.textContent).toContain("Buscar");
    expect(quick.className).toContain("md:hidden");
    expect(screen.getByRole("button", { name: "Abrir menu" })).toBeTruthy();
  });

  it("fecha com Escape e após tocar em um link", () => {
    render(<SiteHeader />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "Navegação móvel" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const menu = screen.getByRole("navigation", { name: "Navegação móvel" });
    fireEvent.click(menu.querySelector('a[href="/tecnicos"]')!);
    expect(screen.queryByRole("navigation", { name: "Navegação móvel" })).toBeNull();
  });
});

describe("menu autenticado e direcionamento para painel do papel real", () => {
  it.each([
    ["admin", "/admin"],
    ["tecnico", "/area-tecnico"],
    ["cliente", "/area-cliente"],
  ] as const)("exibe Minha conta para %s no painel %s", (role, path) => {
    authState.value = { user: { id: "account-1" }, roles: [role], loading: false };
    render(<SiteHeader />);
    expect(screen.getAllByText("Minha conta").length).toBeGreaterThan(0);
    const desktop = screen.getAllByText("Minha conta").find((el) => el.closest("a")?.getAttribute("href") === path);
    expect(desktop).toBeTruthy();
    expect(screen.queryByText("Sou técnico")).toBeNull();
    const quick = screen.getByRole("navigation", { name: "Acesso rápido no celular" });
    expect(quick.querySelector(`a[href="${path}"]`)).toBeTruthy();
  });
  it("conta autenticada sem papel volta ao registro seguro", () => {
    authState.value = { user: { id: "unclassified" }, roles: [], loading: false };
    render(<SiteHeader />);
    expect(screen.getAllByText("Minha conta").some((el) =>
      el.closest("a")?.getAttribute("href") === "/entrar")).toBe(true);
  });
});
