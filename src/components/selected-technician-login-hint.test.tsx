// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SelectedTechnicianLoginHint } from "./selected-technician-login-hint";

afterEach(() => cleanup());

describe("Continuidade protegida do perfil técnico para o atendimento", () => {
  it("orienta a confirmação do profissional sem expor contatos ou ativar envio", () => {
    const { container } = render(<SelectedTechnicianLoginHint visible />);
    const status = screen.getByRole("status", { name: "Continuidade do atendimento" });
    expect(status.textContent).toContain("Você já escolheu um técnico");
    expect(status.textContent).toContain("confirme o profissional selecionado");
    expect(container.querySelector('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"]')).toBeNull();
    expect(container.querySelector("form, input, button")).toBeNull();
    expect(status.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it("não indica profissional selecionado sem um alvo", () => {
    const { container } = render(<SelectedTechnicianLoginHint visible={false} />);
    expect(container.textContent).toBe("");
    expect(screen.queryByRole("status", { name: "Continuidade do atendimento" })).toBeNull();
  });
});
