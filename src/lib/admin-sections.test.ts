import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ADMIN_SECTIONS, adminModulePath, adminModuleTitle, validAdminModule,
} from "./admin-sections";
import { approvedPublicReferralSpotlights } from "./admin-referral-signals";

const read = (path: string) => readFileSync(path, "utf8");

describe("Central administrativa: URLs próprias e RLS intacta", () => {
  it("oferece doze seções únicas, uma home e onze módulos reais", () => {
    expect(ADMIN_SECTIONS.map((x) => x.key)).toEqual([
      "inicio", "tecnicos", "clientes", "contas", "contatos", "solicitacoes",
      "patrocinadores", "mensagens", "catalogo",
      "legado", "reivindicacoes", "metricas",
    ]);
    expect(new Set(ADMIN_SECTIONS.map((x) => x.key)).size).toBe(12);
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
  it("oferece atalhos operacionais autenticados sem alterar os guardas de acesso", () => {
    const page = read("src/routes/admin.tsx");
    const roleGate = page.indexOf('roles.includes("admin")');
    const authenticatedContent = page.indexOf('<ConnectedGoogleIdentity user={user} />');
    const shortcuts = page.indexOf('aria-label="Atalhos rápidos da administração"');
    expect(roleGate).toBeGreaterThanOrEqual(0);
    expect(authenticatedContent).toBeGreaterThan(roleGate);
    expect(shortcuts).toBeGreaterThan(authenticatedContent);
    for (const module of ["tecnicos", "solicitacoes", "contas", "contatos"]) {
      expect(page).toContain('{ section: "' + module + '"');
      expect(validAdminModule(module)).toBe(true);
    }
    expect(page).toContain('params={{ secao: item.section }}');
    expect(page).toContain('aria-current={section === item.section ? "page" : undefined}');
    expect(page).toContain('noindex, nofollow');
  });


  it("mantém o diagnóstico B1 exclusivamente nos destaques de perfis públicos", () => {
    const admin = read("src/routes/admin.tsx");
    const view = read("src/components/admin-referral-overview.tsx");
    expect(admin).toContain('import { AdminReferralOverview }');
    expect(admin).toContain("<AdminReferralOverview />");
    expect(admin.indexOf(") : !isAdmin ? (")).toBeLessThan(admin.indexOf("<AdminReferralOverview />"));
    expect(view).toContain("listApprovedTechnicians({");
    expect(view).toContain("approvedPublicReferralSpotlights(rows)");
    expect(view).toContain("status === \"error\"");
    expect(view).not.toContain('db.from("eut_technician_referrals")');
    expect(view).not.toContain("eut_my_referral_dashboard");
    expect(view).not.toContain("service_role");
    expect(view).not.toContain("eut_admin_referrals_snapshot");
  });
  it("projeta apenas identidade pública de perfis efetivamente destacados", () => {
    const input = [
      { id: "1", public_slug: "t-1", display_name: "Técnico A",
        city: "Curitiba", state_uf: "PR", referral_highlight: true,
        email: "privado@example.com", phone: "41999999999" },
      { id: "2", public_slug: "t-2", display_name: "Técnico B",
        city: "Curitiba", state_uf: "PR", referral_highlight: false,
        email: "outro@example.com" },
    ];
    const rows = approvedPublicReferralSpotlights(input);
    expect(rows).toEqual([{ id: "1", public_slug: "t-1",
      display_name: "Técnico A", city: "Curitiba", state_uf: "PR" }]);
    expect(JSON.stringify(rows)).not.toContain("example.com");
    expect(JSON.stringify(rows)).not.toContain("41999999999");
    expect(approvedPublicReferralSpotlights([])).toEqual([]);
  });

});
