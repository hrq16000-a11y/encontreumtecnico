import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FreeSearchHelp } from "./free-search-help";
import { openFreeHelp } from "@/lib/free-search-help";

vi.mock("./assistance-funnel", () => ({
  AssistanceFunnel: ({ context }: { context: { city?: string; service?: string } }) =>
    <div><div data-testid="guided-funnel">Etapa 1 de 3 · {context.city ?? ""} · {context.service ?? ""}</div><textarea aria-label="Rascunho de teste" /></div>,
}));
afterEach(() => { cleanup(); document.body.style.overflow = ""; });

describe("Funil flutuante de atendimento", () => {
  it("não abre de forma intrusiva e permanece acessível em qualquer página", async () => {
    render(<FreeSearchHelp />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /preciso de ajuda/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((await screen.findByTestId("guided-funnel")).textContent).toContain("Etapa 1 de 3");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
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
