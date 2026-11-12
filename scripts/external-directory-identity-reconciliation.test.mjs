import { test } from "node:test";
import assert from "node:assert/strict";
import { previewIdentityReconciliation } from "./external-directory-identity-reconciliation.mjs";
import { previewQuarantinedSourceAliases } from "./external-directory-identity-preview.mjs";

const T1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const R1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const R2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const R3 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const sample = {
  organic: [
    { id: T1, public_slug: "tecnico-legado", status: "aprovado" },
    { id: T2, public_slug: "tecnico-atual", status: "suspenso" },
  ],
  wordpress: [
    { source_key: "wordpress_20261108", kind: "candidate", wp_post_id: 123,
      slug: "perfil-legado", status: "em_validacao", claim_status: "vinculado" },
    { source_key: "wordpress_20261108", kind: "employer", wp_post_id: 123,
      slug: "cliente-legado", status: "em_validacao" },
    { source_key: "wordpress_20261108", kind: "candidate", wp_post_id: 124,
      slug: "outro-tecnico", status: "em_validacao", claim_status: "pendente" },
  ],
  serviceRequestLinks: [
    { id: R1, technician_id: T1 },
    { id: R2, technician_id: null },
    { id: R3, technician_id: "ffffffff-ffff-4fff-8fff-ffffffffffff" },
  ],
};
const alias123 = "wordpress:wordpress_20261108:candidate:123";

test("preserves published ID/slug/301 and legacy FK without allocating registry ID", () => {
  const snapshot = structuredClone(sample);
  const r = previewIdentityReconciliation(sample);
  assert.deepEqual(sample, snapshot);
  assert.equal(r.created_registry_ids, 0);
  assert.equal(r.created_auth_accounts, 0);
  assert.equal(r.organic_aliases[0].source_record_key, `organic:technicians:${T1}`);
  assert.equal(r.organic_aliases[0].canonical_path, "/tecnicos/tecnico-legado");
  assert.equal(r.organic_aliases[0].existing_uuid_path, `/tecnicos/${T1}`);
  assert.equal(r.organic_aliases[0].existing_uuid_redirect, 301);
  assert.equal(r.organic_aliases[1].existing_uuid_redirect, null);
  assert.deepEqual(r.historical_request_links.map(x => x.link_status), [
    "existing_fk_preserved", "unassigned", "unresolved_fk_review",
  ]);
  assert.equal(r.historical_request_links[0].original_technician_id, T1);
  assert.equal(r.historical_request_links[0].resolved_source_record_key,
    `organic:technicians:${T1}`);
  assert.equal(r.historical_request_links[2].original_technician_id,
    "ffffffff-ffff-4fff-8fff-ffffffffffff");
  assert.equal(r.historical_request_links.every(x => x.registry_id === null), true);
});

test("WP candidate and employer namespaces stay separate, noindex and unpublished", () => {
  const r = previewIdentityReconciliation(sample);
  assert.equal(r.wordpress_aliases.length, 3);
  assert.equal(new Set(r.wordpress_aliases.map(x=>x.source_record_key)).size, 3);
  assert.deepEqual(r.wordpress_aliases.map(x=>x.historical_path), [
    "/tecnico/perfil-legado", "/cliente/cliente-legado", "/tecnico/outro-tecnico",
  ]);
  assert.equal(r.wordpress_aliases[0].claim_status, "vinculado");
  assert.equal(r.wordpress_aliases[0].identity_match_status, "not_verified");
  assert.equal(r.wordpress_aliases[0].existing_technician_id, null);
  assert(r.wordpress_aliases.every(x => x.noindex && !x.published && x.registry_id === null));
});

test("binding must be explicitly reviewed, target an existing technician and never publish WP", () => {
  const approved = [{
    wp_alias_key: alias123,
    existing_technician_id: T1,
    approved: true,
    evidence_ref: "qa:synthetic:proof-1",
  }];
  const r = previewIdentityReconciliation({...sample, reviewedBindings: approved});
  assert.equal(r.wordpress_aliases[0].existing_technician_id, T1);
  assert.equal(r.wordpress_aliases[0].identity_match_status, "reviewed_binding_preview");
  assert.equal(r.wordpress_aliases[0].published, false);
  assert.equal(r.wordpress_aliases[2].existing_technician_id, null);
  assert.throws(() => previewIdentityReconciliation({
    ...sample, reviewedBindings: [{...approved[0], approved: false}],
  }));
  assert.throws(() => previewIdentityReconciliation({
    ...sample, reviewedBindings: [{...approved[0], existing_technician_id: R3}],
  }));
  assert.throws(() => previewIdentityReconciliation({
    ...sample, reviewedBindings: [{...approved[0], evidence_ref: ""}],
  }));
  assert.throws(() => previewIdentityReconciliation({
    ...sample, reviewedBindings: [{...approved[0], wp_alias_key:
      "wordpress:wordpress_20261108:employer:123"}],
  }));
});

test("external capture remains quarantined, not merged to same-name WP or organic", () => {
  const capture = {
    source_page: "https://guiafix.com.br/almirante-tamandare-pr/tecnico-de-informatica",
    city: "Almirante Tamandaré", uf: "PR", city_ibge: 4100400,
    category: "tecnico-de-informatica", single_capture_confirmed: true,
    listings: [{public_name:"Técnico Legado"}, {public_name:"técnico legado"}],
  };
  const external = previewQuarantinedSourceAliases(capture);
  const r = previewIdentityReconciliation({...sample, externalPreviews:[external]});
  assert.equal(r.external_aliases.length, 2);
  assert.equal(new Set(r.external_aliases.map(x=>x.source_record_key)).size, 2);
  assert(r.external_aliases.every(x => x.quarantine === true &&
    x.registry_id === null && x.existing_technician_id === null && !x.published));
  assert.equal(r.published_external_records, 0);
  assert.equal(r.organic_aliases.length, 2);
  assert.equal(r.wordpress_aliases.length, 3);
  assert.equal(JSON.stringify(r).includes("phone"), false);
});

test("duplicate aliases, invalid UUID and active external records fail closed", () => {
  assert.throws(() => previewIdentityReconciliation({
    ...sample, organic:[sample.organic[0], sample.organic[0]],
  }));
  assert.throws(() => previewIdentityReconciliation({
    ...sample, wordpress:[sample.wordpress[0],sample.wordpress[0]],
  }));
  assert.throws(() => previewIdentityReconciliation({
    ...sample, serviceRequestLinks:[{id:R1,technician_id:T1},{id:R1,technician_id:T2}],
  }));
  assert.throws(() => previewIdentityReconciliation({
    ...sample, organic:[{id:"123",public_slug:"a-b",status:"aprovado"}],
  }));
  const external = previewQuarantinedSourceAliases({
    source_page:"https://guiafix.com.br/almirante-tamandare-pr/tecnico-de-informatica",
    city:"Almirante Tamandaré",uf:"PR",city_ibge:4100400,
    category:"tecnico-de-informatica",
    listings:[{public_name:"Fictício Técnico"}],
  });
  assert.throws(() => previewIdentityReconciliation({
    ...sample, externalPreviews:[{...external,records:[{
      ...external.records[0],enabled:true,
    }]}],
  }));
  assert.throws(() => previewIdentityReconciliation({
    ...sample, externalPreviews:[external,external],
  }));
});
