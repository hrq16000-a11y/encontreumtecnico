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
    expect(hub).toContain('useState<UserTab>("todos")');
    expect(hub).toContain('window.addEventListener("popstate", syncTabFromUrl)');
    expect(hub).not.toMatch(/key: "(wordpress|guiafix|whatsapp|importados)"/i);
  });
  it("navega entre as abas pelo teclado e mantém somente a aba ativa na ordem de foco", () => {
    const hub = read("src/components/admin-users-hub.tsx");
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"])
      expect(hub).toContain(`event.key === "${key}"`);
    expect(hub).toContain("tabIndex={tab === item.key ? 0 : -1}");
    expect(hub).toContain("onKeyDown={(event) => onTabKeyDown(event, item.key)}");
    expect(hub).toContain("document.getElementById(`eut-user-tab-${next}`)?.focus()");
  });
  it("reaproveita RPCs, RLS, moderação em lote e edição de técnicos existentes", () => {
    const hub = read("src/components/admin-users-hub.tsx");
    const accounts = read("src/components/admin-accounts-manager.tsx");
    const directory = read("src/components/admin-technician-unified-directory.tsx");
    expect(hub).toContain('<UnifiedUsersList key="todos" role="todos" openTarget={setManagedTarget} returnRevision={returnRevision} />');
    expect(hub).toContain('<UnifiedUsersList key="clientes" role="cliente" openTarget={setManagedTarget} returnRevision={returnRevision} />');
    expect(hub).toContain('<UnifiedUsersList key="tecnicos" role="tecnico" openTarget={setManagedTarget} returnRevision={returnRevision} />');
    expect(hub).toContain('adminDb.rpc("eut_admin_users_unified_360"');
    expect(hub).toContain('queryError?.code === "PGRST202" || queryError?.code === "42883"');
    expect(hub).toContain('if (missingRpc) {');
    expect(hub).toContain('initialFilter={role === "todos" ? "todos" : role === "tecnico" ? "tecnicos" : "clientes"}');
    expect(hub).toContain('lockFilter initialLayout="table" />');
    expect(hub).toContain('exactAccountId={managedTarget.id}');
    expect(hub).toContain('selectedTechnicianId={managedTarget.id}');
    expect(hub).toContain('exactRecord={managedTarget}');
    expect(hub).not.toContain("<AdminTechnicianUnifiedDirectory");
    expect(hub).toContain('params={{ secao: "tecnicos" }}');
    expect(hub).toContain('aria-label="Administradores cadastrados"');
    expect(hub).toContain('.from("user_roles")');
    expect(hub).toContain('.eq("role", "admin")');
    expect(accounts).toContain('db.rpc("eut_admin_accounts_snapshot"');
    expect(accounts).toContain('db.rpc("eut_admin_contact_action"');
    expect(accounts).toContain("setSelectedIds(new Set())");
    expect(directory).toContain('eut_admin_technician_registry_list');
    expect(hub).not.toContain('auth.admin');
    expect(hub).not.toContain('service_role');
  });
  it("mostra tabelas operacionais compactas sem criar nova fonte de dados", () => {
    const hub = read("src/components/admin-users-hub.tsx");
    const accounts = read("src/components/admin-accounts-manager.tsx");
    expect(hub).toContain('initialLayout="table"');
    expect(accounts).toContain('aria-label="Contas cadastradas"');
    expect(accounts).toContain('aria-label="Modo de visualização"');
    expect(accounts).toContain('md:table-header-group');
    expect(accounts).toContain('block px-3 py-3 md:table-row');
    expect(accounts).toContain('initialLayout = "cards"');
    expect(accounts).toContain('masked_email');
    expect(accounts).toContain('db.rpc("eut_admin_accounts_snapshot"');
    expect(accounts).not.toMatch(/\bauth\.admin\.[A-Za-z_$][\w$]*\s*\(/);
    expect(accounts).not.toContain("service_role");
  });
  it("centraliza o menu sem apagar os caminhos legados ou alterar banco", () => {
    const navigation = read("src/components/admin-navigation.tsx");
    const preferences = read("src/lib/admin-navigation-preferences.ts");
    const page = read("src/routes/admin.tsx");
    expect(validAdminModule("usuarios")).toBe(true);
    expect(ADMIN_SECTIONS.find((section) => section.key === "usuarios")?.label).toBe("Usuários");
    expect(preferences).toContain('keys: ["usuarios", "tecnicos", "clientes", "contas", "contatos"]');
    expect(navigation).toContain("ADMIN_NAV_GROUPS.map((group) => {");
    expect(navigation).toContain("{keys.map((key) => moduleLink(key))}");
    expect(page).toContain('section === "usuarios" && <AdminUsersHub adminOwnerId={user.id} />');
    for (const section of ["tecnicos", "clientes", "contas", "contatos", "legado"])
      expect(validAdminModule(section)).toBe(true);
  });
  it("combina a rolagem independente da R1 com o menu unificado", () => {
    const navigation = read("src/components/admin-navigation.tsx");
    expect(navigation).toContain("lg:max-h-[calc(100dvh-7rem)]");
    expect(navigation).toContain("lg:flex lg:flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-scroll");
    expect(navigation).toContain("max-h-[65dvh] flex-col overflow-y-auto");
    expect(navigation).toContain("[scrollbar-gutter:stable]");
    expect(navigation).toContain("tabIndex={0}");
    expect(navigation).toContain('aria-current={chosen ? "page" : undefined}');
    expect(navigation).toContain('export const AdminShortcutLink = createLink(ShortcutAnchor)');
    expect(navigation).toContain("matchingAdminNavKeys(moduleQuery)");
    expect(navigation).not.toContain("lg:overflow-visible");
  });
  it("mantém todos os acessos históricos e os contatos administrativos disponíveis", () => {
    const hub = read("src/components/admin-users-hub.tsx");
    const page = read("src/routes/admin.tsx");
    for (const section of ["tecnicos", "clientes", "contas", "contatos", "legado", "reivindicacoes"])
      expect(hub).toContain('section: "' + section + '"');
    expect(hub).toContain('to="/admin/$secao"');
    expect(page).toContain('<AdminContactsDashboard adminId={user.id} />');
  });
  it("oferece recuperação da lista de admins sem refazer a navegação ou alterar contas", () => {
    const hub = read("src/components/admin-users-hub.tsx");
    expect(hub).toContain("const [refreshRevision, setRefreshRevision] = useState(0)");
    expect(hub).toContain("}, [page, refreshRevision, returnRevision]);");
    expect(hub).toContain("onClick={() => setRefreshRevision((revision) => revision + 1)}");
    expect(hub).toContain('{error ? "Tentar novamente" : "Atualizar lista"}');
    expect(hub).toContain('disabled={loading}');
    expect(hub).toContain("if (active) setLoading(false)");
  });
});