/**
 * B2 contract ONLY: a future, admin-authorized read-only aggregate response.
 * No RPC is called here and no database permissions are introduced.
 * Unknown/private fields or malformed aggregates fail closed.
 */
export const ADMIN_REFERRAL_PAGE_SIZE_MAX = 25;

export type AdminReferralPoints =
  | { status: "unavailable" }
  | {
      status: "verified";
      value: number;
      rule_version: string;
      ledger_revision: string;
      calculated_at: string;
    };

export type AdminReferralLedgerRow = {
  technician_id: string; // public technicians.id; never auth.users.id
  public_slug: string;
  display_name: string;
  city: string;
  state_uf: string;
  invited_accounts: number;
  invited_public_profiles: number;
  points: AdminReferralPoints;
};

export type AdminReferralLedgerPage = {
  version: 1;
  as_of: string;
  page: number;
  page_size: number;
  total: number;
  rows: AdminReferralLedgerRow[];
};

const PUBLIC_ROW_KEYS = [
  "technician_id", "public_slug", "display_name", "city", "state_uf",
  "invited_accounts", "invited_public_profiles", "points",
] as const;
const ENVELOPE_KEYS = ["version", "as_of", "page", "page_size", "total", "rows"] as const;
const VERIFIED_POINT_KEYS = [
  "status", "value", "rule_version", "ledger_revision", "calculated_at",
] as const;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const UF = /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const VERSION = /^[A-Za-z0-9._:-]{1,64}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,95}$/;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key)) &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max &&
    value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}

function utc(value: unknown): value is string {
  return typeof value === "string" && UTC_INSTANT.test(value) &&
    Number.isFinite(Date.parse(value));
}

function parsePoints(value: unknown): AdminReferralPoints | null {
  if (!record(value)) return null;
  if (value.status === "unavailable" && exactKeys(value, ["status"])) {
    return { status: "unavailable" };
  }
  if (value.status !== "verified" || !exactKeys(value, VERIFIED_POINT_KEYS) ||
      !count(value.value) || !text(value.rule_version, 64) ||
      !VERSION.test(value.rule_version) || !text(value.ledger_revision, 64) ||
      !VERSION.test(value.ledger_revision) || !utc(value.calculated_at)) return null;
  return {
    status: "verified", value: value.value,
    rule_version: value.rule_version, ledger_revision: value.ledger_revision,
    calculated_at: value.calculated_at,
  };
}

/**
 * Whitelist projection. This is a display guard, NOT a substitute for an
 * authenticated RPC checking admin role, RLS, provenance and ledger integrity.
 */
export function parseAdminReferralLedgerPage(input: unknown): AdminReferralLedgerPage | null {
  if (!record(input) || !exactKeys(input, ENVELOPE_KEYS) || input.version !== 1 ||
      !utc(input.as_of) || !count(input.page) || input.page > 10000 ||
      !count(input.page_size) || input.page_size < 1 ||
      input.page_size > ADMIN_REFERRAL_PAGE_SIZE_MAX || !count(input.total) ||
      !Array.isArray(input.rows) || input.rows.length > input.page_size) return null;

  const rows: AdminReferralLedgerRow[] = [];
  const seen = new Set<string>();
  for (const raw of input.rows as unknown[]) {
    if (!record(raw) || !exactKeys(raw, PUBLIC_ROW_KEYS) ||
        !text(raw.technician_id, 36) || !UUID.test(raw.technician_id) ||
        !text(raw.public_slug, 96) || !SLUG.test(raw.public_slug) ||
        !text(raw.display_name, 80) || !text(raw.city, 80) ||
        typeof raw.state_uf !== "string" || !UF.test(raw.state_uf) ||
        !count(raw.invited_accounts) || !count(raw.invited_public_profiles) ||
        raw.invited_public_profiles > raw.invited_accounts) return null;
    const id = raw.technician_id.toLowerCase();
    if (seen.has(id)) return null;
    seen.add(id);
    const points = parsePoints(raw.points);
    if (!points) return null;
    rows.push({
      technician_id: id, public_slug: raw.public_slug,
      display_name: raw.display_name, city: raw.city, state_uf: raw.state_uf,
      invited_accounts: raw.invited_accounts,
      invited_public_profiles: raw.invited_public_profiles, points,
    });
  }

  const offset = input.page * input.page_size;
  if (rows.length > 0 && offset + rows.length > input.total) return null;
  if (input.total > offset && rows.length === 0) return null;
  return {
    version: 1, as_of: input.as_of, page: input.page,
    page_size: input.page_size, total: input.total, rows,
  };
}
