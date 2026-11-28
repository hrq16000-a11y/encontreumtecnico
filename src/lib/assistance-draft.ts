import type { AssistanceMode } from "./assistance-intent";

/** A reload-safe draft for the PUBLIC intake wizard only.
 * One tab, 45-minute TTL, scoped to the selected public technician ID or explicit portal-help intent.
 * Never stores passwords, GPS coordinates, payment data or the consent flag.
 */
export type AssistanceDraft = {
  mode: AssistanceMode | null;
  step: number;
  name: string;
  email: string;
  service: string;
  when: string;
  problem: string;
  city: string;
  uf: string;
  neighborhood: string;
};

const PREFIX = "eut-assistance-unsent-v1:";
const TTL = 45 * 60 * 1000;
const MAX_LEN = 6000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PORTAL_SCOPE = /^portal-(home|contato)-(geral|privacidade)$/;
function key(scope?: string): string {
  return PREFIX + (scope && (UUID.test(scope) || PORTAL_SCOPE.test(scope)) ? scope : "general");
}
function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}
const fields = ["name", "email", "service", "when", "problem", "city", "uf", "neighborhood"] as const;

export function readAssistanceDraft(scope?: string, storage?: Storage, now = Date.now()): AssistanceDraft | null {
  try {
    const raw = getStorage(storage)?.getItem(key(scope));
    if (!raw || raw.length > MAX_LEN) return null;
    const obj = JSON.parse(raw) as AssistanceDraft & { savedAt: number };
    if (typeof obj.savedAt !== "number" || !Number.isFinite(obj.savedAt) ||
        obj.savedAt > now + 60_000 || now - obj.savedAt > TTL ||
        (obj.mode !== null && obj.mode !== "direct" && obj.mode !== "managed") ||
        !Number.isInteger(obj.step) || typeof obj.step !== "number" ||
        obj.step < 0 || obj.step > 2 ||
        fields.some(field => typeof obj[field] !== "string")) return null;
    return {
      mode: obj.mode as AssistanceMode | null,
      step: obj.step,
      name: String(obj.name).slice(0, 100),
      email: String(obj.email).slice(0, 255),
      service: String(obj.service).slice(0, 100),
      when: String(obj.when).slice(0, 80),
      problem: String(obj.problem).slice(0, 1400),
      city: String(obj.city).slice(0, 80),
      uf: String(obj.uf).slice(0, 2),
      neighborhood: String(obj.neighborhood).slice(0, 80),
    };
  } catch { return null; }
}

export function saveAssistanceDraft(scope: string | undefined, draft: AssistanceDraft, storage?: Storage, now = Date.now()): boolean {
  try {
    const target = getStorage(storage);
    if (!target) return false;
    const raw = JSON.stringify({ ...draft, savedAt: now });
    if (raw.length > MAX_LEN) return false;
    target.setItem(key(scope), raw);
    return true;
  } catch { return false; }
}

export function clearAssistanceDraft(scope?: string, storage?: Storage): void {
  try { getStorage(storage)?.removeItem(key(scope)); } catch { /* storage unavailable */ }
}
