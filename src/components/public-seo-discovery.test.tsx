import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PublicSeoDirectory, PublicProfileConnections } from "./public-seo-discovery";
import type { GraphProfile } from "@/lib/public-seo-graph";

vi.mock("@/components/technician-avatar", () => ({
  TechnicianAvatar: ({ name, avatarPath }: { name: string; avatarPath?: string | null }) =>
    <span role="img" aria-label={`Avatar de ${name}`} data-avatar={avatarPath ?? "iniciais"} />,
}));
afterEach(cleanup);

const photoPath = "avatars/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.webp";
const profiles: GraphProfile[] = [
  { public_slug: "ana-redes", display_name: "Ana Redes", city: "Curitiba", state_uf: "PR",
    specialties: ["redes"], service_slugs: ["wifi"], avatar_path: photoPath },
  { public_slug: "bruno-redes", display_name: "Bruno Redes", city: "Curitiba", state_uf: "PR",
    specialties: ["redes"], service_slugs: [], avatar_path: null },
];

describe("Diretórios públicos de cidades e categorias", () => {
  it("apresenta os avatares consentidos, links HTML e categorias com nomes legíveis na cidade", () => {
    const { container } = render(<PublicSeoDirectory heading="Técnicos em Curitiba/PR"
      summary="Dois profissionais cadastrados" context={{ kind: "city", label: "Curitiba/PR" }}
      profiles={profiles} categories={[{ slug: "redes", label: "Redes de computadores", count: 2, updated_at: null }]} />);

    expect(screen.getByRole("img", { name: "Avatar de Ana Redes" }).getAttribute("data-avatar")).toBe(photoPath);
    expect(screen.getByRole("img", { name: "Avatar de Bruno Redes" }).getAttribute("data-avatar")).toBe("iniciais");
    expect(container.querySelector('a[href="/categorias/redes"]')).not.toBeNull();
    expect(container.querySelector('a[href="/tecnicos/ana-redes"]')).not.toBeNull();
    expect(container.querySelector('a[href="/contato"]')).not.toBeNull();
    expect(screen.getByText("Quais serviços encontro em Curitiba/PR?")).toBeTruthy();
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("Curitiba/PR");
    expect(container.querySelector('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"]')).toBeNull();
  });

  it("mostra foto pública ou iniciais nos perfis relacionados, preservando os links e a privacidade", () => {
    const { container } = render(<PublicProfileConnections links={{
      city: { name: "Curitiba", uf: "PR", slug: "curitiba", count: 2, updated_at: null },
      categories: [{ slug: "redes", label: "Redes de computadores", count: 2, updated_at: null }],
      related: [
        { ...profiles[0]!, relation: "Mesmo município", relevance: 10 },
        { ...profiles[1]!, relation: "Categoria em comum", relevance: 4 },
      ],
    }} />);
    expect(screen.getByRole("img", { name: "Avatar de Ana Redes" }).getAttribute("data-avatar")).toBe(photoPath);
    expect(screen.getByRole("img", { name: "Avatar de Bruno Redes" }).getAttribute("data-avatar")).toBe("iniciais");
    expect(container.querySelector('a[href="/tecnicos/ana-redes"]')).not.toBeNull();
    expect(container.querySelector('a[href="/cidades/pr/curitiba"]')).not.toBeNull();
    expect(container.querySelector('a[href="/categorias/redes"]')).not.toBeNull();
    expect(container.querySelector('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"]')).toBeNull();
  });

  it("conecta a categoria a municípios reais sem prometer qualificação ou fabricar avaliações", () => {
    const { container } = render(<PublicSeoDirectory heading="Redes de computadores"
      summary="Perfis públicos" context={{ kind: "category", label: "Redes de computadores" }}
      profiles={profiles} cities={[{ name: "Curitiba", uf: "PR", slug: "curitiba", count: 2, updated_at: null }]} />);

    expect(container.querySelector('a[href="/cidades/pr/curitiba"]')).not.toBeNull();
    expect(screen.getByText("Ter perfil em Redes de computadores comprova qualificação?")).toBeTruthy();
    expect(container.textContent).not.toMatch(/5 estrelas|certificado pelo portal|telefone|avaliações verificadas/i);
  });
});
