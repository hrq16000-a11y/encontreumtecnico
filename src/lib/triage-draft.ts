import { categorySlug } from "./problem-triage-local";

const KEY = "eut-triage-draft-v1";
const MAX_AGE_MS = 30 * 60 * 1000;

export type TriageDraft = {
  description: string;
  category: string;
  city: string;
  region: string;
  savedAt: number;
};

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

// Same-tab, short-lived and never sent without a later explicit form submission.
export function saveTriageDraft(value: Omit<TriageDraft, "savedAt">): boolean {
  const target = storage();
  const description = value.description.trim().slice(0, 1000);
  if (!target || description.length < 10) return false;
  try {
    target.setItem(KEY, JSON.stringify({
      description,
      category: value.category === "Todas" ? "Todas" : categorySlug(value.category) ?? "Todas",
      city: value.city.trim().slice(0, 80),
      region: value.region.trim().slice(0, 120),
      savedAt: Date.now(),
    } satisfies TriageDraft));
    return true;
  } catch {
    return false;
  }
}

export function consumeTriageDraft(): TriageDraft | null {
  const target = storage();
  if (!target) return null;
  try {
    const raw = target.getItem(KEY);
    target.removeItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<TriageDraft>;
    if (typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt) ||
        value.savedAt > Date.now() + 60_000 || Date.now() - value.savedAt > MAX_AGE_MS ||
        typeof value.description !== "string" || value.description.trim().length < 10 ||
        value.description.length > 1000 || typeof value.city !== "string" ||
        typeof value.region !== "string" || typeof value.category !== "string") return null;
    return {
      description: value.description,
      category: value.category === "Todas" ? "Todas" : categorySlug(value.category) ?? "Todas",
      city: value.city.slice(0, 80),
      region: value.region.slice(0, 120),
      savedAt: value.savedAt,
    };
  } catch {
    return null;
  }
}
