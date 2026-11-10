const KEY = "eut-direct-target-v1";
const TTL_MS = 30 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function session(): Storage | null {
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage; } catch { return null; }
}

/** Retain only the public technician UUID within the same browser tab. */
export function rememberTechnicianTarget(id: string): boolean {
  if (!UUID.test(id)) return false;
  const storage = session();
  if (!storage) return false;
  try {
    storage.setItem(KEY, JSON.stringify({ id, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export function recallTechnicianTarget(): string | null {
  const storage = session();
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { id?: unknown; savedAt?: unknown };
    if (typeof entry.id === "string" && UUID.test(entry.id) &&
        typeof entry.savedAt === "number" && Number.isFinite(entry.savedAt) &&
        entry.savedAt <= Date.now() + 60_000 && Date.now() - entry.savedAt <= TTL_MS) return entry.id;
    storage.removeItem(KEY);
  } catch {
    try { storage.removeItem(KEY); } catch { /* storage unavailable */ }
  }
  return null;
}

export function clearTechnicianTarget() {
  try { session()?.removeItem(KEY); } catch { /* storage unavailable */ }
}
