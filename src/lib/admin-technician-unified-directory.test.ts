import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cleanUnifiedSearch } from "../components/admin-technician-unified-directory";

describe("busca administrativa unificada", () => {
  it("normaliza termos sem introduzir operadores PostgREST", () => {
    expect(cleanUnifiedSearch("  Curitiba, (41)   ")).toBe("Curitiba 41");
    expect(cleanUnifiedSearch("São José dos Pinhais")).toBe("São José dos Pinhais");
  });
  it("exibe técnicos das três origens numa única consulta protegida", () => {
    const page = readFileSync("src/routes/admin.tsx", "utf8");
    const directory = readFileSync("src/components/admin-technician-unified-directory.tsx", "utf8");
    expect(page).toContain("<AdminTechnicianUnifiedDirectory />");
    expect(page).not.toContain('<AdminMemberInvites initialRole="tecnico" />');
    expect(directory).toContain('db.from("legacy_review_profiles")');
    expect(directory).toContain('db.from("technicians")');
    expect(directory).toContain('readGuiafixStaging(Object.values(captures))');
    expect(directory).toContain('unifiedPageSlice(');
    expect(directory).toContain('Paginação do diretório unificado');
    expect(directory).toContain('Últimos cadastros do portal');
    expect(directory).toContain('onEditTechnician({');
    expect(directory).toContain('onReviewLegacy({');
    expect(directory).toContain('.eq("kind", "candidate")');
    expect(directory).not.toContain('Carregar mais técnicos');
    expect(page).toContain('focusRequest={technicianFocus}');
    expect(page).toContain('focusRequest={legacyFocus}');
    expect(directory).not.toMatch(/private_contacts|auth\.admin|service_role|\.from\("eut_technician_private_contacts"\)/);
  });
});
