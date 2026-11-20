import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicSeoDirectory, PublicProfileConnections } from "./public-seo-discovery";
import { buildPublicGraph, relatedGraphProfiles } from "@/lib/public-seo-graph";

const graph = buildPublicGraph([
  { public_slug: "tecnica-curitiba", display_name: "Técnica de redes",
    city: "Curitiba", state_uf: "PR", specialties: ["redes"],
    service_slugs: ["wifi"] },
  { public_slug: "tecnico-curitiba", display_name: "Técnico em Wi-Fi",
    city: "Curitiba", state_uf: "PR", specialties: ["redes"],
    service_slugs: ["wifi"] },
], [{ name: "Curitiba", uf: "PR" }],
  [{ slug: "redes", label: "Redes de computadores" }]);

describe("HTML renderizado pelo servidor, sem hidratação nem dependência do navegador", () => {
  it("cidade produz links HTML rastreáveis aos técnicos e categoria canônica", () => {
    const html = renderToStaticMarkup(<PublicSeoDirectory
      heading="Técnicos em Curitiba/PR"
      summary="Dois perfis aprovados no município"
      profiles={graph.profiles}
      categories={graph.categories}
    />);
    expect(html).toContain("<h1");
    expect(html).toContain("Técnicos em Curitiba/PR");
    expect(html).toContain('href="/tecnicos/tecnica-curitiba"');
    expect(html).toContain('href="/tecnicos/tecnico-curitiba"');
    expect(html).toContain('href="/categorias/redes"');
    expect(html).not.toMatch(/wa\.me|telefone privado|data-ad-slot|contact_phone/i);
  });

  it("categoria produz links HTML para municípios e profissionais", () => {
    const html = renderToStaticMarkup(<PublicSeoDirectory
      heading="Técnicos de redes"
      summary="Área de atuação informada"
      profiles={graph.profiles}
      cities={graph.cities}
    />);
    expect(html).toContain('href="/cidades/pr/curitiba"');
    expect(html).toContain('href="/tecnicos/tecnica-curitiba"');
    expect(html).toContain('href="/tecnicos/tecnico-curitiba"');
    expect(html).not.toContain("contato protegido");
  });

  it("interliga apenas especialidades com perfis reais e conteúdo editorial publicado", () => {
    const html = renderToStaticMarkup(<PublicSeoDirectory
      heading="Técnicos em Curitiba/PR"
      summary="Perfis públicos"
      context={{ kind: "city", label: "Curitiba/PR" }}
      profiles={graph.profiles}
      categories={[
        ...graph.categories,
        { slug: "categoria-nao-editorial", label: "Sem guia", count: 1, updated_at: null },
      ]}
    />);
    expect(html).toContain("Como preparar um pedido de serviço em Curitiba/PR");
    expect(html).toContain("Diferencie queda da internet de falha de cobertura interna");
    expect(html).toContain('href="/servicos/redes"');
    expect(html).not.toContain('href="/servicos/categoria-nao-editorial"');
    expect(html).not.toMatch(/wa\.me|href="tel:|contact_phone|data-ad-slot/i);
  });

  it("categoria real aponta para orientações próprias, não para cidades inventadas", () => {
    const html = renderToStaticMarkup(<PublicSeoDirectory
      heading="Técnicos de redes"
      summary="Perfis públicos"
      context={{ kind: "category", label: "Redes de computadores", slug: "redes" }}
      profiles={graph.profiles}
      cities={graph.cities}
    />);
    expect(html).toContain('href="/servicos/redes"');
    expect(html).toContain('href="/cidades/pr/curitiba"');
    expect(html).not.toContain('href="/servicos/software"');
  });

  it("perfil só liga a outro técnico existente, nunca cria URL fictícia", () => {
    const related = relatedGraphProfiles(graph, graph.profiles[0]!, 6);
    const html = renderToStaticMarkup(<PublicProfileConnections links={{
      city: graph.cities[0]!, categories: graph.categories, related,
    }} />);
    expect(html).toContain('href="/cidades/pr/curitiba"');
    expect(html).toContain('href="/categorias/redes"');
    expect(html).toContain('href="/tecnicos/tecnico-curitiba"');
    expect(html).not.toContain('href="/tecnicos/tecnica-curitiba"');
    expect(html).toContain("Mesmo município");
  });

  it("sem relação verificada não injeta links vazios no perfil", () => {
    const html = renderToStaticMarkup(<PublicProfileConnections links={{
      city: null, categories: [], related: [],
    }} />);
    expect(html).toBe("");
  });
});
