import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canRevealAdminContact, validateAdminContactAction, type AdminContactAction } from "./admin-contact-controls";
const uuid="b190db33-86e1-4cf4-b916-a1f4eac56720";
const base={reason:"Solicitação administrativa autorizada",userId:uuid,phone:"",blockId:null,messageId:null,messageStatus:"respondida"};
const validate=(action:AdminContactAction, overrides:Partial<typeof base>={}) =>
  validateAdminContactAction({...base,...overrides,action});

describe("Administração de contatos — operações auditadas",()=>{
  it("exige motivo real e descarta controles inválidos antes da requisição",()=>{
    expect(canRevealAdminContact("motivo de auditoria")).toBe(true);
    expect(canRevealAdminContact("curto")).toBe(false);
    expect(canRevealAdminContact("x".repeat(501))).toBe(false);
    expect(validate("block_account",{reason:"curto"})).toMatch(/motivo/);
    expect(validate("suspend_account",{userId:null})).toMatch(/conta/);
    expect(validate("request_review",{userId:"evil"})).toMatch(/conta/);
    expect(validate("unblock_account")).toBeNull();
  });
  it("valida telefones somente no bloqueio, nunca embutidos em perfis públicos",()=>{
    expect(validate("block_phone",{phone:"41 99999-8888"})).toBeNull();
    expect(validate("block_phone",{phone:"5541999998888"})).toBeNull();
    expect(validate("block_phone",{phone:"0000000000"})).toMatch(/DDD/);
    expect(validate("block_phone",{phone:""})).toMatch(/DDD/);
    expect(validate("unblock_phone",{blockId:uuid})).toBeNull();
    expect(validate("unblock_phone",{blockId:null})).toMatch(/bloqueio/);
  });
  it("valida ações com mensagens",()=>{
    expect(validate("mark_message",{messageId:uuid})).toBeNull();
    expect(validate("mark_message",{messageId:null})).toMatch(/mensagem/);
    expect(validate("mark_message",{messageId:uuid,messageStatus:"deletada"})).toMatch(/mensagem/);
  });
  it("usa apenas RPCs administrativas existentes; não armazena contatos nem abre outras contas",()=>{
    const component=readFileSync("src/components/admin-contacts-dashboard.tsx","utf8");
    const page=readFileSync("src/routes/admin.tsx","utf8");
    const nav=readFileSync("src/lib/admin-sections.ts","utf8");
    expect(component).toContain('db.rpc("eut_admin_contacts_dashboard"');
    expect(component).toContain('db.rpc("eut_admin_contact_reveal"');
    expect(component).toContain('db.rpc("eut_admin_contact_action"');
    expect(component).toContain('setTimeout(() => {');
    expect(component).toContain("revealTimeout.current");
    expect(component).toContain("role");
    expect(component).not.toContain("localStorage.setItem");
    expect(component).not.toContain("sessionStorage.setItem");
    expect(component).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(component).not.toContain("auth.admin");
    expect(page).toContain('section === "contatos"');
    expect(nav).toContain('key: "contatos"');
  });
});
