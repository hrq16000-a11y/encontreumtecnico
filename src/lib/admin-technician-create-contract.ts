/** Domain checks for real, owner-authorized creation; server RPC remains authority. */
export type ProvisionableAccount = {
  id: string; full_name: string; masked_email: string | null;
  email_confirmed: boolean; is_technician: boolean; is_admin: boolean;
  technician_id: string | null; blocked_account: boolean; blocked_phone: boolean;
};
export type OfficialCity = { id: number; name: string; uf: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_TEXT = /(?:https?:\/\/|www\.|wa\.me|@|\+?\d[\d ().-]{8,}\d)/i;
export function isProvisionableAccount(a: ProvisionableAccount): boolean {
  return UUID.test(a.id) && a.email_confirmed && a.is_technician &&
    !a.is_admin && !a.technician_id && !a.blocked_account && !a.blocked_phone;
}
export type CreateSelection = {
  account: ProvisionableAccount | undefined;
  city: OfficialCity | undefined;
  category: string;
  activeSlugs: string[];
  name: string;
  reason: string;
};
export type CreatePayload = {
  _target_user_id: string; _display_name: string; _city_ibge_id: number;
  _category_slug: string; _reason: string;
};
export function prepareAdminTechnicianCreation(input: CreateSelection):
  { ok: true; payload: CreatePayload } | { ok: false; issue: string } {
  const { account, city, category, activeSlugs } = input;
  if (!account || !isProvisionableAccount(account))
    return { ok: false, issue: "Selecione uma conta técnica confirmada, sem ficha ou bloqueios." };
  if (!city || !Number.isInteger(city.id) || city.id < 1000000 ||
      city.id > 9999999 || !/^[A-Z]{2}$/.test(city.uf))
    return { ok: false, issue: "Selecione uma cidade oficial do IBGE." };
  if (!category || !activeSlugs.includes(category))
    return { ok: false, issue: "Selecione uma categoria ativa do catálogo." };
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 80 || PRIVATE_TEXT.test(name))
    return { ok: false, issue: "Informe nome público válido, sem contato ou URL." };
  const reason = input.reason.trim();
  if (reason.length < 8 || reason.length > 400 || PRIVATE_TEXT.test(reason))
    return { ok: false, issue: "Informe motivo de 8 a 400 caracteres sem dados de contato." };
  return { ok: true, payload: {
    _target_user_id: account.id, _display_name: name, _city_ibge_id: city.id,
    _category_slug: category, _reason: reason,
  } };
}
export type CreateConfirmation = {
  ok?: boolean; technician_id?: string; audit_id?: number;
  status?: string; city_ibge_id?: number; category_slug?: string;
};
export type PersistedTechnician = {
  id: string; user_id: string; display_name: string; city: string; state_uf: string;
  specialties: string[]; status: string;
};
export type CreationAudit = {
  id: number; actor_id: string; target_type: string; target_key: string; action: string;
};
export function confirmCreatedTechnician(
  response: CreateConfirmation, row: PersistedTechnician | null,
  audit: CreationAudit | null, request: CreatePayload, city: OfficialCity, actorId: string,
): boolean {
  return response.ok === true && UUID.test(response.technician_id ?? "") &&
    Number.isInteger(response.audit_id) && response.status === "pendente" &&
    response.city_ibge_id === city.id && response.category_slug === request._category_slug &&
    row?.id === response.technician_id && row?.user_id === request._target_user_id &&
    row?.display_name === request._display_name && row?.city === city.name &&
    row?.state_uf === city.uf && row?.status === "pendente" &&
    row.specialties.length === 1 && row.specialties[0] === request._category_slug &&
    audit?.id === response.audit_id && audit.actor_id === actorId &&
    audit.target_type === "technician" && audit.target_key === response.technician_id &&
    audit.action === "technician_created";
}
