import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FreeSearchHelp } from "./free-search-help";
import { freeHelpCopy, openFreeHelp } from "@/lib/free-search-help";

vi.mock("./contact-form", () => ({
  ContactForm: ({ initialSubject, initialMessage, submitLabel }: {
    initialSubject: string; initialMessage: string; submitLabel: string;
  }) => <div data-testid="safe-contact">{initialSubject} {initialMessage} {submitLabel}</div>,
}));
afterEach(() => { cleanup(); document.body.style.overflow = ""; });

describe("Ajuda gratuita para área não encontrada", () => {
  it("não abre automaticamente no restante do portal, e nunca promete contato grátis", () => {
    render(<FreeSearchHelp />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /ajuda grátis/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Primeira fase · R\$ 0,00/)).toBeTruthy();
    expect(screen.getByText(/O telefone de nenhum técnico é liberado/)).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("recebe a região informada e abre formulário privado predefinido", () => {
    render(<FreeSearchHelp />);
    act(() => openFreeHelp({ city: "Curitiba", uf: "PR", service: "redes" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Busca em Curitiba · PR/)).toBeTruthy();
    expect(screen.getByTestId("safe-contact").textContent).toContain("Curitiba · PR");
    expect(screen.getByTestId("safe-contact").textContent).toContain("redes");
    expect(screen.getByTestId("safe-contact").textContent).toContain("Solicitar ajuda gratuita");
  });

  it("limita textos da busca enviados ao formulário", () => {
    const copy = freeHelpCopy({city: "São Paulo", service: "<script>rede</script>"});
    expect(copy.location).toBe("São Paulo");
    expect(copy.message).not.toContain("<script>");
    expect(copy.message).toContain("rede");
  });
});
