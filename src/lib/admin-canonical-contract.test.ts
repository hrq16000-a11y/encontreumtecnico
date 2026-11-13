import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { confirmCatalogReadback, isCatalogSnapshot, parseCatalogBatch } from "./admin-canonical-contract";

const uuid = "10000000-0000-4000-8000-000000000001";
const goodRow = {
  id: uuid, display_name: null, city: null, state_uf: null, catalog_origin: "admin_manual",
  catalog_enabled: true, legacy_status: "pendente",
  created_at: "2026-11-12T12:00:00Z", updated_at: "2026-11-12T12:00:00Z",
  has_private_contact: true, last_audit_id: 42,
};
describe("Admin catalog: only real persistence + private read RPC", () => {
  it("validates a server response without private keys/phone", () => {
    const snapshot = {ok: true, page: 0, limit: 20, total: 1, rows: [goodRow]};
    expect(isCatalogSnapshot(snapshot)).toBe(true);
    expect(confirmCatalogReadback(snapshot, [uuid], true)).toBe(true);
    expect(confirmCatalogReadback(snapshot, [uuid], false)).toBe(false);
    expect(confirmCatalogReadback({...snapshot, rows: [{...goodRow,last_audit_id: null}]}, [uuid])).toBe(false);
    expect(isCatalogSnapshot({...snapshot,rows: [{...goodRow,phone_e164: "+5541999998888"}]})).toBe(false);
    expect(isCatalogSnapshot({...snapshot,rows: [{...goodRow,source_key: "import:secret"}]})).toBe(false);
  });
  it("rejects invalid/imported duplicate keys and keeps limit 50", () => {
    const valid = JSON.stringify([{origin: "wordpress",source_key: "wp:42",label: "Nome",phone: null,city_ibge: null,category_slug: null}]);
    expect(parseCatalogBatch(valid)).toMatchObject({ok: true});
    expect(parseCatalogBatch("not json").ok).toBe(false);
    expect(parseCatalogBatch(JSON.stringify([])).ok).toBe(false);
    expect(parseCatalogBatch(JSON.stringify(Array.from({length:51},()=>JSON.parse(valid)[0]))).ok).toBe(false);
    expect(parseCatalogBatch(JSON.stringify([JSON.parse(valid)[0],JSON.parse(valid)[0]])).ok).toBe(false);
    expect(parseCatalogBatch(JSON.stringify([{origin:"external_import",source_key:"22222222222",phone:"11999999999"}])).ok).toBe(false);
  });
  it("binds an actual list/write/readback and never uses client-side table insert", () => {
    const ui = readFileSync("src/components/admin-canonical-catalog.tsx","utf8");
    const admin = readFileSync("src/routes/admin.tsx","utf8");
    const sql = readFileSync("docs/sql/eut-canonical-catalog-r1-proposal-20261112.sql","utf8");
    expect(admin).toContain("<AdminCanonicalCatalog />");
    for(const rpc of ["eut_admin_catalog_list","eut_admin_catalog_upsert","eut_admin_catalog_import_batch","eut_admin_catalog_set_enabled"])
      expect(ui).toContain(rpc);
    expect(ui).not.toContain(".from(\"technicians\").insert(");
    expect(ui).not.toContain("service_role");
    expect(ui).not.toContain("preview_only");
    expect(ui).toContain("confirmCatalogReadback");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.eut_admin_catalog_list(");
    expect(sql).toContain("eut_moderation.catalog_provenance");
    expect(sql).not.toContain("ADD COLUMN IF NOT EXISTS catalog_source_key");
  });
});
