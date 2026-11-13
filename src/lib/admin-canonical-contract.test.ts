import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { confirmCatalogEditReadback, confirmCatalogReadback, isCatalogSnapshot, parseCatalogBatch } from "./admin-canonical-contract";

const uuid = "10000000-0000-4000-8000-000000000001";
const goodRow = {
  id: uuid, display_name: null, city: null, state_uf: null, specialties: [], catalog_origin: "admin_manual",
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
  it("confirma edição versionada por releitura, sem revelar telefone", () => {
    const latest = {...goodRow,last_audit_id: 45,display_name:"Oficina Atualizada",
      city:"São José dos Pinhais",state_uf:"PR",specialties:["redes"]};
    const snapshot = {ok:true,page:0,limit:1,total:1,rows:[latest]};
    const expected = {display_name:"Oficina Atualizada",city:"São José dos Pinhais",
      state_uf:"PR",category_slug:"redes",has_private_contact:true,catalog_enabled:true};
    expect(confirmCatalogEditReadback(snapshot,uuid,45,expected)).toBe(true);
    expect(confirmCatalogEditReadback(snapshot,uuid,42,expected)).toBe(false);
    expect(confirmCatalogEditReadback({...snapshot,rows:[{...latest,specialties:[]}]},uuid,45,expected)).toBe(false);
    expect(confirmCatalogEditReadback({...snapshot,rows:[{...latest,has_private_contact:false}]},uuid,45,expected)).toBe(false);
    expect(confirmCatalogEditReadback({...snapshot,rows:[{...latest,phone_e164:"+5541999994040"}]},uuid,45,expected)).toBe(false);
    expect(isCatalogSnapshot({...snapshot,rows:[{...latest,specialties:null}]})).toBe(false);
    expect(confirmCatalogEditReadback({...snapshot,rows:[{...latest,city:null}]},uuid,45,expected)).toBe(false);
  });
  it("usa RPC de edição auditada sem carregar telefone existente no navegador", () => {
    const ui=readFileSync("src/components/admin-canonical-catalog.tsx","utf8");
    const sql=readFileSync("docs/sql/eut-canonical-catalog-r1-proposal-20261112.sql","utf8");
    expect(ui).toContain('db.rpc("eut_admin_catalog_update"');
    expect(ui).toContain("_expected_updated_at:editTarget.updated_at");
    expect(ui).toContain("_expected_audit_id:editTarget.last_audit_id");
    expect(ui).toContain("confirmCatalogEditReadback(read");
    expect(ui).toContain("O número existente nunca é exibido");
    expect(ui).not.toContain(".from(\"eut_moderation.catalog_private_contacts\")");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.eut_admin_catalog_update(");
    expect(sql).toContain("'catalog_edited'");
    expect(sql).toContain("FOR UPDATE;");
    expect(sql).not.toContain("ADD COLUMN IF NOT EXISTS catalog_source_key");
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
  it("cadastra e importa sem exigir aprovação ou confirmação individual", () => {
    const ui = readFileSync("src/components/admin-canonical-catalog.tsx", "utf8");
    const createPart = ui.split("  async function create(e: FormEvent) {")[1]?.split("  async function importBatch(e: FormEvent) {")[0] ?? "";
    const importPart = ui.split("  async function importBatch(e: FormEvent) {")[1]?.split("  async function setEnabled(e: FormEvent) {")[0] ?? "";
    expect(createPart).not.toContain("window.confirm(");
    expect(importPart).not.toContain("window.confirm(");
    expect(createPart).toContain("await readback([data.technician_id]");
    expect(importPart).toContain("await readback(ids)");
    expect(ui).toContain("Cadastrar técnico habilitado");
    expect(ui).toContain("Importar técnicos habilitados");
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
