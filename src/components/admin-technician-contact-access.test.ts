import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync("src/components/admin-technician-contact-access.tsx", "utf8");

describe("telefone como campo do cadastro administrativo", () => {
  it("carrega o telefone completo no painel sem botão revelar ou justificativa", () => {
    expect(component).toContain('db.rpc("eut_admin_unified_contact"');
    expect(component).toContain("result.phone");
    expect(component).toContain("Telefone:");
    expect(component).toContain("Copiar telefone");
    expect(component).not.toContain("Motivo da consulta");
    expect(component).not.toContain("Ver número completo");
    expect(component).not.toContain("setTimeout");
    expect(component).not.toContain("visibilitychange");
  });
});
