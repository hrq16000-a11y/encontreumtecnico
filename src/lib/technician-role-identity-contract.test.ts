import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const proposal = readFileSync("docs/sql/eut-choose-technician-role-publish-identity-proposal-20261120.sql", "utf8");
const login = readFileSync("src/routes/entrar.tsx", "utf8");

describe("Contrato de identidade técnico: escolher papel e publicar exigem a mesma prova", () => {
  it("rejeita apenas novas atribuições de técnico sem a confirmação exigida pela publicação", () => {
    expect(proposal).toContain("_role='tecnico'::public.app_role");
    expect(proposal).toContain("eut_migration.confirmed_current_email() IS DISTINCT FROM v_email");
    expect(proposal).toContain("AND NOT EXISTS (SELECT 1 FROM public.user_roles r");
    expect(proposal).toContain("WHERE r.user_id=v_user AND r.role=_role");
    expect(proposal).toContain("USING ERRCODE='42501'");
  });

  it("preserva papel de cliente, associação legada, idempotência e impedimento de escalada", () => {
    for (const value of [
      "_role NOT IN ('tecnico'::public.app_role,'cliente'::public.app_role)",
      "i.provider IN ('email','google')",
      "q.intended_type,q.linked_auth_user_id",
      "v_legacy_type='admin_manual'",
      "v_prior_link<>v_user",
      "r.role<>_role",
      "ON CONFLICT (user_id,role) DO NOTHING",
    ]) expect(proposal).toContain(value);
    expect(proposal).not.toMatch(/UPDATE\s+(auth\.users|public\.user_roles)/i);
    expect(proposal).not.toMatch(/DELETE\s+FROM\s+(auth\.users|public\.user_roles)/i);
    expect(proposal).not.toContain("user_metadata");
  });

  it("não altera RLS, contatos ou status e conserva ACL existente", () => {
    expect(proposal).toContain("b3bc27956ff5d233c042372a20e309df");
    expect(proposal).toContain("SECURITY DEFINER");
    expect(proposal).toContain("has_function_privilege('anon'");
    expect(proposal).toContain("has_function_privilege('authenticated'");
    expect(proposal).toContain("has_function_privilege('service_role'");
    expect(proposal).not.toMatch(/\b(?:REVOKE|GRANT)\s+/i);
    expect(proposal).not.toMatch(/(DROP|ALTER)\s+(TABLE|POLICY|ROLE|TRIGGER)/i);
    expect(proposal).not.toContain("eut_technician_private_contacts");
    expect(proposal).not.toContain("UPDATE public.technicians");
  });

  it("informa o bloqueio sem expor SQL e preserva o fluxo de login", () => {
    expect(login).toContain('supabase.rpc("choose_account_type", { _role: role })');
    expect(login).toContain('role === "tecnico" && error.code === "42501"');
    expect(login).toContain("não crie outra conta");
    expect(login).not.toContain("auth.admin");
  });
});
