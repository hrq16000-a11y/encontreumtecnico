import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ADMIN_SECTIONS, validAdminModule } from "@/lib/admin-sections";

const read = (path: string) => readFileSync(path, "utf8");

describe("Rodada 2: central única de usuários", () => {
  it("oferece somente três papéis segmentados e Todos, sem papel por origem", () => {
    const hub = read("src/components/admin-users-hub.tsx");
    for (const tab of ['key: "todos"', 'key: "admins"', 'key: "clientes"', 'key: "tecnicos"'])
      expect(hub).toContain(tab);
    expect(hub).toContain('role="tablist"');
    expect(hub).toContain('role="tabpanel"');
    expect(hub).toContain('aria-selected={tab === item.key}');
    expect(hub).toContain('new URLSearchParams(window.location.search).get("perfil")');
    expect(hub).not.toMatch(/key: "(wordpress|guiafix|whatsapp|importados)"/i);
  });
  it("reaproveita RPCs, RLS, moderação em lote e edição de técnicos existentes", () => {
    const hub = read("src/components/admin-users-hub.tsx");
    const accounts = read("src/components/admin-accounts-manager.tsx");
    const directory = read("src/components/admin-technician-unified-directory.tsx");
    expect(hub).toContain('<AdminAccountsManager key="todos" initialFilter="todos" lockFilter />');
    expect(hub).toContain('<AdminAccountsManager key="clientes" initialFilter="clientes" lockFilter />');
    expect(hub).toContain('initialFilter="tecnicos" lockFilter');
    expect(hub).toContain("<AdminTechnicianUnifiedDirectory adminOwnerId={adminOwnerId} />");
    expect(hub).toContain('.from("user_roles")');
    expect(hub).toContain('.eq("role", "admin")');
    expect(accounts).toContain('db.rpc("eut_admin_accounts_snapshot"');
    expect(accounts).toContain('db.rpc("eut_admin_contact_action"');
    expect(accounts).toContain("setSelectedIds(new Set())");
    expect(directory).toContain('eut_admin_technician_registry_list');
    expect(hub).not.toContain('auth.admin');
    expect(hub).not.toContain('service_role');
  });
  it("centraliza o menu sem apagar os caminhos legados ou alterar banco", () => {
    const navigation = read("src/components/admin-navigation.tsx");
    const page = read("src/routes/admin.tsx");
    expect(validAdminModule("usuarios")).toBe(true);
    expect(ADMIN_SECTIONS.find((section) => section.key === "usuarios")?.label).toBe("Usuários");
    expect(navigation).toContain('"tecnicos", "clientes", "contas", "contatos", "legado", "reivindicacoes"');
    expect(navigation).toContain('!SECONDARY_USER_SECTIONS.has(item.key)');
    expect(page).toContain('section === "usuarios" && <AdminUsersHub adminOwnerId={user.id} />');
    for (const section of ["tecnicos", "clientes", "contas", "contatos", "legado"])
      expect(validAdminModule(section)).toBe(true);
  });
});
