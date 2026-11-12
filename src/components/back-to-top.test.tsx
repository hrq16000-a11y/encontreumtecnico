import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BackToTop } from "./back-to-top";
const navState = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (x: { location: { pathname: string } }) => string }) => select({ location: { pathname: navState.pathname } }),
}));

afterEach(() => { cleanup(); navState.pathname = "/"; vi.unstubAllGlobals(); });

describe("Voltar ao topo", () => {
  it("só aparece após rolar e volta suavemente sem depender do WordPress", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollY", 0);
    vi.stubGlobal("scrollTo", scrollTo);
    render(<BackToTop />);
    expect(screen.queryByRole("button", { name: /voltar ao topo/i })).toBeNull();
    vi.stubGlobal("scrollY", 640);
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole("button", { name: /voltar ao topo/i }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("respeita preferência por menos animação", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollY", 640);
    vi.stubGlobal("scrollTo", scrollTo);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    render(<BackToTop />);
    fireEvent.click(screen.getByRole("button", { name: /voltar ao topo/i }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
  it("não cobre os botões próprios do perfil técnico no celular", () => {
    navState.pathname = "/tecnicos/jefferson-santana-tubarao-sc";
    vi.stubGlobal("scrollY", 640);
    render(<BackToTop />);
    expect(screen.getByRole("button", { name: /voltar ao topo/i }).className).toContain("hidden md:inline-flex");
  });
});
