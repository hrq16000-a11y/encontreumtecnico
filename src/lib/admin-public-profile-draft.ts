import { publicTextProblem } from "./public-profile-text";

/** Same-tab draft for PUBLIC technician profile text edited by an administrator.
 * No phone, e-mail, account edits, moderation reasons, payment or authorization
 * are allowed in this store. Saving is an explicit UI edit, never an RPC.
 */
export type AdminPublicFields = { display_name: string; bio: string; region: string };
const PREFIX = "eut-admin-public-edit-v1:";
const TTL = 15 * 60 * 1000;
const MAX = 3500;
const validId = (value: string) => /^[a-zA-Z0-9-]{3,128}$/.test(value);
const storage = (override?: Storage) => {
  try { return override ?? (typeof window === "undefined" ? null : window.sessionStorage); }
  catch { return null; }
};
const key = (adminId: string, technicianId: string) =>
  validId(adminId) && validId(technicianId) ? PREFIX + adminId + ":" + technicianId : null;

function safe(values: AdminPublicFields): boolean {
  return typeof values.display_name === "string" && values.display_name.length <= 80 &&
    typeof values.region === "string" && values.region.length <= 100 &&
    typeof values.bio === "string" && values.bio.length <= 1500 &&
    !publicTextProblem(values.display_name, "identity") &&
    !publicTextProblem(values.region, "identity") &&
    !publicTextProblem(values.bio, "bio");
}

export function saveAdminPublicDraft(
  adminId: string, technicianId: string, baseline: AdminPublicFields,
  values: AdminPublicFields, override?: Storage, now = Date.now(),
): boolean {
  try {
    const k = key(adminId, technicianId), s = storage(override);
    if (!k || !s || !safe(values) || !safe(baseline)) return false;
    const raw = JSON.stringify({ adminId, technicianId, baseline, values, savedAt: now });
    if (raw.length > MAX) return false;
    s.setItem(k, raw);
    return true;
  } catch { return false; }
}

export function readAdminPublicDraft(
  adminId: string, technicianId: string, baseline: AdminPublicFields,
  override?: Storage, now = Date.now(),
): AdminPublicFields | null {
  try {
    const k = key(adminId, technicianId);
    const raw = k ? storage(override)?.getItem(k) : null;
    if (!raw || raw.length > MAX) return null;
    const data = JSON.parse(raw) as {
      adminId?: string; technicianId?: string; baseline?: AdminPublicFields;
      values?: AdminPublicFields; savedAt?: number;
    };
    if (data.adminId !== adminId || data.technicianId !== technicianId ||
        typeof data.savedAt !== "number" || !Number.isFinite(data.savedAt) ||
        data.savedAt > now + 60_000 || now - data.savedAt > TTL ||
        JSON.stringify(data.baseline) !== JSON.stringify(baseline) ||
        !data.values || !safe(data.values)) return null;
    return data.values;
  } catch { return null; }
}

export function clearAdminPublicDraft(adminId: string, technicianId: string, override?: Storage) {
  try { const k = key(adminId, technicianId); if (k) storage(override)?.removeItem(k); }
  catch { /* Browser can block session storage. */ }
}
