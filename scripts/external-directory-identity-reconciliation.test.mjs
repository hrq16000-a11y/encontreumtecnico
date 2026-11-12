import { test } from "node:test";
import assert from "node:assert/strict";
import { previewIdentityReconciliation, previewRegistryReconciliation } from "./external-directory-identity-reconciliation.mjs";
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


const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const sourceCapture = names => ({
  source_page: "https://guiafix.com.br/almirante-tamandare-pr/tecnico-de-informatica",
  category: "tecnico-de-informatica", uf: "PR", city: "Almirante Tamandaré",
  city_ibge: 4100400, single_capture_confirmed: true,
  listings: names.map(public_name => ({ public_name })),
});

test("registry preview: existing alias is stable, new row remains a proposal", () => {
  const data = sourceCapture(["Atendimento Alpha", "Atendimento Beta"]);
  const prior = previewQuarantinedSourceAliases(data);
  const knownTechnicians = [{technician_registry_id: ID_A, display_name: "Atendimento Alpha"}];
  const knownAliases = [{source_record_key: prior.records[0].source_record_key, technician_registry_id: ID_A}];
  const a = previewRegistryReconciliation(data, {knownTechnicians, knownAliases});
  const b = previewRegistryReconciliation(data, {knownTechnicians, knownAliases});
  assert.deepEqual(a, b);
  assert.equal(a.records[0].decision, "alias_conhecido");
  assert.equal(a.records[0].technician_registry_id, ID_A);
  assert.equal(a.records[1].decision, "nova_ficha_proposta");
  assert.equal(a.records[1].technician_registry_id, null);
  assert.deepEqual(a.counts, {alias_conhecido:1, nova_ficha_proposta:1, conflito_revisao:0});
  assert.equal(a.enabled_count, 0);
  assert.equal(a.published_count, 0);
  assert(!JSON.stringify(a).includes('"auth_user_id"'));
  assert(!JSON.stringify(a).includes('"phone"'));
});

test("registry preview: same names are not linked automatically", () => {
  const a = previewRegistryReconciliation(sourceCapture([
    "Assistência Igual", "assistência  igual", "Outra Loja",
  ]));
  assert.equal(a.records[0].decision, "conflito_revisao");
  assert.equal(a.records[1].decision, "conflito_revisao");
  assert.equal(a.records[0].review_reason, "nome_repetido_na_captura");
  assert.notEqual(a.records[0].source_record_key, a.records[1].source_record_key);
  assert.equal(a.records[0].technician_registry_id, null);
  assert.equal(a.records[1].technician_registry_id, null);
  assert.equal(a.records[2].decision, "nova_ficha_proposta");
});

test("registry preview: existing same-name technician is a conflict, never a merged identity", () => {
  const actual = previewRegistryReconciliation(sourceCapture(["Oficina Atual"]), {
    knownTechnicians: [{technician_registry_id: ID_A, display_name: "Oficina Atual"}],
  });
  assert.equal(actual.records[0].decision, "conflito_revisao");
  assert.equal(actual.records[0].review_reason, "nome_coincidente_sem_prova");
  assert.equal(actual.records[0].technician_registry_id, null);
});

test("registry preview: ambiguous aliases, missing targets and pending links fail closed", () => {
  const data = sourceCapture(["Oficina Com Alias"]);
  const key = previewQuarantinedSourceAliases(data).records[0].source_record_key;
  const knownTechnicians = [{technician_registry_id: ID_A, display_name: "Oficina Com Alias"}];
  const mixed = previewRegistryReconciliation(data, {knownTechnicians,
    knownAliases: [{source_record_key:key, technician_registry_id:ID_A},
      {source_record_key:key, technician_registry_id:ID_B}]});
  assert.equal(mixed.records[0].review_reason, "alias_com_destinos_distintos");
  assert.equal(mixed.records[0].technician_registry_id, null);
  const orphan = previewRegistryReconciliation(data, {knownTechnicians,
    knownAliases: [{source_record_key:key, technician_registry_id:ID_B}]});
  assert.equal(orphan.records[0].review_reason, "destino_nao_encontrado");
  const pending = previewRegistryReconciliation(data, {knownTechnicians,
    knownAliases: [{source_record_key:key, technician_registry_id:null}]});
  assert.equal(pending.records[0].review_reason, "alias_sem_identidade");
});

test("registry preview: reordered captures cannot inherit identity from names", () => {
  const original = sourceCapture(["Uma Loja", "Outra Loja"]);
  const reordered = sourceCapture(["Outra Loja", "Uma Loja"]);
  const oldKey = previewQuarantinedSourceAliases(original).records[0].source_record_key;
  const knownAliases = [{source_record_key:oldKey, technician_registry_id:ID_A, public_name:"Uma Loja"}];
  const knownTechnicians = [{technician_registry_id:ID_A, display_name:"Uma Loja"}];
  const changed = previewRegistryReconciliation(reordered, {knownAliases, knownTechnicians});
  assert.notEqual(changed.records[1].source_record_key, oldKey);
  assert.equal(changed.records[1].decision, "conflito_revisao");
  assert.equal(changed.records[1].review_reason, "nome_coincidente_sem_prova");
  assert.equal(changed.records[1].technician_registry_id, null);
});

test("registry preview: unresolved old snapshot name still requires review", () => {
  const original = sourceCapture(["Primeira Loja", "Segunda Loja"]);
  const reordered = sourceCapture(["Segunda Loja", "Primeira Loja"]);
  const oldKey = previewQuarantinedSourceAliases(original).records[0].source_record_key;
  const actual = previewRegistryReconciliation(reordered, {
    knownAliases: [{source_record_key:oldKey, technician_registry_id:null, public_name:"Primeira Loja"}],
  });
  assert.equal(actual.records[1].decision, "conflito_revisao");
  assert.equal(actual.records[1].review_reason, "nome_coincidente_sem_prova");
});

test("registry preview: invalid context and unsafe source are rejected", () => {
  const data = sourceCapture(["Loja Legal"]);
  const key = previewQuarantinedSourceAliases(data).records[0].source_record_key;
  assert.throws(() => previewRegistryReconciliation(data,{knownTechnicians:"not-a-list"}));
  assert.throws(() => previewRegistryReconciliation(data,{knownAliases:[
    {source_record_key:key, technician_registry_id:"wrong"}]}));
  assert.throws(() => previewRegistryReconciliation(data,{knownTechnicians:[
    {technician_registry_id:ID_A},{technician_registry_id:ID_A}]}));
  assert.throws(() => previewRegistryReconciliation({...data,source_page:"https://example.com/"}));
});

test("registry preview: 33 names stay unpublished, not 33 allocated identities", () => {
  const names = Array.from({length:33}, (_,i)=>"Profissional Exemplo " + (i+1));
  const result = previewRegistryReconciliation(sourceCapture(names));
  assert.equal(result.quarantined_count, 33);
  assert.equal(new Set(result.records.map(r=>r.source_record_key)).size, 33);
  assert.equal(result.counts.nova_ficha_proposta, 33);
  assert.equal(result.enabled_count, 0);
  assert.equal(result.published_count, 0);
  assert(result.records.every(r=>r.technician_registry_id === null));
});
