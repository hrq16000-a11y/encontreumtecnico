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
    expect(screen.getByText(/Tubarão\/SC/)).toBeTruthy();
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

  it("só apresenta Bronze e indicação se vierem dos dados do perfil", () => {
    const { rerender } = render(<PublicTechnicianProfile technician={profile} />);
    expect(screen.queryByText("Pioneiro Bronze")).toBeNull();
    expect(screen.queryByText("Destaque por indicações")).toBeNull();
    rerender(<PublicTechnicianProfile technician={{ ...profile, pioneer_bronze: true, referral_highlight: true }} />);
    expect(screen.getByText("Pioneiro Bronze")).toBeTruthy();
    expect(screen.getByText("Destaque por indicações")).toBeTruthy();
  });
});
