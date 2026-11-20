import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { openFreeHelp } from "@/lib/free-search-help";
import { PublicTechnicianProfile } from "./public-technician-profile";
import type { PublicTechnician } from "@/lib/technicians.functions";
import { EMPTY_OPERATIONS } from "@/lib/technician-operations-contract";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, search, children, ...rest }: { to: string; params?: { tecnicoId?: string }; search?: { cidade?: string; uf?: string; especialidade?: string }; children: React.ReactNode; className?: string; "aria-label"?: string }) =>
    <a href={to.replace("$tecnicoId", params?.tecnicoId ?? "")} data-city={search?.cidade} data-uf={search?.uf} data-specialty={search?.especialidade} {...rest}>{children}</a>,
}));
vi.mock("@/lib/free-search-help", () => ({ openFreeHelp: vi.fn() }));
vi.mock("@/hooks/use-active-categories", () => ({
  useActiveCategories: () => ({ categories: [{ slug: "computadores", label: "Computadores", description: "" }, { slug: "redes", label: "Redes", description: "" }] }),
  categoryLabel: (slug: string) => slug,
}));
vi.mock("@/hooks/use-active-services", () => ({
  useActiveServices: () => ({ services: [
    { slug: "formatacao", category_slug: "computadores", label: "Formatação" },
    { slug: "notebooks", category_slug: "computadores", label: "Notebooks" },
    { slug: "wifi", category_slug: "redes", label: "Rede Wi-Fi" },
  ] }),
  serviceLabel: (slug: string) => slug === "manutencao" ? "Manutenção" : slug,
}));

afterEach(() => cleanup());

const profile: PublicTechnician = {
  id: "00000000-0000-4000-8000-000000000001",
  public_slug: "jefferson-santana",
  display_name: "Jefferson Santana",
  specialties: ["computadores", "redes"],
  service_slugs: ["formatacao", "wifi", "notebooks"],
  city: "Tubarão",
  state_uf: "SC",
  neighborhood: "Passo do Gado",
  region: null,
  bio: "Atendimento informado pelo profissional.",
  avatar_path: null,
  service_radius_km: null,
  coverage_city_ids: [],
  coverage_cities: [],
  online_now: false,
  pioneer_bronze: false,
  referral_highlight: false,
};

