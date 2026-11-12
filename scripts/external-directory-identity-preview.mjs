/**
 * Offline, non-mutating review of source rows. A name collision is not proof
 * of a shared person. Never allocate registry_id or Auth to quarantined rows.
 *
 * source_record_key is stable for the SAME immutable capture (source + ordered
 * raw rows). A new/reordered capture must be explicitly reconciled by a human.
 */
import { createHash } from "node:crypto";
import { stagePublicDirectoryBatch } from "./external-directory-batch.mjs";

const normalize = (value) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/\s+/g, " ").trim();

export function previewQuarantinedSourceAliases(capture) {
  // Reuse existing origin, URL, city, category, maximum-size and public-name
  // validation. Do NOT call database, external URLs or any authentication API.
  const vetted = stagePublicDirectoryBatch(capture);
  const validNames = new Set(vetted.listings.map(row => normalize(row.public_name)));
  const originals = capture.listings.map((raw, index) => {
    if (!raw || typeof raw.public_name !== "string") return null;
    const publicName = raw.public_name.trim().replace(/\s+/g, " ");
    const nameKey = normalize(publicName);
    return validNames.has(nameKey) ? { rowNumber: index + 1, publicName, nameKey } : null;
  }).filter(Boolean);

  // A digest identifies the capture, not a person. Keep all original row
  // ordinals so equal names do not cause accidental loss or identity fusion.
  const digest = createHash("sha256").update(JSON.stringify({
    source: vetted.source,
    source_page: vetted.source_page,
    category: vetted.category,
    city_ibge: vetted.city_ibge,
    orderedRows: capture.listings.map((raw) =>
      raw && typeof raw.public_name === "string"
        ? normalize(raw.public_name) : null),
  })).digest("hex").slice(0, 24);

  const grouped = new Map();
  for (const row of originals) {
    const group = grouped.get(row.nameKey) ?? [];
    group.push(row.rowNumber);
    grouped.set(row.nameKey, group);
  }
  return Object.freeze({
    source: vetted.source,
    source_page: vetted.source_page,
    source_page_city_ibge: vetted.city_ibge,
    quarantined_count: originals.length,
    enabled_count: 0,
    published_count: 0,
    records: originals.map(row => ({
      source_record_key: `external:${vetted.source}:${digest}:${row.rowNumber}`,
      source_row: row.rowNumber,
      public_name: row.publicName,
      source_kind: "external",
      source_page_city_ibge: vetted.city_ibge, // NOT proven coverage
      registry_id: null,
      auth_user_id: null,
      enabled: false,
      published: false,
      claimed: false,
      has_contact: false,
      status: "quarentena_nao_reivindicado",
      possible_same_name_rows: grouped.get(row.nameKey).filter(n => n !== row.rowNumber),
    })),
  });
}
