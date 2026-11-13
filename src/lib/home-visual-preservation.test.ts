import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const home = readFileSync("src/routes/index.tsx", "utf8");
const header = readFileSync("src/components/site-header.tsx", "utf8");
const footer = readFileSync("src/components/site-footer.tsx", "utf8");
const services = readFileSync("src/routes/servicos.tsx", "utf8");
const admin = readFileSync("src/routes/admin.tsx", "utf8");

const images = [
  "cftv-planejamento-ilustrado.svg",
  "computador-diagnostico-ilustrado.svg",
  "wifi-instabilidade-cobertura-ilustrado.svg",
] as const;

describe("Identidade visual: adição sem remoção das imagens existentes", () => {
  it("preserva as duas fotografias originais da Home", () => {
    expect(home).toContain('src={heroImg}');
    expect(home).toContain('src={techImg}');
    expect(home).toContain('tecnico-cftv-instalacao.jpg');
    expect(home).toContain('tecnica-informatica.jpg');
  });

  it("adiciona três ilustrações locais leves, com alt, dimensões e carregamento diferido", () => {
    expect(home).toContain("HOME_VISUALS.map");
    expect(home).toContain('loading="lazy" decoding="async"');
    expect(home).toContain('width={1200} height={630}');
    for (const image of images) {
      const source = readFileSync("public/guias/" + image, "utf8");
      expect(source).toContain("<svg");
      expect(source).toContain("<title");
      expect(source.length).toBeLessThan(10000);
      expect(home).toContain("/guias/" + image);
    }
  });

  it("aplica ícones aos menus e botões mantendo rotas e guardas existentes", () => {
    expect(header).toContain('aria-label="Navegação principal"');
    expect(header).toContain('aria-label="Navegação móvel"');
    expect(header).toContain('<Icon className="h-4 w-4 shrink-0"');
    expect(footer).toContain('aria-label="Navegação do portal"');
    expect(footer).toContain("<BookOpen");
    expect(services).toContain("SERVICE_ICONS");
    expect(services).toContain("<ServiceIcon slug={service.slug}");
    expect(admin).toContain("roles.includes(\"admin\")");
    expect(admin).toContain('<item.icon className="mr-2');
    expect(admin).toContain('noindex, nofollow');
  });

  it("mantém os dois campos da busca flexíveis e o exemplo curto em larguras intermediárias", () => {
    const form = home.slice(home.indexOf("<form"), home.indexOf("</form>") + 7);
    expect(form).toContain('placeholder="Especialidade (ex.: CFTV)"');
    expect(form).toContain('htmlFor="busca-especialidade"');
    expect(form).toContain('htmlFor="busca-cidade"');
    expect(form.match(/min-w-0 w-full sm:w-auto sm:flex-1/g)).toHaveLength(2);
    expect(form).not.toContain("w-full shrink-0 sm:w-auto sm:flex-1");
    expect(form).toContain('<Search className="h-4 w-4" aria-hidden="true" /> Buscar');
  });
});