describe("Perfil técnico premium sem prova social fabricada", () => {
  it("agrupa serviços de múltiplas especialidades sem perder o pedido contextual", () => {
    render(<PublicTechnicianProfile technician={profile} />);
    const computadores = screen.getByRole("group", { name: "Serviços de Computadores" });
    const redes = screen.getByRole("group", { name: "Serviços de Redes" });
    expect(within(computadores).getByRole("button", { name: "Solicitar atendimento para formatacao" })).toBeTruthy();
    expect(within(computadores).getByRole("button", { name: "Solicitar atendimento para notebooks" })).toBeTruthy();
    fireEvent.click(within(redes).getByRole("button", { name: "Solicitar atendimento para wifi" }));
    expect(openFreeHelp).toHaveBeenCalledWith({
      mode: "direct", technicianId: profile.id, technicianName: profile.display_name, service: "wifi",
    });
  });
  it("mantém serviços legados sem categoria reconhecida, sem atribuir qualificação fictícia", () => {
    render(<PublicTechnicianProfile technician={{
      ...profile, service_slugs: ["formatacao", "servico-legado", "wifi"],
    }} />);
    const outros = screen.getByRole("group", { name: "Serviços de Outros serviços declarados" });
    fireEvent.click(within(outros).getByRole("button", { name: "Solicitar atendimento para servico-legado" }));
    expect(openFreeHelp).toHaveBeenCalledWith(expect.objectContaining({ service: "servico-legado" }));
    expect(screen.getAllByRole("button", { name: /Solicitar atendimento para/ })).toHaveLength(3);
  });
  it("filtra listas grandes de serviços sem perder a ação específica nem esconder a lista por padrão", () => {
    render(<PublicTechnicianProfile technician={{ ...profile, service_slugs: [
      "wifi", "notebooks", "impressao", "cabeamento", "manutencao", "cftv", "redes",
    ] }} />);
    expect(screen.getAllByRole("button", { name: /Solicitar atendimento para / })).toHaveLength(7);
    const filter = screen.getByRole("searchbox", { name: "Encontrar serviço neste perfil" });
    fireEvent.change(filter, { target: { value: "MANUTENCAO" } });
    expect(screen.getAllByRole("button", { name: /Solicitar atendimento para / })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Solicitar atendimento para Manutenção" }));
    expect(openFreeHelp).toHaveBeenCalledWith(expect.objectContaining({ service: "Manutenção", technicianId: profile.id }));
    fireEvent.change(filter, { target: { value: "inexistente" } });
    expect(screen.getByText(/Nenhum serviço deste perfil corresponde/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtro" }));
    expect(screen.getAllByRole("button", { name: /Solicitar atendimento para / })).toHaveLength(7);
  });
  it("encontra serviços pelo nome da especialidade oficial sem atribuir categoria a legados", () => {
    render(<PublicTechnicianProfile technician={{ ...profile, service_slugs: [
      "formatacao", "notebooks", "wifi", "servico-legado", "cftv", "cabeamento",
    ] }} />);
    const filter = screen.getByRole("searchbox", { name: "Encontrar serviço neste perfil" });
    fireEvent.change(filter, { target: { value: "COMPUTADORES" } });
    expect(screen.getAllByRole("button", { name: /Solicitar atendimento para / })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Solicitar atendimento para formatacao" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Solicitar atendimento para notebooks" })).toBeTruthy();
    fireEvent.change(filter, { target: { value: "REDES" } });
    expect(screen.getAllByRole("button", { name: /Solicitar atendimento para / })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Solicitar atendimento para wifi" })).toBeTruthy();
    fireEvent.change(filter, { target: { value: "" } });
    expect(screen.getAllByRole("button", { name: /Solicitar atendimento para / })).toHaveLength(6);
  });
  it("não acrescenta filtro a perfis com poucos serviços", () => {
    render(<PublicTechnicianProfile technician={profile} />);
    expect(screen.queryByRole("searchbox", { name: "Encontrar serviço neste perfil" })).toBeNull();
  });
  it("abre o atendimento com o serviço específico escolhido e a ficha técnica correta", () => {
    render(<PublicTechnicianProfile technician={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "Solicitar atendimento para wifi" }));
    expect(openFreeHelp).toHaveBeenCalledWith({
      mode: "direct", technicianId: profile.id, technicianName: profile.display_name, service: "wifi",
    });
    expect(screen.queryByRole("link", { name: /telefone|WhatsApp/i })).toBeNull();
  });
  it("interliga municípios adicionais ao filtro oficial sem inferir localização precisa", () => {
    render(<PublicTechnicianProfile technician={{ ...profile, coverage_cities: [
      { id: 4207304, name: "Imbituba", uf: "SC" },
    ] }} />);
    const cityLink = screen.getByRole("link", { name: "Ver técnicos em Imbituba/SC" });
    expect(cityLink.getAttribute("href")).toBe("/tecnicos");
    expect(cityLink.getAttribute("data-city")).toBe("Imbituba");
    expect(cityLink.getAttribute("data-uf")).toBe("SC");
    expect(screen.queryByRole("link", { name: /telefone|WhatsApp/i })).toBeNull();
  });
  it("compartilha somente a URL pública, sem parâmetros privados, e confirma a cópia", async () => {
    const previousUrl = window.location.href;
    const previousClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const writeText = vi.fn().mockResolvedValue(undefined);
    try {
      window.history.replaceState(null, "", "/tecnico/jefferson-santana?email=privado#sobre");
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
      render(<PublicTechnicianProfile technician={profile} />);
      fireEvent.click(screen.getByRole("button", { name: "Copiar link do perfil" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/tecnico/jefferson-santana`));
      expect(screen.getByRole("status").textContent).toMatch(/Link público copiado/);
    } finally {
      window.history.replaceState(null, "", previousUrl);
      if (previousClipboard) Object.defineProperty(navigator, "clipboard", previousClipboard);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });
  it("mostra nome, localização, quantidades reais e solicitação protegida", () => {
    const { container } = render(<PublicTechnicianProfile technician={profile} />);
    expect(screen.getByRole("heading", { name: "Jefferson Santana" })).toBeTruthy();
    expect(screen.getAllByText(/Tubarão\/SC/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getAllByText("Descrever meu problema").length).toBeGreaterThan(0);
    expect(container.textContent).toContain("O pagamento está pausado");
    expect(container.querySelector('a[href^="/acesso-contato/"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Solicitar contato via atendimento/i }));
    expect(openFreeHelp).toHaveBeenCalledWith(expect.objectContaining({
      mode: "direct", technicianId: profile.id, technicianName: profile.display_name,
    }));
    expect(container.textContent).not.toMatch(/5 estrelas|avaliado por clientes|técnico verificado/i);
    expect(container.textContent).not.toMatch(/\+55\d{10,11}/);
  });

  it("permite buscar pela especialidade ativa e mantém categoria legada sem link", () => {
    render(<PublicTechnicianProfile technician={{ ...profile, specialties: ["computadores", "categoria-legada"] }} />);
    const link = screen.getByRole("link", { name: "Buscar técnicos de computadores" });
    expect(link.getAttribute("href")).toBe("/tecnicos");
    expect(link.getAttribute("data-specialty")).toBe("computadores");
    expect(screen.queryByRole("link", { name: /categoria-legada/i })).toBeNull();
    expect(screen.getAllByText("categoria-legada").length).toBeGreaterThan(0);
  });

  it("oferece navegação acessível pelo perfil e mantém o contato fora do HTML público", () => {
    const { container } = render(<PublicTechnicianProfile technician={profile} />);
    const nav = screen.getByRole("navigation", { name: "Seções deste perfil" });
    const targets = Array.from(nav.querySelectorAll("a")).map(link => link.getAttribute("href"));
    expect(targets).toEqual(["#especialidades", "#servicos", "#atendimento", "#sobre"]);
    for (const target of targets) {
      expect(container.querySelector(target!)).not.toBeNull();
    }
    expect(screen.getByRole("link", { name: /Conhecer os serviços/i }).getAttribute("href")).toBe("#servicos");
    expect(screen.getAllByRole("link", { name: /Descrever meu problema/i }).length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(container.querySelector('a[href*="wa.me"]')).toBeNull();
  });

  it("mantém a seção Sobre visível quando não há apresentação pública", () => {
    render(<PublicTechnicianProfile technician={{ ...profile, bio: null }} />);
    expect(screen.getByRole("heading", { name: "Sobre o profissional" })).toBeTruthy();
    expect(screen.getByText(/A apresentação pessoal ainda não está disponível/)).toBeTruthy();
    expect(screen.queryByText("Texto fornecido pelo titular do perfil.")).toBeNull();
  });

  it("omite seção de condições quando não há declaração operacional", () => {
    const { rerender } = render(<PublicTechnicianProfile technician={{ ...profile, operations: EMPTY_OPERATIONS }} />);
    expect(screen.queryByRole("heading", { name: "Como costuma atender" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Condições" })).toBeNull();
    rerender(<PublicTechnicianProfile technician={{ ...profile,
      operations: { ...EMPTY_OPERATIONS, free_km: 0 },
    }} />);
    expect(screen.getByRole("heading", { name: "Como costuma atender" })).toBeTruthy();
    expect(screen.getByText(/Até 0 km declarados/)).toBeTruthy();
  });
  it("renderiza somente condições estruturadas sem expor contato privado ou prometer SLA", () => {
    const { container } = render(<PublicTechnicianProfile technician={{ ...profile,
      coverage_city_ids: [4204608], coverage_cities: [{ id: 4204608, name: "Criciúma", uf: "SC" }],
      operations: { ...EMPTY_OPERATIONS, equipment: ["notebook", "cable_tester"],
        transport_mode: "car", service_windows: ["evening", "holiday"],
        eta_outside_minutes: 60, free_city_ids: [4204608], km_rate_cents: 250 },
    }} />);
    expect(screen.getByRole("heading", { name: "Como costuma atender" })).toBeTruthy();
    expect(container.textContent).toContain("Notebook para diagnóstico");
    expect(container.textContent).toContain("Noite");
    expect(container.textContent).toContain("R$ 2,50 por km");
    expect(container.textContent).toContain("sujeito à agenda");
    expect(container.textContent).toContain("Criciúma/SC");
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('a[href*="wa.me"]')).toBeNull();
  });

  it("não diferencia técnicos por origem e preserva indicação informada", () => {
    const { rerender } = render(<PublicTechnicianProfile technician={profile} />);
    expect(screen.queryByText("Pioneiro Bronze")).toBeNull();
    expect(screen.queryByText("Destaque por indicações")).toBeNull();
    rerender(<PublicTechnicianProfile technician={{ ...profile, pioneer_bronze: true, referral_highlight: true }} />);
    expect(screen.queryByText("Pioneiro Bronze")).toBeNull();
    expect(screen.getByText("Destaque por indicações")).toBeTruthy();
  });
  it("organiza a apresentação declarada em cartões legíveis sem fabricar documentos ou qualificações", () => {
    const richBio = [
      "Atendimento profissional em redes.",
      "Minha experiência: Redes de pequenos escritórios.",
      "Ferramentas e equipamentos: Testador de cabos.",
      "Como me desloco para atender: Carro, mediante confirmação.",
      "Horários em que costumo atender: Dias úteis.",
    ].join("\n");
    const { container } = render(<PublicTechnicianProfile technician={{ ...profile, bio: richBio }} />);
    expect(screen.getByRole("heading", { name: "Ferramentas" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Deslocamento" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Disponibilidade" })).toBeTruthy();
    expect(screen.getByText("Atendimento profissional em redes.")).toBeTruthy();
    expect(screen.getByText("Testador de cabos.")).toBeTruthy();
    expect(screen.getByText("Carro, mediante confirmação.")).toBeTruthy();
    expect(container.textContent).not.toMatch(/habilitação certificada|garantia de chegada|\bCNH\b|\bASO\b/i);
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it("não exibe um atributo operacional que o técnico deixou vazio", () => {
    render(<PublicTechnicianProfile technician={{ ...profile, bio: "Ferramentas e equipamentos: \nMinha experiência: Manutenção de computadores." }} />);
    expect(screen.getByRole("heading", { name: "Experiência" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Ferramentas" })).toBeNull();
  });

});
