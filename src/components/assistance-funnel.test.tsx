import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistanceFunnel } from "./assistance-funnel";
import { guideDraftScope, portalHelpContext } from "@/lib/free-search-help";
import { readAssistanceDraft } from "@/lib/assistance-draft";

const directoryMock = vi.hoisted(() => ({
  draft: null as import("@/lib/assistance-draft").AssistanceDraft | null,
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
  readAssistanceDraft: vi.fn(() => directoryMock.draft),
  saveAssistanceDraft: vi.fn(),
  clearAssistanceDraft: vi.fn(),
}));

afterEach(() => {
  cleanup();
  directoryMock.draft = null;
  directoryMock.navigate.mockReset();
  vi.clearAllMocks();
});

describe("Localidade do atendimento guiado", () => {
  it("retoma a etapa e as edições do mesmo assunto sem reutilizar outro rascunho", async () => {
    const context = portalHelpContext("contato");
    vi.mocked(readAssistanceDraft).mockReturnValueOnce({
      mode: "managed", step: 2, name: "", email: "",
      service: "Redes e Wi-Fi", when: "Amanhã", problem: "Meu problema foi descrito antes de fechar.",
      city: "Curitiba", uf: "PR", neighborhood: "Centro",
    });
    render(<AssistanceFunnel context={context} onClose={vi.fn()} />);
    expect(readAssistanceDraft).toHaveBeenCalledWith("portal-contato-geral");
    expect(screen.getByRole("combobox", { name: "Estado (UF)" })).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("combobox", { name: "Município selecionado" }) as HTMLSelectElement).value).toBe("4106902"));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao problema" }));
    expect((screen.getByRole("combobox", { name: "Tipo de serviço" }) as HTMLInputElement).value).toBe("Redes e Wi-Fi");
    expect((screen.getByRole("textbox", { name: /Qual problema/i }) as HTMLTextAreaElement).value).toBe("Meu problema foi descrito antes de fechar.");
  });
  it("preserva as edições do pedido contextual de uma especialidade", () => {
    const scope = guideDraftScope("cftv");
    if (!scope) throw new Error("Missing canonical service scope");
    const context = { mode: "managed" as const, service: "CFTV e segurança", guideSlug: "instalacao-cameras", draftScope: scope };
    vi.mocked(readAssistanceDraft).mockReturnValueOnce({
      mode: "managed", step: 2, name: "", email: "", service: "Acesso remoto a câmeras",
      when: "Amanhã", problem: "Grava normalmente mas não funciona no celular.",
      city: "", uf: "", neighborhood: "",
    });
    render(<AssistanceFunnel context={context} onClose={vi.fn()} />);
    expect(readAssistanceDraft).toHaveBeenCalledWith("service-cftv");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao problema" }));
    expect((screen.getByRole("combobox", { name: "Tipo de serviço" }) as HTMLInputElement).value).toBe("Acesso remoto a câmeras");
    expect((screen.getByRole("textbox", { name: /Qual problema/i }) as HTMLTextAreaElement).value).toBe("Grava normalmente mas não funciona no celular.");
  });
  it("abre privacidade com intenção própria em vez do rascunho geral", () => {
    render(<AssistanceFunnel context={portalHelpContext("contato", "privacidade")} onClose={vi.fn()} />);
    expect(readAssistanceDraft).toHaveBeenCalledWith("portal-contato-privacidade");
    expect((screen.getByRole("textbox", { name: /Qual problema/i }) as HTMLTextAreaElement).value).toContain("privacidade ou meus dados pessoais");
  });
  it("preserva edição e etapa ao reabrir na mesma origem, acima do contexto inicial", async () => {
    directoryMock.draft = {mode: "managed", step: 2, name: "", email: "", service: "Formatação de notebooks", when: "Amanhã", problem: "Notebook reinicia durante o trabalho", city: "Florianópolis", uf: "SC", neighborhood: "Centro"};
    render(<AssistanceFunnel context={{mode: "direct", service: "Redes e Wi-Fi", city: "Curitiba", uf: "PR"}} onClose={vi.fn()} />);
    const uf = screen.getByRole("combobox", {name: "Estado (UF)"}) as HTMLInputElement;
    expect(uf.value).toBe("SC");
    await waitFor(() => expect((screen.getByRole("combobox", {name: "Município selecionado"}) as HTMLSelectElement).value).toBe("4205407"));
    fireEvent.click(screen.getByRole("button", {name: "Voltar ao problema"}));
    expect((screen.getByRole("combobox", {name: "Tipo de serviço"}) as HTMLInputElement).value).toBe("Formatação de notebooks");
    expect((screen.getByRole("textbox", {name: /Qual problema/}) as HTMLTextAreaElement).value).toBe("Notebook reinicia durante o trabalho");

  });
  it("encontra serviço ativo sem acentos e confirma pelo teclado, mantendo prazo até nova escolha", () => {
    render(<AssistanceFunnel context={{ mode: "managed" }} onClose={vi.fn()} />);
    const service = screen.getByRole("combobox", { name: "Tipo de serviço" }) as HTMLInputElement;
    fireEvent.change(service, { target: { value: "formatacao notebook" } });
    fireEvent.keyDown(service, { key: "ArrowDown" });
    fireEvent.keyDown(service, { key: "Enter" });
    expect(service.getAttribute("data-choice-value")).toBe("Formatação de notebooks");
    const timing = screen.getByRole("combobox", { name: "Para quando?" }) as HTMLInputElement;
    fireEvent.change(timing, { target: { value: "amanha" } });
    expect(timing.getAttribute("data-choice-value")).toBe("Nos próximos dias");
    fireEvent.keyDown(timing, { key: "Enter" });
    expect(timing.getAttribute("data-choice-value")).toBe("Amanhã");
  });
  it("aceita serviço fora do catálogo somente após confirmação explícita", () => {
    render(<AssistanceFunnel context={{ mode: "managed" }} onClose={vi.fn()} />);
    const service = screen.getByRole("combobox", { name: "Tipo de serviço" }) as HTMLInputElement;
    fireEvent.change(service, { target: { value: "Calibração especial" } });
    expect(service.getAttribute("data-choice-value")).toBe("");
    fireEvent.click(screen.getByRole("option", { name: /Usar outro serviço:.*Calibração especial/ }));
    expect(service.getAttribute("data-choice-value")).toBe("Calibração especial");
  });
  it("mantém o serviço específico vindo do perfil selecionado, sem trocá-lo por Outro serviço", () => {
    render(<AssistanceFunnel context={{ mode: "direct", technicianId: "00000000-0000-4000-8000-000000000001", technicianName: "Profissional de teste", service: "Formatação de notebooks" }} onClose={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Tipo de serviço" }) as HTMLInputElement;
    expect(select.value).toBe("Formatação de notebooks");
    expect(select.getAttribute("data-choice-value")).toBe("Formatação de notebooks");
    fireEvent.focus(select);
    fireEvent.change(select, { target: { value: "computadores" } });
    expect(select.getAttribute("data-choice-value")).toBe("");
    fireEvent.click(screen.getByRole("option", { name: /^Computadores e notebooks$/ }));
    expect(select.getAttribute("data-choice-value")).toBe("Computadores e notebooks");
  });
  it("pré-seleciona município IBGE e permite corrigir UF e cidade sem texto livre", async () => {
    render(<AssistanceFunnel context={{ mode: "managed", city: "Curitiba", uf: "PR" }} onClose={vi.fn()} />);
    const serviceChoice = screen.getByRole("combobox", { name: "Tipo de serviço" });
    fireEvent.change(serviceChoice, { target: { value: "computadores" } });
    fireEvent.click(screen.getByRole("option", { name: /^Computadores e notebooks$/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Qual problema/i }), {
      target: { value: "Notebook não conecta à rede sem fio há dois dias" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    const state = screen.getByRole("combobox", { name: "Estado (UF)" }) as HTMLInputElement;
    expect(state.value).toBe("PR");
    const officialCity = screen.getByRole("combobox", { name: "Município selecionado" }) as HTMLSelectElement;
    await waitFor(() => expect(officialCity.value).toBe("4106902"));
    expect(screen.queryByRole("textbox", { name: "Cidade (opcional)" })).toBeNull();
    fireEvent.change(state, { target: { value: "santa catarina" } });
    expect(state.getAttribute("data-choice-value")).toBe("PR");
    expect(officialCity.value).toBe("4106902");
    fireEvent.keyDown(state, { key: "ArrowDown" });
    fireEvent.keyDown(state, { key: "Enter" });
    expect(state.getAttribute("data-choice-value")).toBe("SC");
    expect(officialCity.value).toBe("");
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar município na lista oficial" }), {
      target: { value: "Flori" },
    });
    fireEvent.change(officialCity, { target: { value: "4205407" } });
    expect(officialCity.value).toBe("4205407");
    expect(screen.getByText("Código IBGE 4205407")).toBeTruthy();
  });

  it("não grava cidade inexistente vinda de sugestão ou contexto externo", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);
    render(<AssistanceFunnel context={{ mode: "managed", city: "Cidade inventada", uf: "PR" }} onClose={vi.fn()} />);
    const serviceChoice = screen.getByRole("combobox", { name: "Tipo de serviço" });
    fireEvent.change(serviceChoice, { target: { value: "computadores" } });
    fireEvent.click(screen.getByRole("option", { name: /^Computadores e notebooks$/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Qual problema/i }), {
      target: { value: "Meu notebook não conecta à rede sem fio há dois dias" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(screen.getByText(/Município informado ou sugerido/)).toBeTruthy();
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
    await waitFor(() => expect((screen.getByRole("combobox", {
      name: "Município selecionado",
    }) as HTMLSelectElement).value).toBe("4106902"));
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
    expect(screen.getByText(/Município informado ou sugerido/)).toBeTruthy();
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
