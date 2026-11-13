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
  "impressora-offline-fila-ilustrado.svg",
] as const;

describe("Identidade visual: adição sem remoção das imagens existentes", () => {
  it("preserva as duas fotografias originais da Home", () => {
    expect(home).toContain('src={heroImg}');
    expect(home).toContain('src={techImg}');
    expect(home).toContain('tecnico-cftv-instalacao.jpg');
    expect(home).toContain('tecnica-informatica.jpg');
  });

  it("mantém ilustrações locais leves e acrescenta a quarta arte editorial", () => {
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

  it("destaca visualmente a primeira tela e aproxima as artes dos serviços do topo", () => {
    expect(home).toContain('bg-gradient-to-br from-brand-navy');
    expect(home).toContain('rounded-3xl border border-white/15 bg-card');
    expect(home).toContain('sm:grid-cols-2 lg:grid-cols-4');
    const hero = home.indexOf('bg-gradient-to-br from-brand-navy');
    const illustrations = home.indexOf('aria-labelledby="home-visual-servicos"');
    const channels = home.indexOf('<CanaisDeAtendimento />');
    const proof = home.indexOf('<HomePublicProof />');
    expect(hero).toBeGreaterThan(0);
    expect(illustrations).toBeGreaterThan(hero);
    expect(illustrations).toBeLessThan(channels);
    expect(channels).toBeLessThan(proof);
    expect(home.match(/aria-labelledby="home-visual-servicos"/g)).toHaveLength(1);
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
});
