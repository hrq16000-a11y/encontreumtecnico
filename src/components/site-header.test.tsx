import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SiteHeader } from "./site-header";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, onClick, ...props }: {
    to: string; children: React.ReactNode; onClick?: () => void; [key: string]: unknown;
  }) => <a href={to} onClick={onClick} aria-label={typeof props["aria-label"] === "string" ? props["aria-label"] : undefined}>{children}</a>,
}));

afterEach(() => cleanup());

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
