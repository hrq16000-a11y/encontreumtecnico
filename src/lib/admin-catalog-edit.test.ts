import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { prepareAdminCatalogEdit, type CatalogEditDraft } from "./admin-catalog-edit";

const TECH_ID = "a6b49a98-c980-42a8-bc9d-78fd5a741e08";
const cities = {
  curitiba: { id: 4106902, name: "Curitiba", uf: "PR" },
  saoPaulo: { id: 3550308, name: "São Paulo", uf: "SP" },
};
const categories = [
  { slug: "computadores", active: true },
  { slug: "redes", active: true },
  { slug: "desativada", active: false },
];
const services = [
  { slug: "manutencao-pc", category_slug: "computadores", active: true },
  { slug: "wifi", category_slug: "redes", active: true },
  { slug: "antigo", category_slug: "computadores", active: false },
];
const draft: CatalogEditDraft = {
  technicianId: TECH_ID, expectedUpdatedAt: "2026-11-13T18:00:00.000Z",
  technicianStatus: "aprovado", previousCity: "Curitiba", previousUf: "PR",
  existingCoverage: [4106902], city: cities.curitiba,
  specialties: ["computadores", "redes"], serviceSlugs: ["manutencao-pc", "wifi"],
  replaceCoverage: false, reason: "Ajuste solicitado pelo titular",
};
const prepare = (change: Partial<CatalogEditDraft> = {}) =>
  prepareAdminCatalogEdit({ ...draft, ...change }, categories, services);

describe("Edição territorial administrativa sem contatos privados", () => {
  it("preserva cadastro aprovado, cidade oficial e serviços compatíveis", () => {
    const result = prepare();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload._city_ibge_id).toBe(4106902);
    expect(result.payload._coverage_city_ids).toEqual([4106902]);
    expect(result.payload._specialties).toEqual(["computadores", "redes"]);
    expect(result.coverageReplaced).toBe(false);
    expect(JSON.stringify(result.payload)).not.toMatch(/phone|contact|payment|password/i);
  });
  it("exige confirmação explícita quando a cidade-base sai da cobertura", () => {
    const denied = prepare({ city: cities.saoPaulo });
    expect(denied.ok).toBe(false);
    const allowed = prepare({ city: cities.saoPaulo, replaceCoverage: true });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.coverageReplaced).toBe(true);
    expect(allowed.payload._coverage_city_ids).toEqual([3550308]);
  });
  it("não inventa município nem altera cobertura histórica de perfil suspenso", () => {
    expect(prepare({ city: null }).ok).toBe(false);
    expect(prepare({ city: { id: 0, name: "Brasil", uf: "BR" } }).ok).toBe(false);
    expect(prepare({ technicianStatus: "suspenso" }).ok).toBe(false);
  });
  it("recusa categorias e serviços inativos, duplicados e incompatíveis", () => {
    expect(prepare({ specialties: ["desativada"] }).ok).toBe(false);
    expect(prepare({ specialties: ["computadores", "computadores"] }).ok).toBe(false);
    expect(prepare({ specialties: ["computadores"] }).ok).toBe(false);
    expect(prepare({ serviceSlugs: ["antigo"] }).ok).toBe(false);
  });
  it("motivo não pode levar telefone nem link para a auditoria", () => {
    expect(prepare({ reason: "Fale no 41 99999-8888" }).ok).toBe(false);
    expect(prepare({ reason: "https://example.com" }).ok).toBe(false);
    expect(prepare({ expectedUpdatedAt: "revisao-antiga" }).ok).toBe(false);
  });
});

describe("Contrato SQL e painel isolado antes da homologação", () => {
  const sql = readFileSync("docs/sql/eut-admin-technician-catalog-edit-20261114.sql", "utf8");
  const editor = readFileSync("src/components/admin-technician-catalog-editor.tsx", "utf8");
  const manager = readFileSync("src/components/admin-technician-manager.tsx", "utf8");
  const clients = readFileSync("src/components/admin-accounts-manager.tsx", "utf8");
  it("protege autorização, concorrência, catálogo IBGE, auditoria e RLS", () => {
    for (const term of [
      "public.has_role(v_actor, 'admin'::public.app_role)",
      "auth.users u", "public.eut_account_operational()",
      "eut_moderation.blocked_accounts", "FOR UPDATE", "updated_at IS DISTINCT FROM _expected_updated_at",
      "public.eut_ibge_municipalities", "public.eut_service_categories", "public.eut_service_types",
      "public.eut_admin_management_log", "technician_catalog_edit",
      "REVOKE ALL ON FUNCTION", "GRANT EXECUTE ON FUNCTION",
    ]) expect(sql).toContain(term);
    expect(sql).not.toContain("ALTER TABLE");
    expect(sql).not.toContain("eut_technician_private_contacts");
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });
  it("não expõe ação não instalada e mantém a edição de nomes dos clientes", () => {
    expect(manager).toContain('import.meta.env.VITE_EUT_ADMIN_CATALOG_EDIT === "enabled"');
    expect(manager).toContain("catalogEditEnabled && <button");
    expect(editor).toContain('db.rpc("eut_admin_technician_catalog_edit"');
    expect(editor).not.toContain("phone_e164");
    expect(clients).toContain('db.rpc("eut_admin_account_edit_name"');
    expect(clients).toContain("account.email_confirmed");
    expect(clients).toContain("account.created_at");
  });
});
