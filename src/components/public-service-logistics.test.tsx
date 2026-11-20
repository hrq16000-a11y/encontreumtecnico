import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicServiceLogistics } from "./public-service-logistics";

function render(categorySlug: string, categoryName: string) {
  return renderToStaticMarkup(
    <PublicServiceLogistics categorySlug={categorySlug} categoryName={categoryName} />,
  );
}

describe("orientações públicas de deslocamento por especialidade", () => {
  it("explica deslocamento, locomoção, quilometragem e janelas sem prometer SLA", () => {
    const html = render("climatizacao", "Climatização");
    expect(html).toContain("Cobertura e meio de locomoção");
    expect(html).toContain("franquia em km");
    expect(html).toContain("tempo estimado para chegar");
    expect(html).toContain("GPS preciso");
    expect(html).toContain("não garante prazos");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("R$ 9,99");
  });

  it("contextualiza baterias somente onde há relação editorial, sem alegar especialidade comprovada", () => {
    for (const [slug, name] of [
      ["computadores", "Computadores e notebooks"],
      ["eletrica", "Elétrica"],
      ["baterias", "Baterias"],
    ]) {
      const html = render(slug, name);
      expect(html).toContain("Se o atendimento envolver baterias");
      expect(html).toContain("nobreak");
      expect(html).toContain("Não presuma que todo eletricista");
    }
    expect(render("redes", "Redes e conectividade")).not.toContain("Se o atendimento envolver baterias");
  });

  it("está integrado às duas rotas de categorias públicas, sem tocar em resultados privados", () => {
    for (const pathname of ["servicos.$categoria.tsx", "categorias.$categoria.tsx"]) {
      const route = readFileSync(new URL("../routes/" + pathname, import.meta.url), "utf-8");
      expect(route).toContain('import { PublicServiceLogistics }');
      expect(route).toContain('<PublicServiceLogistics categorySlug={category.slug}');
      expect(route).not.toContain("contact_phone");
    }
  });
});
