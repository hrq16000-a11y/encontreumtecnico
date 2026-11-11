import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GUIDES } from "./public-guides";
import { GUIDE_FAQS, getGuideFaqs } from "./guide-faqs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Guias — navegação, FAQ e desempenho mobile", () => {
  it("mantém quatro perguntas originais por guia, sem conteúdo inventado", () => {
    expect(GUIDES).toHaveLength(6);
    expect(Object.keys(GUIDE_FAQS).sort()).toEqual(GUIDES.map(g => g.slug).sort());
    const questions = new Set<string>();
    for (const guide of GUIDES) {
      const faqs = getGuideFaqs(guide.slug);
      expect(faqs, guide.slug).toHaveLength(4);
      for (const item of faqs) {
        expect(item.question.length).toBeGreaterThan(35);
        expect(item.answer.length).toBeGreaterThan(105);
        expect(questions.has(item.question.toLocaleLowerCase("pt-BR"))).toBe(false);
        questions.add(item.question.toLocaleLowerCase("pt-BR"));
      }
    }
    expect(questions.size).toBe(24);
    expect(getGuideFaqs("../admin")).toHaveLength(0);
  });

  it("navega pelos cinco títulos, FAQ e relacionados sem mudar de página ou perder rascunhos", () => {
    const article = read("src/routes/guias.$slug.tsx");
    const nav = read("src/components/guide-reading-tools.tsx");
    expect(nav).toContain('href={"#secao-" + index}');
    expect(nav).toContain('href="#perguntas-frequentes"');
    expect(nav).toContain('href="#guias-relacionados"');
    expect(nav).toContain("aria-label=\"Seções deste guia\"");
    expect(article).toContain('id={"secao-" + index}');
    expect(article).toContain('id="guias-relacionados"');
    expect(article).toContain("<GuideReadingNavigation guide={guide} />");
    expect(article).toContain("<GuideFrequentlyAskedQuestions guide={guide} />");
    expect(nav).toContain("<details");
    expect(nav).toContain("<summary");
    expect(nav).not.toContain("FAQPage");
    expect(article).toContain('"@type": "Article"');
  });

  it("captura intenção pelo funil existente, sem telefone exposto ou envio prematuro", () => {
    const nav = read("src/components/guide-reading-tools.tsx");
    const cta = read("src/components/guide-lead-callout.tsx");
    const funnel = read("src/components/assistance-funnel.tsx");
    expect(nav).toContain("<GuideInlineHelpButton guide={guide} />");
    expect(cta).toContain("openFreeHelp");
    expect(cta).toContain('guideSlug: guide.slug');
    expect(cta).toContain('mode: "managed"');
    expect(cta).toContain("requestHelpForGuide(guide)");
    expect(funnel).toContain("if (requestError) throw requestError;");
    expect(funnel.indexOf("setSavedWhatsAppLead(lead);")).toBeGreaterThan(funnel.indexOf("if (requestError) throw requestError;"));
    expect(nav + cta).not.toMatch(/wa[.]me|api[.]whatsapp[.]com|tel:/i);
  });

  it("usa HTML simples, alvos acessíveis e prioridades de imagem adequadas ao mobile", () => {
    const article = read("src/routes/guias.$slug.tsx");
    const index = read("src/routes/guias.index.tsx");
    const nav = read("src/components/guide-reading-tools.tsx");
    expect(index).toContain('loading={index === 0 ? "eager" : "lazy"}');
    expect(index).toContain('fetchPriority={index === 0 ? "high" : "auto"}');
    expect(index).toContain('width={1200} height={630}');
    expect(index).toContain('decoding="async"');
    expect(article).toContain('loading="eager" decoding="async" fetchPriority="high"');
    expect(article).toContain('width={1200} height={630}');
    expect(article).toContain('scroll-mt-28');
    expect(nav).toContain('min-h-11');
    expect(nav).toContain('min-h-12');
    expect(nav).toContain('sm:grid-cols-2');
    expect(nav).not.toContain("useEffect");
    expect(nav).not.toContain("useState");
    const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["lucide-react"]).toBeTruthy();
  });
});
