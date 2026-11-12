import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { previewQuarantinedSourceAliases } from "./external-directory-identity-preview.mjs";
import { stagePublicDirectoryBatch } from "./external-directory-batch.mjs";

const capture = JSON.parse(readFileSync(
  new URL("../data/external-staging/guiafix-almirante-tamandare-pr-tecnico-informatica.capture.json", import.meta.url),
  "utf8",
));

test("keeps 33 quarantined source rows without Auth, publication or invented coverage", () => {
  const preview = previewQuarantinedSourceAliases(capture);
  assert.equal(preview.quarantined_count, 33);
  assert.equal(preview.records.length, 33);
  assert.equal(preview.enabled_count, 0);
  assert.equal(preview.published_count, 0);
  assert.equal(preview.source_page_city_ibge, 4100400);
  assert.equal(new Set(preview.records.map(x => x.source_record_key)).size, 33);
  for (const row of preview.records) {
    assert.equal(row.registry_id, null);
    assert.equal(row.auth_user_id, null);
    assert.equal(row.enabled, false);
    assert.equal(row.published, false);
    assert.equal(row.claimed, false);
    assert.equal(row.has_contact, false);
    assert.equal(row.status, "quarentena_nao_reivindicado");
    assert(!Object.hasOwn(row, "coverage_city_ids"));
    assert(!Object.hasOwn(row, "phone"));
    assert(!Object.hasOwn(row, "email"));
    assert(!Object.hasOwn(row, "ddd"));
  }
  assert.deepEqual(preview, previewQuarantinedSourceAliases(capture));
  assert.deepEqual(preview.records.map(x => x.source_row), Array.from({length:33},(_,i)=>i+1));
});

test("two equal names are kept as two candidate source rows, never auto-merged", () => {
  const sample = {
    ...capture,
    listings: [
      { public_name:"Loja de Reparos" },
      { public_name:"loja   de reparos" },
      { public_name:"Assistência Eletrônica" },
      { public_name:"Contato 41999998888" },
      { public_name:"Nome incompleto…" },
    ],
  };
  assert.equal(stagePublicDirectoryBatch(sample).listings.length, 2); // legacy sanitization
  const result = previewQuarantinedSourceAliases(sample);
  assert.equal(result.records.length, 3);
  assert.equal(new Set(result.records.map(x => x.source_record_key)).size, 3);
  assert.deepEqual(result.records[0].possible_same_name_rows, [2]);
  assert.deepEqual(result.records[1].possible_same_name_rows, [1]);
  assert.deepEqual(result.records[2].possible_same_name_rows, []);
  assert.equal(result.records[2].source_row, 3);
  assert.equal(JSON.stringify(result).includes("41999998888"), false);
  assert.equal(result.records.every(row => row.registry_id === null), true);
});

test("source row key is stable within immutable capture but not an identity across captures", () => {
  const a = previewQuarantinedSourceAliases(capture);
  const b = previewQuarantinedSourceAliases({
    ...capture,
    listings: [capture.listings[1], capture.listings[0], ...capture.listings.slice(2)],
  });
  assert.notEqual(a.records[0].source_record_key, b.records[1].source_record_key);
  assert.equal(a.records[0].public_name, b.records[1].public_name);
  assert.equal(a.records[0].registry_id, null);
  assert.equal(b.records[1].registry_id, null);
});

test("invalid origin and unsafe source are rejected via existing quarantine contract", () => {
  assert.throws(() => previewQuarantinedSourceAliases({...capture,source_page:"https://evil.example/x"}));
  assert.throws(() => previewQuarantinedSourceAliases({...capture,category:"other"}));
  assert.throws(() => previewQuarantinedSourceAliases({...capture,city:"Curitiba"}));
});
