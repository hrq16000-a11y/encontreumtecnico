import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const sql = readFileSync("docs/sql/eut-admin-management-actions-20261111.sql", "utf8");
const admin = readFileSync("src/routes/admin.tsx", "utf8");
const technicians = readFileSync("src/components/admin-technician-manager.tsx", "utf8");
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
    expect(technicians).toContain("data.id !== target.technician.id");
    expect(technicians).toContain("onChanged()");
    expect(technicians).toContain("window.confirm");
    expect(technicians).toContain("Dessuspender");
    expect(admin).toContain("<AdminTechnicianManager technicians={techs} onChanged={load} />");
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
