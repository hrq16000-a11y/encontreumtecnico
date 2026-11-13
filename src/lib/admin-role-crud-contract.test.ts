import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (name: string) => readFileSync(name, "utf8");
const admin = source("src/routes/admin.tsx");
const accounts = source("src/components/admin-accounts-manager.tsx");
const invites = source("src/components/admin-member-invites.tsx");

describe("Administração de técnicos e clientes por papel", () => {
  it("separa criação por convite nas duas áreas e mantém visão global", () => {
    expect(admin).toContain('<AdminMemberInvites initialRole="tecnico" />');
    expect(admin).toContain('<AdminMemberInvites initialRole="cliente" />');
    expect(admin).toContain("<AdminMemberInvites /><AdminAccountsManager />");
    expect(invites).toContain("const effectiveRole = scopedRole ?? role");
    expect(invites).toContain("_role: effectiveRole");
    expect(invites).toContain("entry.target_role === scopedRole");
    expect(invites).toContain("!scopedRole && <label");
  });

  it("permite gerir identidades técnicas sem carregar a lista antes da abertura", () => {
    expect(admin).toContain("<TechnicianAccountControls />");
    expect(admin).toContain('open && <AdminAccountsManager initialFilter="tecnicos" />');
    expect(admin).toContain('<AdminAccountsManager initialFilter="clientes" />');
    expect(accounts).toContain('const scopedFilter = initialFilter === "tecnicos" || initialFilter === "clientes"');
    expect(accounts).toContain("!scopedFilter && <div");
    expect(accounts).toContain('db.rpc("eut_admin_accounts_snapshot"');
    expect(accounts).toContain('db.rpc("eut_admin_account_edit_name"');
    expect(accounts).toContain('db.rpc("eut_admin_contact_action"');
  });

  it("revoga convite somente com justificativa própria e evita exclusões ou bypass de contato", () => {
    expect(invites).toContain("const justification = revokeReason.trim()");
    expect(invites).toContain("justification.length < 8 || justification.length > 400");
    expect(invites).toContain("_reason: justification");
    expect(invites).toContain('db.rpc("eut_admin_member_invite_action"');
    for (const code of [accounts, invites, admin]) {
      expect(code).not.toContain("supabase.auth.admin");
      expect(code).not.toContain("service_role");
      expect(code).not.toMatch(/delete\s*\(\s*\)\s*\.\s*eq\(/);
    }
    expect(accounts).toContain("exclusão definitiva não estão habilitadas neste módulo");
  });
});
