import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FreeSearchHelp } from "./free-search-help";
import { openFreeHelp } from "@/lib/free-search-help";
const routeState = vi.hoisted(() => ({ pathname: "/tecnicos" }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: routeState.pathname } }),
}));

vi.mock("./assistance-funnel", () => ({
  AssistanceFunnel: ({ context }: { context: { city?: string; service?: string } }) =>
    <div><div data-testid="guided-funnel">Etapa 1 de 3 · {context.city ?? ""} · {context.service ?? ""}</div><textarea aria-label="Rascunho de teste" /></div>,
}));
afterEach(() => { cleanup(); document.body.style.overflow = ""; routeState.pathname = "/tecnicos"; });

describe("Funil flutuante de atendimento", () => {
  it("não abre de forma intrusiva e permanece acessível em qualquer página", async () => {
    render(<FreeSearchHelp />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const trigger = screen.getByRole("button", { name: /preciso de ajuda/i });
    expect(trigger.className).toContain("bottom-[calc(5.5rem+env(safe-area-inset-bottom))]");
    expect(trigger.className).toContain("hidden md:inline-flex");
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((await screen.findByTestId("guided-funnel")).textContent).toContain("Etapa 1 de 3");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("mantém o botão flutuante mobile quando a barra de atalhos não existe", () => {
    routeState.pathname = "/tecnicos/jefferson-santana-tubarao-sc";
    render(<FreeSearchHelp />);
    expect(screen.getByRole("button", { name: /preciso de ajuda/i }).className).toContain("inline-flex");
    expect(screen.getByRole("button", { name: /preciso de ajuda/i }).className).not.toContain("hidden md:inline-flex");
  });
  it("devolve o foco ao atalho Ajuda após fechar o atendimento", () => {
    render(<><button type="button">Ajuda</button><FreeSearchHelp /></>);
    const mobileHelp = screen.getByRole("button", { name: "Ajuda" });
    mobileHelp.focus();
    act(() => openFreeHelp({}));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechar atendimento" }));
    expect(document.activeElement).toBe(mobileHelp);
  });
  it("recebe contexto regional do fluxo sem resultados", async () => {
    render(<FreeSearchHelp />);
    act(() => openFreeHelp({ city: "Curitiba", uf: "PR", service: "redes" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((await screen.findByTestId("guided-funnel")).textContent).toContain("Curitiba");
    expect((await screen.findByTestId("guided-funnel")).textContent).toContain("redes");
  });
  it("abre o funil preservando o profissional selecionado", async () => {
    render(<FreeSearchHelp />);
    act(() => openFreeHelp({ mode: "direct", technicianId: "b190db33-86e1-4cf4-b916-a1f4eac56720", technicianName: "Técnico selecionado", city: "Curitiba" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((await screen.findByTestId("guided-funnel"))).toBeTruthy();
  });
  it("não descarrega o wizard nem apaga texto digitado ao mudar o foco da aba", async () => {
    render(<FreeSearchHelp />);
    fireEvent.click(screen.getByRole("button", { name: /preciso de ajuda/i }));
    const input = await screen.findByRole("textbox", { name: /rascunho de teste/i });
    fireEvent.change(input, { target: { value: "Problema descrito, não perder" } });
    fireEvent.blur(window);
    fireEvent.focus(window);
    document.dispatchEvent(new Event("visibilitychange"));
    expect((input as HTMLTextAreaElement).value).toBe("Problema descrito, não perder");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
