import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PublicTechnician } from "@/lib/technicians.functions";
import { TechnicianSearchCard } from "./technician-search-card";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children, ...props }: {
    to: string; params?: { tecnicoId: string }; children: React.ReactNode; [key: string]: unknown;
  }) => <a href={to.replace("$tecnicoId", params?.tecnicoId || "")}
    aria-label={typeof props["aria-label"] === "string" ? props["aria-label"] : undefined}>{children}</a>,
}));
vi.mock("@/components/technician-avatar", () => ({
  TechnicianAvatar: ({ name, avatarPath }: { name: string; avatarPath: string | null }) =>
    <div role="img" aria-label={"Avatar de " + name} data-avatar={avatarPath ?? "sem-foto"} />,
}));
vi.mock("@/hooks/use-active-categories", () => ({
  categoryLabel: (slug: string) => slug,
}));
vi.mock("@/hooks/use-active-services", () => ({
  serviceLabel: (slug: string) => slug,
}));
afterEach(cleanup);

const person: PublicTechnician = {
  id: "00000000-0000-4000-8000-000000000001",
  public_slug: "jefferson-santana",
  display_name: "Jefferson Santana",
  specialties: ["computadores", "redes", "impressoras", "cftv"],
  service_slugs: ["wifi", "formatacao", "backup", "outros"],
  state_uf: "SC", city: "Tubarão", neighborhood: "Passo do Gado", region: null,
  bio: null, avatar_path: "avatars/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.webp",
  service_radius_km: 15, coverage_city_ids: [1],
  coverage_cities: [{ id: 1, name: "Tubarão", uf: "SC" }],
  online_now: false, pioneer_bronze: false, referral_highlight: false,
};

const categories: any[] = [];
const services: any[] = [];

describe("Cartão do técnico publicado", () => {
  it("exibe foto real quando há avatar permitido, nome, região, serviços e rota amigável", () => {
    const { container } = render(<TechnicianSearchCard technician={person} categories={categories} services={services} />);
    const link = screen.getByRole("link", { name: /Ver perfil e serviços de Jefferson Santana/ });
    expect(link.getAttribute("href")).toBe("/tecnicos/jefferson-santana");
    expect(screen.getByRole("img", { name: "Avatar de Jefferson Santana" }).getAttribute("data-avatar")).toBe(person.avatar_path);
    expect(container.textContent).toContain("Tubarão/SC");
    expect(container.textContent).toContain("+1 áreas");
    expect(container.textContent).toContain("+1 serviços");
    expect(container.textContent).toContain("Contato privado protegido");
    expect(container.textContent).not.toMatch(/5 estrelas|avaliado por clientes|técnico verificado/i);
    expect(container.textContent).not.toMatch(/\+55\d{10,11}/);
  });

  it("não distingue técnicos por origem e preserva indicação e atividade informadas", () => {
    const { rerender } = render(<TechnicianSearchCard technician={person} categories={categories} services={services} />);
    expect(screen.queryByText("Pioneiro Bronze")).toBeNull();
    expect(screen.queryByText("Destaque por indicações")).toBeNull();
    rerender(<TechnicianSearchCard technician={{ ...person, pioneer_bronze: true, referral_highlight: true, online_now: true }} categories={categories} services={services} />);
    expect(screen.queryByText("Pioneiro Bronze")).toBeNull();
    expect(screen.getByText("Destaque por indicações")).toBeTruthy();
    expect(screen.getByText("Atividade recente")).toBeTruthy();
  });

  it("não inventa foto, cidade de cobertura ou atividade online ausentes", () => {
    const { container } = render(<TechnicianSearchCard
      technician={{ ...person, avatar_path: null, coverage_cities: [], service_radius_km: null, online_now: false }}
      categories={categories} services={services} />);
    expect(screen.getByRole("img", { name: "Avatar de Jefferson Santana" }).getAttribute("data-avatar")).toBe("sem-foto");
    expect(container.textContent).not.toContain("Cidades declaradas");
    expect(screen.queryByText("Atividade recente")).toBeNull();
  });
});
