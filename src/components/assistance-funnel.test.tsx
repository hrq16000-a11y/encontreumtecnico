import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AssistanceFunnel } from "./assistance-funnel";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/use-regional-suggestion", () => ({ useRegionalSuggestion: () => ({ area: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/lib/assistance-draft", () => ({
  readAssistanceDraft: () => null,
  saveAssistanceDraft: vi.fn(),
  clearAssistanceDraft: vi.fn(),
}));

afterEach(cleanup);

describe("Localidade do atendimento guiado", () => {
  it("permite corrigir a UF após editar a cidade, sem enviar solicitação", () => {
    render(<AssistanceFunnel context={{ mode: "managed", city: "Curitiba", uf: "PR" }} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de serviço" }), {
      target: { value: "Computadores e notebooks" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Qual problema/i }), {
      target: { value: "Notebook não conecta à rede sem fio há dois dias" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    const state = screen.getByRole("combobox", { name: "Estado (UF)" }) as HTMLSelectElement;
    expect(state.value).toBe("PR");
    fireEvent.change(screen.getByRole("textbox", { name: "Cidade (opcional)" }), {
      target: { value: "Florianópolis" },
    });
    expect(state.value).toBe("");
    fireEvent.change(state, { target: { value: "SC" } });
    expect(state.value).toBe("SC");
  });
});
