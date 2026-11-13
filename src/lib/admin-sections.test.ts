import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ADMIN_SECTIONS, adminModulePath, adminModuleTitle, validAdminModule,
} from "./admin-sections";
import { ADMIN_REFERRAL_PAGE_SIZE_MAX, parseAdminReferralLedgerPage } from "./admin-referral-ledger-contract";
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


const sampleReferralReport = () => ({
  version: 1, as_of: "2026-11-13T12:00:00Z", page: 0, page_size: 20, total: 1,
  rows: [{
    technician_id: "11111111-2222-3333-4444-555555555555",
    public_slug: "tecnico-exemplo", display_name: "Técnico Exemplo",
    city: "Curitiba", state_uf: "PR",
    invited_accounts: 3, invited_public_profiles: 2,
    points: { status: "unavailable" },
  }],
});

describe("B2: contrato somente leitura para extrato administrativo futuro", () => {
  it("aceita agregados sintéticos coerentes e pontuação indisponível, sem zerar falhas", () => {
    const example = sampleReferralReport();
    expect(parseAdminReferralLedgerPage(example)).toEqual(example);
    expect(parseAdminReferralLedgerPage({ ...example, total: 0, rows: [] }))
      .toEqual({ ...example, total: 0, rows: [] });
  });
  it("exige regra e revisão de ledger para valores de pontos verificados", () => {
    const base = sampleReferralReport();
    const verified = {
      status: "verified", value: 4, rule_version: "regra.v1",
      ledger_revision: "audit:42", calculated_at: "2026-11-13T12:00:00Z",
    };
    expect(parseAdminReferralLedgerPage({
      ...base, rows: [{ ...base.rows[0], points: verified }],
    })?.rows[0].points).toEqual(verified);
    for (const points of [
      0, { status: "verified", value: 4 },
      { status: "unavailable", value: 0 },
      { status: "verified", value: -1, rule_version: "regra.v1",
        ledger_revision: "audit:42", calculated_at: "2026-11-13T12:00:00Z" },
    ]) {
      expect(parseAdminReferralLedgerPage({
        ...base, rows: [{ ...base.rows[0], points }],
      })).toBeNull();
    }
  });
  it("rejeita contagens inexistentes, negativas, decimais ou publicadas acima das associadas", () => {
    for (const bad of [null, undefined, "5", -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseAdminReferralLedgerPage({
        ...sampleReferralReport(),
        rows: [{ ...sampleReferralReport().rows[0], invited_accounts: bad }],
      })).toBeNull();
    }
    expect(parseAdminReferralLedgerPage({
      ...sampleReferralReport(),
      rows: [{ ...sampleReferralReport().rows[0],
        invited_accounts: 1, invited_public_profiles: 2 }],
    })).toBeNull();
  });
  it("rejeita dados de convidado, contato privado, código e comissão no JSON", () => {
    for (const extra of [
      { email: "privado@exemplo.com" }, { phone: "+554199999999" },
      { invited_user_id: "privado" }, { referral_code: "codigo" },
      { user_id: "id-privado" }, { commission: 100 },
    ]) {
      expect(parseAdminReferralLedgerPage({
        ...sampleReferralReport(),
        rows: [{ ...sampleReferralReport().rows[0], ...extra }],
      })).toBeNull();
    }
    expect(parseAdminReferralLedgerPage({
      ...sampleReferralReport(), service_role: "secret",
    })).toBeNull();
  });
  it("limita paginação, versões, timestamps, totais e IDs duplicados", () => {
    expect(ADMIN_REFERRAL_PAGE_SIZE_MAX).toBe(25);
    const base = sampleReferralReport();
    for (const patch of [
      { version: 2 }, { page: -1 }, { page_size: 0 }, { page_size: 26 },
      { total: 0 }, { as_of: "sem-data" },
      { rows: [base.rows[0], base.rows[0]] },
    ]) {
      expect(parseAdminReferralLedgerPage({ ...base, ...patch })).toBeNull();
    }
  });
  it("não conecta RPC, tabela de convidados nem saldo financeiro nesta etapa", () => {
    const source = read("src/lib/admin-referral-ledger-contract.ts");
    const view = read("src/components/admin-referral-overview.tsx");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain(".rpc(");
    expect(source).not.toContain(".from(");
    expect(view).not.toContain("eut_technician_referrals");
    expect(view).not.toContain("eut_admin_referral_ledger");
  });
});
