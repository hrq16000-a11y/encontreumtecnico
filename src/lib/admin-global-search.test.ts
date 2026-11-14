import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { adminSearchUrl, cleanAdminSearch, matchingAdminModules } from "./admin-global-search";

describe("busca unificada do painel administrativo", () => {
  it("localiza qualquer módulo por nome sem depender do banco", () => {
    expect(matchingAdminModules("")).toHaveLength(12);
    expect(matchingAdminModules("mEtricas").map((item) => item.section)).toContain("metricas");
    expect(matchingAdminModules("solicitacoes").map((item) => item.section)).toContain(
      "solicitacoes",
    );
    expect(matchingAdminModules("contatos").map((item) => item.section)).toContain("contatos");
  });

  it("forma links diretos seguros e preserva a pesquisa do registro", () => {
    expect(adminSearchUrl("tecnicos", "  João   Técnico  ")).toBe(
      "/admin/tecnicos?busca=Jo%C3%A3o+T%C3%A9cnico",
    );
    expect(adminSearchUrl("solicitacoes", undefined, "78af4122-a5c7-4f2b-8c32-f88bc7899b00")).toBe(
      "/admin/solicitacoes?registro=78af4122-a5c7-4f2b-8c32-f88bc7899b00",
    );
    expect(adminSearchUrl("contatos", "a%_*,.(b)", "../fora")).toBe("/admin/contatos?busca=a+b");
    expect(cleanAdminSearch(" ").length).toBe(0);
  });

  it("mantém pesquisa privada dentro do guarda administrativo e consultas limitadas", () => {
    const admin = readFileSync("src/routes/admin.tsx", "utf8");
    const nav = readFileSync("src/components/admin-navigation.tsx", "utf8");
    const search = readFileSync("src/components/admin-global-search.tsx", "utf8");
    expect(admin.indexOf('roles.includes("admin")')).toBeLessThan(
      admin.indexOf("<AdminNavigation active={section} />"),
    );
    expect(nav).toContain("<AdminGlobalSearch />");
    expect(search).toContain('db.rpc("eut_admin_accounts_snapshot"');
    expect(search).toContain('db.rpc("eut_admin_technician_registry_list"');
    expect(search).toContain(".limit(5)");
    expect(search).not.toContain("service_role");
    expect(search).not.toContain("masked_phone");
    expect(search).not.toContain('select("*")');
    expect(search).not.toContain("message, email");
  });
});
