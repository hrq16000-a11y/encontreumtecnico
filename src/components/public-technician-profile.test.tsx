import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { openFreeHelp } from "@/lib/free-search-help";
import { PublicTechnicianProfile } from "./public-technician-profile";
import type { PublicTechnician } from "@/lib/technicians.functions";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children }: { to: string; params?: { tecnicoId?: string }; children: React.ReactNode }) =>
    <a href={to.replace("$tecnicoId", params?.tecnicoId ?? "")}>{children}</a>,
}));
vi.mock("@/lib/free-search-help", () => ({ openFreeHelp: vi.fn() }));
vi.mock("@/hooks/use-active-categories", () => ({
  useActiveCategories: () => ({ categories: [] }),
  categoryLabel: (slug: string) => slug,
}));
vi.mock("@/hooks/use-active-services", () => ({
  useActiveServices: () => ({ services: [] }),
  serviceLabel: (slug: string) => slug,
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

  it("só apresenta Bronze e indicação se vierem dos dados do perfil", () => {
    const { rerender } = render(<PublicTechnicianProfile technician={profile} />);
    expect(screen.queryByText("Pioneiro Bronze")).toBeNull();
    expect(screen.queryByText("Destaque por indicações")).toBeNull();
    rerender(<PublicTechnicianProfile technician={{ ...profile, pioneer_bronze: true, referral_highlight: true }} />);
    expect(screen.getByText("Pioneiro Bronze")).toBeTruthy();
    expect(screen.getByText("Destaque por indicações")).toBeTruthy();
  });

  it("não infere nome a partir do apelido, Bronze ou outros dados públicos", () => {
    render(<PublicTechnicianProfile technician={{ ...profile, display_name: "alexpaixao13", pioneer_bronze: true }} />);
    expect(screen.getByRole("heading", { name: "alexpaixao13" })).toBeTruthy();
    expect(screen.queryByText(/Nome sugerido \(não verificado\)/)).toBeNull();
  });

  it("prepara o nome não verificado apenas quando recebe vínculo WordPress pós-R2", () => {
    const original = { ...profile, display_name: "almeidathiagosantos5", public_slug: "almeidathiagosantos5" };
    const { container, rerender } = render(<PublicTechnicianProfile
      technician={original} provenanceLinkedWordPressAlias="almeidathiagosantos5" />);
    expect(screen.getByRole("heading", { name: "Almeida Thiago Santos" })).toBeTruthy();
    expect(screen.getByText(/apelido original: almeidathiagosantos5/)).toBeTruthy();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('a[href*="wa.me"]')).toBeNull();

    // The old alias is not evidence of ownership once the published name is edited.
    rerender(<PublicTechnicianProfile technician={{ ...original, display_name: "Nome Declarado" }}
      provenanceLinkedWordPressAlias="almeidathiagosantos5" />);
    expect(screen.getByRole("heading", { name: "Nome Declarado" })).toBeTruthy();
    expect(screen.queryByText(/Nome sugerido \(não verificado\)/)).toBeNull();
  });
});
