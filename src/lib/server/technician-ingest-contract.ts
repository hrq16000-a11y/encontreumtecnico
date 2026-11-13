/** Server-only input contract for the EXISTING technicians catalog. No database writes.
 * privateWrites MUST remain on trusted backend; never send to frontend, SSR or logs.
 */
import { normalizeBrazilianPhone } from "../brazilian-phone.ts";
import { BRAZIL_STATES } from "../service-taxonomy.ts";

export type Origin = "manual" | "wordpress" | "external" | "organic";
export type TechnicianInput = {
  origin: Origin; sourceId: string; phone: string;
  displayName?: string | null;
  officialCity?: { ibgeId: number; name: string; uf: string } | null;
};
export type ExistingSource = {
  technicianId: string; origin: Origin; sourceId: string;
  phoneE164: string | null; enabled: boolean; blocked: boolean;
};
export type PrivateWrite = {
  operation: "create" | "update"; technicianId: string | null;
  origin: Origin; sourceId: string; phoneE164: string; ddd: string;
  displayName: string | null;
  officialCity: { ibgeId: number; name: string; uf: string } | null;
  enabled: boolean;
};
export type DecisionCode =
  | "invalid_source" | "invalid_phone" | "invalid_profile"
  | "conflicting_source" | "shared_phone" | "blocked" | "duplicate_in_batch";
export type BatchSummary = {
  creates: number; updates: number; deduplicated: number;
  quarantined: number; rejected: number;
  decisions: Array<{ index: number; code: DecisionCode }>;
};
const ORIGINS = new Set(["manual", "wordpress", "external", "organic"]);
const SOURCE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_CONTACT = /(?:https?:\/\/|www\.|wa\.me|@|\+?\d[\d ().-]{8,}\d)/i;
const identityKey = (source: string, id: string) => source + ":" + id;
function cleanedName(value: string | null | undefined): string | null | undefined {
  const name = value?.trim() ?? "";
  if (!name) return null;
  return name.length >= 3 && name.length <= 80 && !PUBLIC_CONTACT.test(name) ? name : undefined;
}
function validCity(city: TechnicianInput["officialCity"]): boolean {
  return city == null || (Number.isSafeInteger(city.ibgeId) && city.ibgeId >= 1000000 &&
    city.ibgeId <= 9999999 && BRAZIL_STATES.some((uf) => uf === city.uf) &&
    city.name.trim().length >= 2 && city.name.length <= 100 &&
    !PUBLIC_CONTACT.test(city.name));
}

/** Never infer a real identity solely from a shared phone. Never reactivate a disabled source. */
export function prepareTechnicianIngest(
  rows: readonly TechnicianInput[],
  existing: readonly ExistingSource[],
  restrictedPhones: ReadonlySet<string> = new Set(),
): { privateWrites: PrivateWrite[]; summary: BatchSummary } {
  const summary: BatchSummary = {
    creates: 0, updates: 0, deduplicated: 0,
    quarantined: 0, rejected: 0, decisions: [],
  };
  const privateWrites: PrivateWrite[] = [];
  const byIdentity = new Map<string, ExistingSource[]>();
  const phoneOwners = new Map<string, Set<string>>();
  for (const item of existing) {
    const key = identityKey(item.origin, item.sourceId);
    byIdentity.set(key, [...(byIdentity.get(key) ?? []), item]);
    if (item.phoneE164) {
      const owners = phoneOwners.get(item.phoneE164) ?? new Set<string>();
      owners.add(item.technicianId);
      phoneOwners.set(item.phoneE164, owners);
    }
  }
  const prepared = rows.map(row => ({
    row, phone: normalizeBrazilianPhone(row.phone),
    key: identityKey(String(row.origin), row.sourceId?.trim() ?? ""),
  }));
  const phonesByKey = new Map<string, Set<string>>();
  const keysByPhone = new Map<string, Set<string>>();
  for (const item of prepared) {
    if (!item.phone) continue;
    const phones = phonesByKey.get(item.key) ?? new Set<string>();
    phones.add(item.phone); phonesByKey.set(item.key, phones);
    const keys = keysByPhone.get(item.phone) ?? new Set<string>();
    keys.add(item.key); keysByPhone.set(item.phone, keys);
  }
  const seen = new Set<string>();
  prepared.forEach(({ row, phone, key }, index) => {
    const origin = String(row.origin);
    const sourceId = row.sourceId?.trim() ?? "";
    const reject = (code: DecisionCode, quarantine = false): void => {
      if (quarantine) summary.quarantined++; else summary.rejected++;
      summary.decisions.push({ index, code });
    };
    if (!ORIGINS.has(origin) || !SOURCE_ID.test(sourceId)) return reject("invalid_source");
    if (!phone) return reject("invalid_phone");
    const name = cleanedName(row.displayName);
    if (name === undefined || !validCity(row.officialCity)) return reject("invalid_profile");
    if ((phonesByKey.get(key)?.size ?? 0) > 1) return reject("conflicting_source", true);
    if ((keysByPhone.get(phone)?.size ?? 0) > 1) return reject("shared_phone", true);
    if (seen.has(key)) {
      summary.deduplicated++;
      summary.decisions.push({ index, code: "duplicate_in_batch" });
      return;
    }
    seen.add(key);
    const matches = byIdentity.get(key) ?? [];
    if (matches.length > 1) return reject("conflicting_source", true);
    const old = matches[0];
    if (restrictedPhones.has(phone) || old?.blocked) return reject("blocked", true);
    const owners = phoneOwners.get(phone);
    if (owners && (!old || owners.size !== 1 || !owners.has(old.technicianId)))
      return reject("shared_phone", true);
    if (old && !UUID.test(old.technicianId)) return reject("conflicting_source", true);
    privateWrites.push({
      operation: old ? "update" : "create", technicianId: old?.technicianId ?? null,
      origin: row.origin, sourceId, phoneE164: phone, ddd: phone.slice(3, 5),
      displayName: name ?? null, officialCity: row.officialCity ?? null,
      enabled: old?.enabled ?? true,
    });
    if (old) summary.updates++; else summary.creates++;
  });
  return { privateWrites, summary };
}
