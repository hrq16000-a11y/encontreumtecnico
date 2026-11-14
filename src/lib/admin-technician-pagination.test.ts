import { describe, expect, it } from "vitest";
import { adminPageRange, cleanAdminSearch, ADMIN_TECHNICIAN_PAGE_SIZE } from "./admin-technician-pagination";
import { readFileSync } from "node:fs";
describe("Paginação administrativa para milhares de técnicos", () => {
  it("consulta só páginas de 25 e nunca usa offset negativo", () => {
    expect(ADMIN_TECHNICIAN_PAGE_SIZE).toBe(25);
    expect(adminPageRange(0)).toEqual([0,24]);
    expect(adminPageRange(1)).toEqual([25,49]);
    expect(adminPageRange(600)).toEqual([15000,15024]);
    expect(adminPageRange(-4)).toEqual([0,24]);
  });
  it("remove curingas e sintaxe PostgREST do texto de busca", () => {
    expect(cleanAdminSearch(" %_*(Curitiba),  ")).toBe("Curitiba");
    expect(cleanAdminSearch("a".repeat(120))).toHaveLength(80);
  });
  it("filtra no banco com RLS, contagem e ordenação estável; não busca todos", () => {
    const manager=readFileSync("src/components/admin-technician-manager.tsx","utf8");
    const admin=readFileSync("src/routes/admin.tsx","utf8");
    expect(manager).toContain('select("id,status,display_name,bio,region,city,state_uf,specialties,avatar_path,created_at,updated_at,neighborhood,coverage_city_ids,service_slugs,service_radius_km", { count: "exact" })');
    expect(manager).toContain("<AdminTechnicianComprehensiveDraft");
    const advanced = readFileSync("src/components/admin-technician-comprehensive-draft.tsx", "utf8");
    expect(advanced).toContain("prepareAdminTechnicianEdit");
    expect(advanced).toContain("dddFromBrazilPhone");
    expect(advanced).not.toContain("localStorage");
    expect(advanced).not.toContain("sessionStorage");
    expect(advanced).not.toContain(".rpc(");
    expect(advanced).not.toContain(".update(");
    expect(advanced).not.toContain(".delete(");
    expect(manager).toContain('.eq("status", status)');
    expect(manager).toContain('.range(from, to)');
    expect(manager).toContain('.order("id", { ascending: true })');
    expect(manager).toContain('query = query.eq("state_uf", uf)');
    expect(manager).toContain('query = query.ilike("neighborhood"');
    expect(manager).toContain('query = query.contains("specialties", [category])');
    expect(manager).toContain("setReload((value) => value + 1)");
    expect(manager).toContain('db.rpc("eut_admin_technician_action"');
    const overview = readFileSync("src/components/admin-command-overview.tsx", "utf8");
    expect(admin).toContain("<AdminCommandOverview />");
    expect(overview).toContain('count("technicians", "aprovado")');
    expect(overview).toContain('count("technicians", "pendente")');
    expect(overview).toContain('count: "exact", head: true');
    expect(overview).not.toContain('.select("*")');
    expect(admin).not.toContain('supabase.from("technicians").select("*")');
    expect(admin).toContain("<AdminTechnicianManager adminOwnerId={user.id} />");
    expect(manager).not.toContain("service_role");
    expect(manager).not.toContain(".delete()");
  });
});
