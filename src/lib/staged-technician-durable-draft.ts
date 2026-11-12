import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Staged PostgREST adapter for a table that DOES NOT exist in production yet.
 * Nothing imports it in area-tecnico.tsx. Backend availability must be verified
 * after a separately approved migration before any caller enables it.
 */
export type TechnicianDraftFields = {
  display_name: string;
  state_uf: string;
  city: string;
  neighborhood: string;
  region: string;
  bio: string;
  specialties: string[];
  service_slugs: string[];
  base_city_ibge_id: number | null;
};
export type DurableDraftRecord = {
  form: TechnicianDraftFields;
  step: 1 | 2 | 3;
  revision: number;
  expiresAt: string;
};
export type DraftOperation<T> =
  | { status: "ok"; value: T }
  | { status: "missing" }
  | { status: "conflict" }
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "failed" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTACT = /https?:\/\/|www\.|wa\.me|@|[+]?\d[\d\s().+-]{8,}\d/i;
const SIZES: Record<"display_name" | "state_uf" | "city" | "neighborhood" | "region" | "bio", number> = {
  display_name: 80, state_uf: 2, city: 80, neighborhood: 100, region: 120, bio: 2000,
};
const STRINGS = ["display_name", "state_uf", "city", "neighborhood", "region", "bio"] as const;
const ARRAY_FIELDS = ["specialties", "service_slugs"] as const;

export function validateDraftPayload(form: TechnicianDraftFields): TechnicianDraftFields | null {
  if (typeof form !== "object" || !form) return null;
  const fields = Object.keys(form);
  if (fields.length !== 9 || fields.some(k =>
    !STRINGS.includes(k as typeof STRINGS[number]) &&
    !ARRAY_FIELDS.includes(k as typeof ARRAY_FIELDS[number]) &&
    k !== "base_city_ibge_id")) return null;
  for (const field of STRINGS) {
    const value = form[field];
    if (typeof value !== "string" || value.length > SIZES[field] || CONTACT.test(value))
      return null;
  }
  for (const [field, cap] of [["specialties", 12], ["service_slugs", 64]] as const) {
    const value = form[field];
    if (!Array.isArray(value) || value.length > cap ||
        value.some(s => typeof s !== "string" || s.length < 1 || s.length > 80)) return null;
  }
  if (form.base_city_ibge_id !== null &&
      (!Number.isInteger(form.base_city_ibge_id) || form.base_city_ibge_id < 1000000 ||
       form.base_city_ibge_id > 9999999)) return null;
  // Build an explicit allowlist so additional UI fields cannot reach PostgREST.
  const safe: TechnicianDraftFields = {
    display_name: form.display_name, state_uf: form.state_uf, city: form.city,
    neighborhood: form.neighborhood, region: form.region, bio: form.bio,
    specialties: [...form.specialties], service_slugs: [...form.service_slugs],
    base_city_ibge_id: form.base_city_ibge_id,
  };
  if (new TextEncoder().encode(JSON.stringify(safe)).length > 7500) return null;
  return safe;
}

function validOwner(ownerId: string): boolean {
  return typeof ownerId === "string" && UUID.test(ownerId);
}
function validRow(row: unknown, ownerId: string): row is {
  owner_id: string; draft: TechnicianDraftFields; step: 1 | 2 | 3; revision: number; expires_at: string;
} {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return r.owner_id === ownerId &&
    (r.step === 1 || r.step === 2 || r.step === 3) &&
    typeof r.revision === "number" && Number.isSafeInteger(r.revision) && r.revision > 0 &&
    typeof r.expires_at === "string" && Number.isFinite(Date.parse(r.expires_at)) &&
    Date.parse(r.expires_at) > Date.now() &&
    validateDraftPayload(r.draft as TechnicianDraftFields) !== null;
}

/**
 * No import/call in the live wizard. Explicit backendVerified is required,
 * never derive it from a client-side variable or a missing-table error.
 * Authentication and ownership are rechecked independently by server RLS.
 */
export function createStagedTechnicianDraftAdapter(
  client: SupabaseClient,
  backendVerified = false,
) {
  const table = () => client.from("eut_technician_drafts");
  return {
    async load(ownerId: string): Promise<DraftOperation<DurableDraftRecord>> {
      if (!backendVerified) return { status: "unavailable" };
      if (!validOwner(ownerId)) return { status: "invalid" };
      try {
        const { data, error } = await table()
          .select("owner_id,draft,step,revision,expires_at")
          .eq("owner_id", ownerId)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (error) return { status: "failed" };
        if (!data) return { status: "missing" };
        if (!validRow(data, ownerId)) return { status: "invalid" };
        return { status: "ok", value: {
          form: validateDraftPayload(data.draft)!,
          step: data.step, revision: data.revision, expiresAt: data.expires_at,
        } };
      } catch { return { status: "failed" }; }
    },
    async save(ownerId: string, form: TechnicianDraftFields, step: 1 | 2 | 3,
      expectedRevision: number | null): Promise<DraftOperation<DurableDraftRecord>> {
      if (!backendVerified) return { status: "unavailable" };
      const safe = validateDraftPayload(form);
      if (!validOwner(ownerId) || !safe || ![1, 2, 3].includes(step) ||
          (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)))
        return { status: "invalid" };
      try {
        const dataQuery = expectedRevision === null
          ? table().insert({ owner_id: ownerId, draft: safe, step })
          : table().update({ draft: safe, step, revision: expectedRevision })
            .eq("owner_id", ownerId).eq("revision", expectedRevision);
        const { data, error } = await dataQuery
          .select("owner_id,draft,step,revision,expires_at").maybeSingle();
        if (error?.code === "23505" || error?.code === "40001") return { status: "conflict" };
        if (error) return { status: "failed" };
        if (!data) return { status: "conflict" }; // stale revision or lost permission: fail closed
        if (!validRow(data, ownerId)) return { status: "invalid" };
        return { status: "ok", value: {
          form: validateDraftPayload(data.draft)!,
          step: data.step, revision: data.revision, expiresAt: data.expires_at,
        } };
      } catch { return { status: "failed" }; }
    },
    /** Call only after the backend confirms successful publication for this owner. */
    async clearAfterConfirmedPublication(ownerId: string, publishedForOwner: boolean): Promise<boolean> {
      if (!backendVerified || !publishedForOwner || !validOwner(ownerId)) return false;
      try {
        const { data, error } = await table()
          .delete().eq("owner_id", ownerId).select("owner_id").maybeSingle();
        return !error && data?.owner_id === ownerId;
      } catch { return false; }
    },
  };
}
