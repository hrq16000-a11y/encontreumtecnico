import { describe, expect, it } from "vitest";
import { adminResultHref, cleanAdminQuery } from "./admin-search";

describe("Pesquisa administrativa unificada", () => {
  it("limpa operadores PostgREST e preserva nomes brasileiros", () => {
    expect(cleanAdminQuery("  João, Silva%_ \n (SP)  ")).toBe("João Silva SP");
    expect(cleanAdminQuery("Cruzeiro do Sul")).toBe("Cruzeiro do Sul");
    expect(cleanAdminQuery("a".repeat(200))).toHaveLength(70);
  });
  it("abre o módulo de destino com filtro codificado", () => {
    expect(adminResultHref("tecnicos", "João & Maria")).toBe("/admin/tecnicos?q=Jo%C3%A3o%20%26%20Maria");
    expect(adminResultHref("solicitacoes", "Rede doméstica")).toContain("/admin/solicitacoes?q=");
  });
});
