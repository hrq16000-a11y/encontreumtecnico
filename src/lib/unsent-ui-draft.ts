/** Short-lived local drafts for NON-SENSITIVE search text, scoped to one tab.
 * Passwords, client account data, raw GPS coordinates and card fields are excluded.
 */
export type UiDraftSlot = "home" | "home2" | "problem" | "lp2-home" | "lp2-gallery";
const PREFIX = "eut-ui-text-v1:";
const TTL = 45 * 60 * 1000;
const MAX = 3500;

function store(storage?: Storage) {
  try { return storage ?? (typeof window === "undefined" ? null : window.sessionStorage); } catch { return null; }
}
export function readUiTextDraft(slot: UiDraftSlot, storage?: Storage, now = Date.now()): Record<string, string> | null {
  try {
    const raw = store(storage)?.getItem(PREFIX + slot);
    if (!raw || raw.length > MAX) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown; values?: unknown };
    if (typeof parsed.savedAt !== "number" || parsed.savedAt > now + 60000 || now - parsed.savedAt > TTL ||
        !parsed.values || typeof parsed.values !== "object" || Array.isArray(parsed.values)) return null;
    const entries = Object.entries(parsed.values);
    if (entries.length > 8 || entries.some(([key, value]) =>
        !/^[a-z]{1,25}$/.test(key) || typeof value !== "string" || value.length > 1000)) return null;
    return Object.fromEntries(entries) as Record<string, string>;
  } catch { return null; }
}
export function saveUiTextDraft(slot: UiDraftSlot, values: Record<string, string>, storage?: Storage, now = Date.now()): boolean {
  try {
    const target = store(storage);
    if (!target) return false;
    const payload = JSON.stringify({ savedAt: now, values });
    if (payload.length > MAX) return false;
    target.setItem(PREFIX + slot, payload);
    return true;
  } catch { return false; }
}
export function clearUiTextDraft(slot: UiDraftSlot, storage?: Storage) {
  try { store(storage)?.removeItem(PREFIX + slot); } catch { /* ignore blocked storage */ }
}
