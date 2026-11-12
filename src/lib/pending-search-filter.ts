/** Same-tab, non-sensitive pending search text; never store contact details.
 * A pending keystroke is restored only while the URL filter still equals the
 * value before typing, preventing stale text from overriding a new search.
 */
type Saved = { original: string; draft: string; savedAt: number };
const PREFIX = "eut-filter-pending-v1:";
const VALID = new Set(["filtro-cidade", "filtro-bairro", "filtro-regiao"]);
const TTL_MS = 45 * 60 * 1000;
function store(storage?: Storage): Storage | null {
  try { return storage ?? (typeof window === "undefined" ? null : window.sessionStorage); }
  catch { return null; }
}
function key(id: string): string | null { return VALID.has(id) ? PREFIX + id : null; }
export function savePendingFilter(id: string, original: string, draft: string, storage?: Storage, now = Date.now()): boolean {
  try {
    const k = key(id), s = store(storage);
    if (!k || !s || original.length > 120 || draft.length > 120) return false;
    s.setItem(k, JSON.stringify({ original, draft, savedAt: now } satisfies Saved));
    return true;
  } catch { return false; }
}
export function readPendingFilter(id: string, current: string, storage?: Storage, now = Date.now()): string | null {
  try {
    const k = key(id), raw = k ? store(storage)?.getItem(k) : null;
    if (!raw || raw.length > 500) return null;
    const data = JSON.parse(raw) as Partial<Saved>;
    if (data.original !== current || typeof data.draft !== "string" || data.draft.length > 120 ||
        typeof data.savedAt !== "number" || data.savedAt > now + 60000 || now - data.savedAt > TTL_MS)
      return null;
    return data.draft;
  } catch { return null; }
}
export function clearPendingFilter(id: string, storage?: Storage): void {
  try { const k = key(id); if (k) store(storage)?.removeItem(k); } catch { /* storage disabled */ }
}
