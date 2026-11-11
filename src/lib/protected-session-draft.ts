/** Short-lived, same-tab draft storage, separated by authenticated account.
 * Never use for passwords, payment data, session tokens or paid entitlements.
 */
export type ProtectedDraftKind = "cliente" | "tecnico";
const PREFIX = "eut-unsent-v1";
const MAX_AGE = 45 * 60 * 1000;
const MAX_BYTES = 7500;

function key(kind: ProtectedDraftKind, owner: string): string | null {
  return /^[A-Za-z0-9-]{3,128}$/.test(owner) ? PREFIX + ":" + kind + ":" + owner : null;
}
function storage(override?: Storage): Storage | null {
  if (override) return override;
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}

export function readProtectedDraft<T>(
  kind: ProtectedDraftKind, owner: string, override?: Storage, now = Date.now(),
): { form: T; step: number } | null {
  try {
    const k = key(kind, owner);
    const raw = k ? storage(override)?.getItem(k) : null;
    if (!raw || raw.length > MAX_BYTES) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.owner !== owner || data.kind !== kind || typeof data.savedAt !== "number" ||
        !Number.isFinite(data.savedAt) || data.savedAt > now + 60_000 ||
        now - data.savedAt > MAX_AGE || typeof data.form !== "object" ||
        data.form === null || Array.isArray(data.form) ||
        typeof data.step !== "number" || !Number.isInteger(data.step) ||
        data.step < 1 || data.step > 4) return null;
    return { form: data.form as T, step: data.step };
  } catch { return null; }
}
export function saveProtectedDraft<T extends object>(
  kind: ProtectedDraftKind, owner: string, form: T, step: number,
  override?: Storage, now = Date.now(),
): boolean {
  try {
    const k = key(kind, owner), s = storage(override);
    if (!k || !s || !Number.isInteger(step) || step < 1 || step > 4) return false;
    const payload = JSON.stringify({ kind, owner, form, step, savedAt: now });
    if (payload.length > MAX_BYTES) return false;
    s.setItem(k, payload);
    return true;
  } catch { return false; }
}
export function clearProtectedDraft(kind: ProtectedDraftKind, owner: string, override?: Storage) {
  try {
    const k = key(kind, owner);
    if (k) storage(override)?.removeItem(k);
  } catch { /* Storage can be blocked by the browser. */ }
}
