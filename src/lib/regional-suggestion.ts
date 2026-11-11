import { BRAZIL_STATES } from "./service-taxonomy";

export type RegionalSuggestion = {
  city: string;
  uf: string;
  neighborhood: string;
  source: "ip" | "gps";
};

const KEY = "eut-regional-hint-v1";
const TTL = 6 * 60 * 60 * 1000;
const VALID_CITY = /^[\p{L}\p{M} .'-]{2,80}$/u;

function cityText(raw: unknown) {
  if (typeof raw !== "string") return "";
  let text = raw;
  try { text = decodeURIComponent(raw); } catch { return ""; }
  text = text.trim().replace(/\s+/g, " ");
  return VALID_CITY.test(text) ? text : "";
}

/** Coarse IP lookup, never exact location. Do not trust operator/ISP or postcode as a neighborhood. */
export function parseVercelRegion(headers: {
  country: string | null; state: string | null; city: string | null;
}): RegionalSuggestion | null {
  if (headers.country !== "BR") return null;
  const uf = headers.state?.toUpperCase() ?? "";
  const city = cityText(headers.city);
  if (!city || !BRAZIL_STATES.some(s => s === uf)) return null;
  return { city, uf, neighborhood: "", source: "ip" };
}

function normalize(area: RegionalSuggestion): RegionalSuggestion | null {
  const city = cityText(area.city);
  const uf = area.uf?.toUpperCase() ?? "";
  if (!city || !BRAZIL_STATES.some(s => s === uf)) return null;
  return {
    city, uf, source: area.source,
    neighborhood: area.source === "gps" ? cityText(area.neighborhood) : "",
  };
}

export function getSavedRegionalHint(storage?: Storage | null, now = Date.now()): RegionalSuggestion | null {
  try {
    const s = storage === undefined ? (typeof window === "undefined" ? null : window.sessionStorage) : storage;
    const raw = s?.getItem(KEY);
    if (!raw) return null;
    const item = JSON.parse(raw) as RegionalSuggestion & { savedAt: number };
    if (typeof item.savedAt !== "number" || !Number.isFinite(item.savedAt) ||
      item.savedAt > now + 60_000 || now - item.savedAt > TTL ||
      (item.source !== "gps" && item.source !== "ip")) return null;
    return normalize(item);
  } catch { return null; }
}

export function rememberRegionalHint(area: RegionalSuggestion, storage?: Storage | null, now = Date.now()) {
  try {
    const s = storage === undefined ? (typeof window === "undefined" ? null : window.sessionStorage) : storage;
    const normalized = normalize(area);
    if (!s || !normalized) return false;
    const previous = getSavedRegionalHint(s, now);
    if (previous?.source === "gps" && normalized.source === "ip") return false;
    s.setItem(KEY, JSON.stringify({ ...normalized, savedAt: now }));
    if (storage === undefined && typeof window !== "undefined")
      window.dispatchEvent(new Event("eut-regional-hint"));
    return true;
  } catch { return false; }
}
