import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV_GROUPS,
  matchingAdminNavKeys,
  nextAdminRecent,
  sanitizeAdminCollapsed,
  sanitizeAdminFavorites,
} from "./admin-navigation-preferences";
import { ADMIN_SECTIONS } from "./admin-sections";

describe("navegação administrativa aditiva", () => {
  it("organiza os 12 módulos existentes uma vez, sem criar rotas", () => {
    const keys = ADMIN_NAV_GROUPS.flatMap((group) => [...group.keys]);
    expect(keys).toHaveLength(ADMIN_SECTIONS.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining(ADMIN_SECTIONS.map((item) => item.key)));
  });

  it("filtra módulos por nome e descrição com acentuação normalizada", () => {
    expect(matchingAdminNavKeys("solicitacoes")).toEqual(["solicitacoes"]);
    expect(matchingAdminNavKeys("patrocinadores")).toContain("patrocinadores");
    expect(matchingAdminNavKeys("naoexiste-123")).toEqual([]);
    expect(matchingAdminNavKeys("")).toHaveLength(ADMIN_SECTIONS.length);
  });

  it("descarta favoritos desconhecidos, repetidos e valores adulterados", () => {
    expect(
      sanitizeAdminFavorites([
        "tecnicos",
        "tecnicos",
        "../admin",
        "__proto__",
        null,
        4,
        "mensagens",
      ]),
    ).toEqual(["tecnicos", "mensagens"]);
    expect(sanitizeAdminFavorites("tecnicos")).toEqual([]);
    expect(sanitizeAdminFavorites(null)).toEqual([]);
  });

  it("mantém apenas IDs válidos dos grupos recolhidos", () => {
    expect(
      sanitizeAdminCollapsed({ geral: true, atendimento: false, operacao: true, falso: true }),
    ).toEqual({ geral: true, operacao: true });
    expect(sanitizeAdminCollapsed(["geral"])).toEqual({});
    expect(sanitizeAdminCollapsed(null)).toEqual({});
  });

  it("guarda os últimos módulos sem repetir chaves nem aceitar rotas adulteradas", () => {
    expect(nextAdminRecent(["tecnicos", "clientes", "tecnicos", "../admin"], "clientes")).toEqual([
      "clientes",
      "tecnicos",
    ]);
    expect(nextAdminRecent(["tecnicos", "clientes", "mensagens", "catalogo"], "inicio")).toEqual([
      "inicio",
      "tecnicos",
      "clientes",
      "mensagens",
    ]);
  });
});
