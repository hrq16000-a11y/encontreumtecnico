import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { GUIDE_ARTWORK, getExactGuideArtwork, getDeclaredServiceIllustrations } from "./guide-artwork";
import { SERVICE_CATEGORIES, getEnrichedServiceCategory } from "./service-catalog";

describe("imagens originais nas páginas de serviços e perfis", () => {
  it("usa apenas ilustrações editoriais locais, sem código ativo e sem imagens inventadas", () => {
    for (const [slug, art] of Object.entries(GUIDE_ARTWORK)) {
      expect(SERVICE_CATEGORIES.some(item => item.slug === slug)).toBe(true);
      expect(art.src).toMatch(/^\/(?:guias|servicos)\/[a-z0-9-]+\.svg$/);
      const file = "public" + art.src, svg = readFileSync(file, "utf8");
      expect(statSync(file).size).toBeLessThan(15000);
      expect(svg).toContain("<title");
      expect(svg).toContain("<desc");
      expect(svg).not.toMatch(/<script|<foreignObject|\bonload\s*=/i);
      expect(getExactGuideArtwork(slug)?.src).toBe(art.src);
    }
  });
  it("não usa fallback de computadores para elétrica, gráfico ou slugs desconhecidos", () => {
    for (const slug of ["eletrica", "design-grafico", "../admin", "", "novo-servico"]) {
      expect(getExactGuideArtwork(slug)).toBeNull();
    }
    expect(getDeclaredServiceIllustrations(["eletrica", "design-grafico"])).toEqual([]);
  });
  it("limita desenhos às especialidades declaradas e com conteúdo próprio", () => {
    const drawings = getDeclaredServiceIllustrations(["redes", "computadores", "redes", "cftv", "software"]);
    expect(drawings.map(x => x.slug)).toEqual(["redes", "computadores", "cftv"]);
    expect(drawings.every(x => Boolean(getEnrichedServiceCategory(x.slug)))).toBe(true);
    expect(getDeclaredServiceIllustrations(["cftv", "redes"], 0)).toEqual([]);
  });
  it("preserva SPA, contato protegido, CTA touch e motion reduzido nos dois componentes", () => {
    const listing = readFileSync("src/routes/servicos.tsx", "utf8");
    const profile = readFileSync("src/components/public-technician-profile.tsx", "utf8");
    expect(listing).toContain("getExactGuideArtwork(service.slug)");
    expect(listing).toContain('to="/servicos/$categoria"');
    expect(listing).toContain('to="/tecnicos"');
    expect(listing).toContain('width={1200} height={630}');
    expect(listing).toContain('loading="lazy" decoding="async"');
    expect(listing).toContain("motion-reduce:transform-none");
    expect(profile).toContain('getDeclaredServiceIllustrations(t.specialties)');
    expect(profile).toContain("Ilustrações editoriais dos assuntos");
    expect(profile).toContain('aria-label="Ilustrações educativas das áreas declaradas"');
    expect(profile).toContain('to="/area-cliente"');
    expect(profile).toContain("openFreeHelp(");
    expect(profile).toContain('motion-reduce:transform-none');
    expect(listing).not.toMatch(/wa\.me|tel:|mailto:|contact_phone/);
  });
});
