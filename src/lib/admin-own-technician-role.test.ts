import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("docs/sql/eut-admin-self-technician-role-20261111.sql", "utf8");
const panel = readFileSync("src/components/admin-own-technician-role.tsx", "utf8");
const admin = readFileSync("src/routes/admin.tsx", "utf8");

describe("Conta administrativa pode ter também papel técnico sem escalada", () => {
  it("só permite ativar o papel do próprio administrador autenticado e verificado", () => {
    for (const guard of [
      "v_uid uuid := auth.uid()",
      "public.has_role(v_uid, 'admin'::public.app_role)",
      "eut_migration.confirmed_current_email() IS NULL",
      "public.eut_account_operational()",
      "role = 'cliente'::public.app_role",
      "VALUES (v_uid, 'tecnico'::public.app_role)",
      "ON CONFLICT (user_id, role) DO NOTHING",
      "public.has_role(v_uid, 'tecnico'::public.app_role)",
    ]) expect(sql).toContain(guard);
    expect(sql).not.toMatch(/VALUES\s*\(\s*v_uid\s*,\s*'admin'/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.user_roles/i);
    expect(sql).not.toMatch(/UPDATE\s+public\.user_roles/i);
    expect(sql).not.toContain("auth.admin");
    expect(sql).not.toContain("service_role");
  });
  it("usa execução restrita com trilha auditável e preserva os bloqueios existentes", () => {
    for (const guard of [
      "SECURITY DEFINER",
      "SET search_path = 'pg_catalog'",
      "REVOKE ALL ON FUNCTION public.eut_admin_enable_my_technician_role()",
      "FROM PUBLIC, anon, authenticated",
      "GRANT EXECUTE ON FUNCTION public.eut_admin_enable_my_technician_role()",
      "TO authenticated",
      "public.eut_admin_management_log",
      "'self_enable_technician'",
      "'admin_preserved', true",
    ]) expect(sql).toContain(guard);
    expect(sql).not.toMatch(/DROP\s+(TABLE|TRIGGER|POLICY)/i);
    expect(sql).not.toContain("user_metadata");
  });
  it("exige confirmação do titular, verifica resultado e atualiza papéis sem publicar perfil", () => {
    expect(panel).toContain("window.confirm(");
    expect(panel).toContain('db.rpc("eut_admin_enable_my_technician_role")');
    expect(panel).toContain("data.admin_preserved !== true");
    expect(panel).toContain("await refreshRoles()");
    expect(panel).toContain('to="/area-tecnico"');
    expect(panel).not.toContain("eut_publish_my_technician");
    expect(panel).not.toContain("choose_account_type");
    expect(admin).toContain('<AdminOwnTechnicianRole isTechnician={roles.includes("tecnico")} refreshRoles={refreshRoles} />');
    expect(admin).toContain("roles.includes(\"admin\")");
  });
});
