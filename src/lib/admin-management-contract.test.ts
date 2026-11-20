import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const sql = readFileSync("docs/sql/eut-admin-management-actions-20261111.sql", "utf8");
const employers = readFileSync("docs/sql/eut-admin-legacy-employer-overlay-20261111.sql", "utf8");
const admin = readFileSync("src/routes/admin.tsx", "utf8");
const technicians = readFileSync("src/components/admin-technician-manager.tsx", "utf8");
const technicianActionConfirmation = readFileSync("src/lib/admin-technician-action-confirmation.ts", "utf8");
const catalogue = readFileSync("src/components/eut-admin-manager.tsx", "utf8");
const legacy = readFileSync("src/components/legacy-review-queue.tsx", "utf8");
const nav = readFileSync("src/components/admin-navigation.tsx", "utf8");
const header = readFileSync("src/components/site-header.tsx", "utf8");

describe("Admin management hardening", () => {
  it("never grants anonymous moderation or allows forged, edited or erased audit entries", () => {
    for (const text of [
      "ALTER TABLE public.eut_admin_management_log ENABLE ROW LEVEL SECURITY",
      "REVOKE ALL ON TABLE public.eut_admin_management_log FROM PUBLIC, anon, authenticated",
      "GRANT SELECT ON public.eut_admin_management_log TO authenticated",
      "public.has_role(auth.uid(),'admin'::public.app_role)",
      "REVOKE ALL ON FUNCTION public.eut_admin_technician_action",
      "REVOKE ALL ON FUNCTION public.eut_admin_legacy_action",
      "SECURITY INVOKER SET search_path=''",
      "eut_admin_audit_technician",
      "eut_admin_audit_legacy_management",
    ]) expect(sql).toContain(text);
    expect(sql).not.toMatch(/DROP TABLE\s+public\.(?:technicians|legacy_review_profiles)/i);
    expect(sql).not.toContain("DELETE FROM public.legacy_review_profiles");
  });
  it("rechecks ownership and persists verified editing without accidental status bypass", () => {
    for (const action of ["aprovar","suspender","reativar","rejeitar","revisar","editar"]) {
      expect(sql).toContain(action);
    }
    expect(sql).toContain("WHERE id=p_id FOR UPDATE");
    expect(sql).toContain("Informe o motivo da alteração");
    expect(sql).toContain("Acesso administrativo necessário");
    expect(sql).toContain("RETURNING * INTO row_after");
    expect(technicians).toContain('db.rpc("eut_admin_technician_action"');
    expect(technicians).toContain("confirmedAdminTechnicianAction(");
    expect(technicianActionConfirmation).toContain('row["id"] !== technicianId');
    expect(technicianActionConfirmation).toContain('row["status"] === STATUS_AFTER_ACTION[action]');
    expect(technicians).toContain("setReload((value) => value + 1)");
    expect(technicians).toContain("window.confirm");
    expect(technicians).toContain("Dessuspender");
    const directory = readFileSync("src/components/admin-technician-unified-directory.tsx", "utf8");
    expect(admin).toContain("<AdminTechnicianUnifiedDirectory adminOwnerId={user.id} />");
    expect(directory).toContain("<AdminTechnicianManager");
  });
  it("protects WordPress source and 20 demo candidates, with at most 20 records per batch", () => {
    for (const term of [
      "count_items>20", "count(DISTINCT x)", "demo_candidate",
      "Registros de demonstração não podem ser restaurados",
      "p_action='restaurar'", "ON CONFLICT(source_key,wp_post_id) DO UPDATE",
      "RETURN jsonb_build_object('updated',count_items,'action',p_action,'published',false)",
      "eut_legacy_profile_management",
    ]) expect(sql).toContain(term);
    expect(legacy).toContain('db.rpc("eut_admin_legacy_action"');
    expect(legacy).toContain("data?.published !== false");
    expect(legacy).toContain("Selecionar página");
    expect(legacy).toContain("Arquivar lote");
    expect(legacy).toContain("Editar nome");
    expect(legacy).toContain("não ativa contas nem expõe contatos");
    expect(legacy).not.toContain('db.from("legacy_review_profiles").delete');
    expect(sql).not.toContain("ORDER BY wp_post_id FOR UPDATE LOOP");
    expect(legacy).toContain('kind === "candidate" ? "eut_legacy_profile_management" : "eut_legacy_employer_management"');
    for (const guard of [
      "CREATE TABLE IF NOT EXISTS public.eut_legacy_employer_management",
      "eut_legacy_guard_employer",
      "eut_admin_audit_legacy_employer",
      "Registros de demonstração só podem ser arquivados",
      "table_name:=CASE profile.kind",
      "SECURITY INVOKER SET search_path=''",
    ]) expect(employers).toContain(guard);
    expect(employers).not.toContain("ORDER BY wp_post_id FOR UPDATE");
    expect(employers).toContain("ON CONFLICT(source_key,wp_post_id)");
    expect(employers).toContain("RETURN jsonb_build_object('updated',count_items,'action',p_action,'published',false)");
  });
  it("does not report historical profile or service writes as saved when RLS changes zero rows", () => {
    expect(catalogue).toContain('.select("wp_post_id").maybeSingle()');
    expect(catalogue).toContain('data?.wp_post_id===selected.wp_post_id');
    expect(catalogue).toContain('.select("service_slug").maybeSingle()');
    expect(catalogue).toContain('data?.service_slug===serviceToAdd');
    expect(catalogue).toContain('.select("service_slug,confirmation_status").maybeSingle()');
    expect(catalogue).toContain('data.confirmation_status==="confirmado"');
    expect(catalogue).toContain('data?.service_slug===item.service_slug');
  });
  it("closes menus on outside tap and Escape while preserving desktop navigation", () => {
    for (const source of [nav,header]) {
      expect(source).toContain('document.addEventListener("pointerdown"');
      expect(source).toContain('event.key === "Escape"');
      expect(source).toContain('document.removeEventListener("pointerdown"');
    }
    expect(nav).toContain('aria-expanded={mobileOpen}');
    expect(nav).toContain("lg:flex lg:flex-col");
  });
});
