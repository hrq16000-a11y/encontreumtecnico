import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cleanUnifiedSearch } from "../components/admin-technician-unified-directory";

describe("busca administrativa unificada", () => {
  it("normaliza termos sem introduzir operadores PostgREST", () => {
    expect(cleanUnifiedSearch("  Curitiba, (41)   ")).toBe("Curitiba 41");
    expect(cleanUnifiedSearch("São José dos Pinhais")).toBe("São José dos Pinhais");
    expect(cleanUnifiedSearch("Teste interno de homologacao EUT — QA 284")).toBe("Teste interno de homologacao EUT — QA 284");
  });
  it("exibe técnicos das três origens numa única consulta protegida", () => {
    const page = readFileSync("src/routes/admin.tsx", "utf8");
    const directory = readFileSync("src/components/admin-technician-unified-directory.tsx", "utf8");
    expect(page).toContain("<AdminTechnicianUnifiedDirectory adminOwnerId={user.id} />");
    expect(page).not.toContain('<AdminMemberInvites initialRole="tecnico" />');
    expect(page).not.toContain("Gerenciar dados e situação dos técnicos do portal");
    expect(page).not.toContain("Gerenciar fichas importadas do WordPress");
    expect(page).toContain("<LegacyReviewQueue onlyTechnicians />");
    expect(directory).toContain('db.from("legacy_review_profiles")');
    expect(directory).toContain('db.from("technicians")');
    expect(directory).toContain('readGuiafixStaging(Object.values(captures))');
    expect(directory).toContain('.eq("kind", "candidate")');
    expect(directory).toContain('.ilike("corrected_name", `%${term}%`)');
    expect(directory).not.toContain('Carregar mais técnicos WordPress');
    expect(directory).not.toContain('Carregar mais técnicos do portal');
    expect(directory).not.toContain("Carregar mais técnicos");
    expect(directory).toContain("unifiedPageSlice(");
    expect(directory).toContain("Paginação do diretório unificado");
    expect(directory).toContain("Últimos cadastros");
    expect(directory).toContain("Cidade, região ou UF");
    expect(directory).toContain("Categoria ou especialidade");
    expect(directory).toContain("filterRegion(row.regionKey");
    expect(directory).toContain("filterSpecialty(categoryKeyword(");
    expect(directory).toContain("selectedTechnicianId={row.portalId}");
    expect(directory).toContain('db.rpc("eut_admin_legacy_action"');
    expect(directory).toContain('data?.updated !== 1 || data?.published !== false');
    expect(directory).toContain('row.origin === "guiafix"');
    expect(directory).toContain('aria-label="Forma de exibição"');
    expect(directory).toContain('aria-label="Ações em massa"');
    expect(directory).toContain("Copiar nomes (");
    expect(directory).toContain('selectedRows.map((row) => row.name).join("\\n")');
    expect(directory).toContain("Ver ficha");
    expect(directory).toContain("Selecionar página");
    expect(directory).toContain('value="name-desc"');
    expect(directory).toContain('value="updated"');
    expect(directory).not.toMatch(/private_contacts|auth\.admin|service_role|\.from\("eut_technician_private_contacts"\)/);
  });
});
