/** Admin-only catalog presentation contract. Server RPCs remain authoritative. */
export type CatalogRow = {
  id: string;
  display_name: string | null;
  city: string | null;
  state_uf: string | null;
  catalog_origin: "admin_manual" | "external_import" | "wordpress";
  catalog_enabled: boolean;
  legacy_status: string;
  created_at: string;
  updated_at: string;
  has_private_contact: boolean;
  last_audit_id: number | null;
};
export type CatalogSnapshot = {
  ok: true; page: number; limit: number; total: number; rows: CatalogRow[];
};
export type CatalogImportRow = {
  origin: "admin_manual" | "external_import" | "wordpress";
  source_key: string;
  label: string | null;
  phone: string | null;
  city_ibge: number | null;
  category_slug: string | null;
};
export type CatalogWriteResult = {
  ok: boolean;
  created?: boolean;
  technician_id?: string;
  catalog_enabled?: boolean;
  conflict?: boolean;
};
export type CatalogBatchResult = {
  ok: boolean; processed?: number; results?: CatalogWriteResult[];
};

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const SOURCE = /^[A-Za-z0-9][A-Za-z0-9_:/.-]{2,119}$/;
const ORIGINS = new Set(["admin_manual", "external_import", "wordpress"]);

export function isCatalogSnapshot(data: unknown): data is CatalogSnapshot {
  if (!data || typeof data !== "object") return false;
  const v = data as Record<string, unknown>;
  return v.ok === true && Number.isInteger(v.page) && Number.isInteger(v.limit) &&
    Number.isInteger(v.total) && Array.isArray(v.rows) &&
    v.rows.every((x: unknown) => {
      if (!x || typeof x !== "object") return false;
      const r = x as Record<string, unknown>;
      return typeof r.id === "string" && UUID.test(r.id) &&
        (typeof r.display_name === "string" || r.display_name === null) &&
        typeof r.catalog_enabled === "boolean" &&
        typeof r.updated_at === "string" && typeof r.created_at === "string" &&
        typeof r.has_private_contact === "boolean" &&
        (r.last_audit_id === null || (typeof r.last_audit_id === "number" && r.last_audit_id > 0)) &&
        ORIGINS.has(String(r.catalog_origin)) &&
        !("phone_e164" in r) && !("source_key" in r) && !("catalog_source_key" in r);
    });
}

/** Import is an explicit, small, atomic batch. Never log or persist phones locally. */
export function parseCatalogBatch(raw: string):
  { ok: true; rows: CatalogImportRow[] } | { ok: false; issue: string } {
  let values: unknown;
  if (raw.length > 30000) return { ok: false, issue: "Lote acima de 30 KB." };
  try { values = JSON.parse(raw); } catch { return { ok: false, issue: "JSON inválido." }; }
  if (!Array.isArray(values) || values.length < 1 || values.length > 50)
    return { ok: false, issue: "Informe de 1 a 50 objetos por lote." };
  const seen = new Set<string>();
  const result: CatalogImportRow[] = [];
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return { ok: false, issue: "Lote contém item inválido." };
    const r = value as Record<string, unknown>;
    const origin = r.origin;
    const sourceKey = r.source_key;
    if (typeof origin !== "string" || !ORIGINS.has(origin) ||
      typeof sourceKey !== "string" || !SOURCE.test(sourceKey) ||
      /^\d{10,13}$/.test(sourceKey))
      return { ok: false, issue: "Origem ou chave de importação inválida." };
    const dedupeKey = origin + "\n" + sourceKey;
    if (seen.has(dedupeKey)) return { ok: false, issue: "Chave repetida dentro do lote." };
    seen.add(dedupeKey);
    const label = r.label === null || r.label === undefined || r.label === ""
      ? null : r.label;
    const phone = r.phone === null || r.phone === undefined || r.phone === ""
      ? null : r.phone;
    if ((label !== null && (typeof label !== "string" || label.trim().length > 100)) ||
      (phone !== null && (typeof phone !== "string" || phone.length > 40)) ||
      (!label && !phone)) return { ok: false, issue: "Nome/telefone inválido." };
    const city = r.city_ibge ?? null;
    if (city !== null && (!Number.isInteger(city) || Number(city) < 1000000 || Number(city) > 9999999))
      return { ok: false, issue: "Código municipal IBGE inválido." };
    const category = r.category_slug ?? null;
    if (category !== null && (typeof category !== "string" || !/^[a-z0-9-]{2,80}$/.test(category)))
      return { ok: false, issue: "Categoria inválida." };
    result.push({
      origin: origin as CatalogImportRow["origin"], source_key: sourceKey,
      label: label === null ? null : String(label),
      phone: phone === null ? null : String(phone),
      city_ibge: city === null ? null : Number(city),
      category_slug: category === null ? null : String(category),
    });
  }
  return { ok: true, rows: result };
}

export function confirmCatalogReadback(snapshot: unknown, ids: string[], expected?: boolean): boolean {
  if (!isCatalogSnapshot(snapshot) || ids.length === 0 || snapshot.total !== ids.length ||
    snapshot.rows.length !== ids.length) return false;
  const byId = new Map(snapshot.rows.map(r => [r.id, r]));
  return ids.every(id => {
    const row = byId.get(id);
    return !!row && (expected === undefined || row.catalog_enabled === expected) &&
      typeof row.last_audit_id === "number" && row.last_audit_id > 0;
  });
}
