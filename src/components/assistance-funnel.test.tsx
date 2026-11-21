import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistanceFunnel } from "./assistance-funnel";

const directoryMock = vi.hoisted(() => ({
  navigate: vi.fn(),
  categories: [
    { slug: "computadores", label: "Computadores e notebooks" },
    { slug: "redes", label: "Redes e conectividade" },
  ],
  services: [
    { slug: "formatacao-de-notebooks", label: "Formatação de notebooks", category_slug: "computadores" },
  ],
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => directoryMock.navigate }));
vi.mock("@/hooks/use-active-categories", () => ({
  useActiveCategories: () => ({ categories: directoryMock.categories, loading: false, error: false }),
}));
vi.mock("@/hooks/use-active-services", () => ({
  useActiveServices: () => ({ services: directoryMock.services, loading: false, error: false }),
}));
vi.mock("@/hooks/use-regional-suggestion", () => ({ useRegionalSuggestion: () => ({ area: null }) }));
vi.mock("@/hooks/use-municipalities", () => ({
  normalizedCityText: (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(),
  useMunicipalities: (uf: string) => ({
    cities: uf === "PR"
      ? [{ id: 4106902, name: "Curitiba", uf: "PR" }]
      : uf === "SC" ? [{ id: 4205407, name: "Florianópolis", uf: "SC" }] : [],
    loading: false, error: false, retry: vi.fn(),
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/lib/assistance-draft", () => ({
  readAssistanceDraft: () => null,
  saveAssistanceDraft: vi.fn(),
  clearAssistanceDraft: vi.fn(),
}));

afterEach(() => {
  cleanup();
  directoryMock.navigate.mockReset();
  vi.clearAllMocks();
});

describe("Localidade do atendimento guiado", () => {
  it("mantém o serviço específico vindo do perfil selecionado, sem trocá-lo por Outro serviço", () => {
    render(<AssistanceFunnel context={{ mode: "direct", technicianId: "00000000-0000-4000-8000-000000000001", technicianName: "Profissional de teste", service: "Formatação de notebooks" }} onClose={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Tipo de serviço" }) as HTMLSelectElement;
    expect(select.value).toBe("Formatação de notebooks");
    expect(screen.getByRole("option", { name: "Serviço selecionado: Formatação de notebooks" })).toBeTruthy();
    fireEvent.change(select, { target: { value: "Computadores e notebooks" } });
    expect(select.value).toBe("Computadores e notebooks");
  });
  it("pré-seleciona município IBGE e permite corrigir UF e cidade sem texto livre", async () => {
    render(<AssistanceFunnel context={{ mode: "managed", city: "Curitiba", uf: "PR" }} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de serviço" }), {
      target: { value: "Computadores e notebooks" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Qual problema/i }), {
      target: { value: "Notebook não conecta à rede sem fio há dois dias" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    const state = screen.getByRole("combobox", { name: "UF" }) as HTMLSelectElement;
    expect(state.value).toBe("PR");
    const officialCity = screen.getByRole("combobox", { name: "Município oficial" }) as HTMLSelectElement;
    expect(officialCity.value).toBe("");
    fireEvent.change(officialCity, { target: { value: "4106902" } });
    await waitFor(() => expect(officialCity.value).toBe("4106902"));
    expect(screen.queryByRole("textbox", { name: "Cidade (opcional)" })).toBeNull();
    fireEvent.change(state, { target: { value: "SC" } });
    expect(state.value).toBe("SC");
    expect(officialCity.value).toBe("");
    fireEvent.change(screen.getByRole("searchbox", { name: "Filtrar municípios IBGE" }), {
      target: { value: "Flori" },
    });
    fireEvent.change(officialCity, { target: { value: "4205407" } });
    expect(officialCity.value).toBe("4205407");
    expect(screen.getByText(/IBGE 4205407/)).toBeTruthy();
  });

  it("não grava cidade inexistente vinda de sugestão ou contexto externo", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);
    render(<AssistanceFunnel context={{ mode: "managed", city: "Cidade inventada", uf: "PR" }} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de serviço" }), {
      target: { value: "Computadores e notebooks" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Qual problema/i }), {
      target: { value: "Meu notebook não conecta à rede sem fio há dois dias" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(screen.getByText(/sem confirmação IBGE/)).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Seu nome" }), {
      target: { value: "Cliente de teste" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "E-mail para resposta" }), {
      target: { value: "cliente@example.com" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Solicitar gestão/ }));
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    const lead = insert.mock.calls[0]?.[0] as { message: string };
    expect(lead.message).not.toContain("Cidade inventada");
    expect(lead.message).toContain("Localidade aproximada ou informada: PR");
  });

  it("após registrar interesse direto, navega com serviço ativo e município IBGE confirmado", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);
    render(<AssistanceFunnel context={{
      mode: "direct", service: "Formatação de notebooks", city: "Curitiba", uf: "PR",
    }} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: /Qual problema/i }), {
      target: { value: "Meu notebook reinicia sozinho e preciso de manutenção" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    const confirmed = screen.getByRole("combobox", { name: "Município oficial" });
    fireEvent.change(confirmed, { target: { value: "4106902" } });
    await waitFor(() => expect((confirmed as HTMLSelectElement).value).toBe("4106902"));
    fireEvent.change(screen.getByRole("textbox", { name: "Seu nome" }), {
      target: { value: "Cliente sintético" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "E-mail para resposta" }), {
      target: { value: "cliente-sintetico@example.com" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Registrar interesse/i }));
    await waitFor(() => expect(screen.getByText("Pedido registrado!")).toBeTruthy());
    expect(insert).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Ver técnicos na minha região/i }));
    expect(directoryMock.navigate).toHaveBeenCalledWith({
      to: "/tecnicos", search: {
        especialidade: "computadores", servico: "formatacao-de-notebooks",
        cidade: "Curitiba", uf: "PR", bairro: "", regiao: "", prioridade: "regiao",
      },
    });
  });

  it("não propaga cidade não verificada nem serviço sem vínculo ativo para URL", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);
    render(<AssistanceFunnel context={{
      mode: "direct", service: "Serviço de texto livre", city: "Cidade inventada", uf: "PR",
    }} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: /Qual problema/i }), {
      target: { value: "Preciso instalar um equipamento e verificar sua configuração" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(screen.getByText(/sem confirmação IBGE/)).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Seu nome" }), {
      target: { value: "Cliente sintético" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "E-mail para resposta" }), {
      target: { value: "cliente-sintetico@example.com" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Registrar interesse/i }));
    await waitFor(() => expect(screen.getByText("Pedido registrado!")).toBeTruthy());
    const savedLead = insert.mock.calls[0]?.[0] as { message: string };
    expect(savedLead.message).toContain("Serviço: Serviço de texto livre");
    expect(savedLead.message).not.toContain("Cidade inventada");
    fireEvent.click(screen.getByRole("button", { name: /Ver técnicos na minha região/i }));
    expect(directoryMock.navigate).toHaveBeenCalledWith({
      to: "/tecnicos", search: {
        especialidade: "Todas", servico: "",
        cidade: "", uf: "PR", bairro: "", regiao: "", prioridade: "",
      },
    });
  });
});
