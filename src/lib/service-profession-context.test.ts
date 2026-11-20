import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SERVICE_CATEGORIES } from "./service-catalog";
import { getServiceProfessionContext, SERVICE_PROFESSION_CONTEXT } from "./service-profession-context";

describe("Profissões e formação nas páginas canônicas de categoria", () => {
  it("oferece contexto editorial distinto para todas as categorias publicadas, sem criar novas rotas", () => {
    const canonical = SERVICE_CATEGORIES.map(category => category.slug).sort();
    expect(Object.keys(SERVICE_PROFESSION_CONTEXT).sort()).toEqual(canonical);
    for (const category of SERVICE_CATEGORIES) {
      const context = getServiceProfessionContext(category.slug);
      expect(context.professionalRoles.length).toBeGreaterThanOrEqual(2);
      expect(context.typicalRequests.length).toBeGreaterThanOrEqual(3);
      expect(context.knowledgeAreas.length).toBeGreaterThanOrEqual(3);
      expect(context.trainingHint.length).toBeGreaterThan(70);
      expect(new Set([...context.professionalRoles, ...context.typicalRequests, ...context.knowledgeAreas]).size)
        .toBe(context.professionalRoles.length + context.typicalRequests.length + context.knowledgeAreas.length);
    }
  });

  it("mostra profissões, exemplos de serviços, conhecimentos e cursos sem atribuir certificados a técnicos", () => {
    const route = readFileSync("src/routes/servicos.$categoria.tsx", "utf8");
    expect(route).toContain("getServiceProfessionContext(category.slug)");
    expect(route).toContain("professionalContext.professionalRoles.map");
    expect(route).toContain("professionalContext.typicalRequests.map");
    expect(route).toContain("professionalContext.knowledgeAreas.map");
    expect(route).toContain("{professionalContext.trainingHint}");
    expect(route).toContain("não qualificações atribuídas aos profissionais cadastrados");
    expect(route).toContain("getEnrichedServiceCategory(params.categoria)");
    expect(route).toContain("listApprovedTechnicians");
    expect(route).toContain('to="/tecnicos" search={directorySearch}');
  });
});
