import { describe, expect, it } from "vitest";
import { adminPageRange, cleanAdminSearch, ADMIN_TECHNICIAN_PAGE_SIZE, adminLastPageIndex, boundedAdminPage } from "./admin-technician-pagination";
import { readFileSync } from "node:fs";
describe("Paginação administrativa para milhares de técnicos", () => {
  it("consulta só páginas de 25 e nunca usa offset negativo", () => {
    expect(ADMIN_TECHNICIAN_PAGE_SIZE).toBe(25);
    expect(adminPageRange(0)).toEqual([0,24]);
    expect(adminPageRange(1)).toEqual([25,49]);
    expect(adminPageRange(600)).toEqual([15000,15024]);
    expect(adminPageRange(-4)).toEqual([0,24]);
  });
  it("ajusta a página quando uma moderação reduz os resultados sem alterar outras contas", () => {
    expect(adminLastPageIndex(41, 20)).toBe(2);
    expect(adminLastPageIndex(40, 20)).toBe(1);
    expect(boundedAdminPage(2, 40, 20)).toBe(1);
    expect(boundedAdminPage(5, 1, 20)).toBe(0);
    expect(boundedAdminPage(0, 0, 20)).toBe(0);
    expect(boundedAdminPage(-2, 50, 20)).toBe(0);
    expect(boundedAdminPage(Number.NaN, 50, 20)).toBe(0);
    expect(boundedAdminPage(2, 50, 0)).toBe(0);
  });
  it("mantém o diretório administrativo de contas consistente após atualização", () => {
    const accounts = readFileSync("src/components/admin-accounts-manager.tsx", "utf8");
    expect(accounts).toContain("boundedAdminPage(page, data.total, data.page_size)");
    expect(accounts).toContain("setPage(safePage)");
    expect(accounts).toContain("setPage(0);");
    expect(accounts).toContain("adminLastPageIndex(snapshot?.total ?? 0, snapshot?.page_size ?? 0) + 1");
    expect(accounts).not.toContain("auth.admin.");
  });
  it("remove curingas e sintaxe PostgREST do texto de busca", () => {
    expect(cleanAdminSearch(" %_*(Curitiba),  ")).toBe("Curitiba");
    expect(cleanAdminSearch("a".repeat(120))).toHaveLength(80);
  });
  it("filtra no banco com RLS, contagem e ordenação estável; não busca todos", () => {
    const manager=readFileSync("src/components/admin-technician-manager.tsx","utf8");
    const admin=readFileSync("src/routes/admin.tsx","utf8");
    expect(manager).toContain('select("id,status,display_name,bio,region,city,state_uf,specialties,avatar_path,created_at", { count: "exact" })');
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
