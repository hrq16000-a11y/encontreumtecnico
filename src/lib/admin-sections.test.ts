import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ADMIN_SECTIONS, adminModulePath, adminModuleTitle, validAdminModule,
} from "./admin-sections";

const read = (path: string) => readFileSync(path, "utf8");

describe("Central administrativa: URLs próprias e RLS intacta", () => {
  it("oferece onze seções únicas, uma home e dez módulos reais", () => {
    expect(ADMIN_SECTIONS.map((x) => x.key)).toEqual([
      "inicio", "tecnicos", "clientes", "contas", "solicitacoes",
      "patrocinadores", "mensagens", "catalogo",
      "legado", "reivindicacoes", "metricas",
    ]);
    expect(new Set(ADMIN_SECTIONS.map((x) => x.key)).size).toBe(11);
    expect(adminModulePath("inicio")).toBe("/admin");
    for (const entry of ADMIN_SECTIONS.filter((x) => x.key !== "inicio")) {
      expect(validAdminModule(entry.key)).toBe(true);
      expect(adminModulePath(entry.key)).toBe("/admin/" + entry.key);
      expect(adminModuleTitle(entry.key)).toBe(entry.label);
    }
  });
  it("bloqueia deep links desconhecidos antes de renderizar o painel", () => {
    for (const malicious of ["", "inicio", "../admin", "admin", "usuarios", "__proto__", "tecnicos?auth=1"]) {
      expect(validAdminModule(malicious)).toBe(false);
    }
    const route = read("src/routes/admin_.$secao.tsx");
    expect(route).toContain("validAdminModule(params.secao)");
    expect(route).toContain("throw notFound()");
    expect(route).toContain('name: "robots", content: "noindex, nofollow"');
  });
  it("protege cada página pelo papel do servidor e evita novo login em erro de roles", () => {
    const page = read("src/routes/admin.tsx");
    const nav = read("src/components/admin-navigation.tsx");
    expect(page).toContain('roles.includes("admin")');
    expect(page).toContain("rolesError");
    expect(page).toContain("refreshRoles()");
    expect(page).toContain('section === "tecnicos"');
    expect(page).toContain('section === "clientes"');
    expect(page).toContain('section === "patrocinadores"');
    expect(page).toContain('section === "metricas"');
    expect(page).toContain('section === "reivindicacoes"');
    expect(nav).toContain('aria-label="Menu administrativo"');
    expect(nav).toContain('to="/admin/$secao"');
    expect(nav).toContain('aria-current={chosen ? "page" : undefined}');
  });
  it("preserva fluxos privados reais e não inventa remoção/banimento de contas", () => {
    const page = read("src/routes/admin.tsx");
    for (const source of [
      "<AdminAdvertisingManager />", "<EutAdminManager />",
      "<LegacyReviewQueue />", "<LegacyClaimReview />",
      "<SearchMetrics />", "contact_messages",
      '<AdminTechnicianManager adminOwnerId={user.id} />',
    ]) expect(page).toContain(source);
    expect(page).not.toContain("auth.admin.deleteUser");
    expect(page).not.toContain("service_role");
    expect(page).toContain('<AdminAccountsManager initialFilter="clientes" />');
    expect(page).toContain('section === "contas"');
  });
});
