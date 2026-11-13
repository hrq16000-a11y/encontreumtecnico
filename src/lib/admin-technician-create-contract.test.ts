import { describe, expect, it } from "vitest";
import { confirmCreatedTechnician, isProvisionableAccount, prepareAdminTechnicianCreation,
  type ProvisionableAccount, type OfficialCity } from "./admin-technician-create-contract";

const account: ProvisionableAccount = {
  id: "00000000-0000-4000-8000-000000000006", full_name: "Profissional Sintético",
  masked_email: "pr•••@example.test", email_confirmed: true,
  is_technician: true, is_admin: false, technician_id: null,
  blocked_account: false, blocked_phone: false,
};
const city: OfficialCity = { id: 4125506, name: "São José dos Pinhais", uf: "PR" };
const input = {
  account, city, category: "computadores", activeSlugs: ["computadores", "redes"],
  name: "Profissional Sintético", reason: "Criar ficha pendente para conta confirmada",
};
describe("admin technician create: real RPC contract, not a preview", () => {
  it("requires a legitimate verified technician with no existing profile or bans", () => {
    expect(isProvisionableAccount(account)).toBe(true);
    for(const update of [
      { email_confirmed: false }, { is_technician: false }, { is_admin: true },
      { blocked_account: true }, { blocked_phone: true }, { technician_id: account.id },
    ]) expect(isProvisionableAccount({ ...account, ...update })).toBe(false);
  });
  it("validates IBGE, active category, reason and public name", () => {
    expect(prepareAdminTechnicianCreation(input)).toMatchObject({ ok: true });
    for (const delta of [
      {city: { ...city, id: 1 }},{ category:"desativada" },
      { name:"WhatsApp +5541999999999"},{reason:"short"},
      { reason:"Enviar para contato@example.test" }
    ]) expect(prepareAdminTechnicianCreation({ ...input, ...delta }).ok).toBe(false);
  });
  it("only confirms success with server response, durable row AND actor-bound audit", () => {
    const request = prepareAdminTechnicianCreation(input);
    expect(request.ok).toBe(true);
    if (!request.ok) return;
    const response = { ok:true,technician_id:"10000000-0000-4000-8000-000000000006",
      audit_id:42,status:"pendente",city_ibge_id:city.id,category_slug:"computadores" };
    const row = {id:response.technician_id,user_id:account.id,display_name:input.name,
      city:city.name,state_uf:city.uf,specialties:["computadores"],status:"pendente"};
    const audit = {id:42,actor_id:"00000000-0000-4000-8000-000000000001",
      target_type:"technician",target_key:response.technician_id,action:"technician_created"};
    const actor = audit.actor_id;
    expect(confirmCreatedTechnician(response,row,audit,request.payload,city,actor)).toBe(true);
    expect(confirmCreatedTechnician(response,row,null,request.payload,city,actor)).toBe(false);
    expect(confirmCreatedTechnician(response,{...row,status:"aprovado"},audit,request.payload,city,actor)).toBe(false);
    expect(confirmCreatedTechnician(response,row,{...audit,actor_id:account.id},request.payload,city,actor)).toBe(false);
  });
});
