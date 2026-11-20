import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const proposal = readFileSync("docs/sql/eut-choose-technician-role-publish-identity-proposal-20261120.sql", "utf8");
const login = readFileSync("src/routes/entrar.tsx", "utf8");

describe("Contrato de identidade técnico: escolha de papel precede comprovação OTP", () => {
  it("retira a proposta de bloqueio antecipado que impediria iniciar OTP", () => {
    expect(proposal).toContain("SEM SQL EXECUTAVEL");
    expect(proposal).toContain("choose_account_type");
    expect(proposal).toContain("eut_begin_technician_email_otp()");
    expect(proposal).toContain("eut_publish_my_technician");
    expect(proposal).toContain("confirmed_current_email()");
    expect(proposal).not.toMatch(/^\s*(?:CREATE|ALTER|DROP|UPDATE|DELETE|INSERT|GRANT|REVOKE)\s+/im);
  });

  it("preserva seleção de cliente, legado e autorização administrativa no servidor", () => {
    expect(login).toContain('supabase.rpc("choose_account_type", { _role: role })');
    expect(login).toContain('client.rpc("eut_confirm_my_legacy_account")');
    expect(login).toContain('client.rpc("eut_bootstrap_project_owner")');
    expect(login).toContain("canAttemptNewAccountRole");
    expect(login).toContain("ownerCheckPending");
    expect(login).not.toContain("auth.admin");
  });

  it("mantém publicação separada e orienta a comprovação legítima na área técnica", () => {
    expect(login).toContain('await refreshRoles()');
    expect(login).toContain("A escolha do papel não publica seu perfil");
    expect(login).toContain("comprovação por link");
  });

  it("não propõe alteração de ACL, RLS, contatos ou contas de terceiros", () => {
    expect(proposal).toContain("RLS e contatos suspensos não são modificados");
    expect(proposal).not.toMatch(/^\s*(?:CREATE|ALTER|DROP|UPDATE|DELETE|INSERT|GRANT|REVOKE)\s+/im);
    expect(proposal).not.toContain("user_metadata");
  });

  it("preserva erro de autorização sem expor SQL ou criar outra conta", () => {
    expect(login).toContain('role === "tecnico" && error.code === "42501"');
    expect(login).toContain("não crie outra conta");
    expect(login).not.toContain("auth.admin");
  });
});
