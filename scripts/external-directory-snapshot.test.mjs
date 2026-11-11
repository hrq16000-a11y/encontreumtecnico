import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stagePublicDirectoryBatch } from "./external-directory-batch.mjs";

test("snapshot de consulta única: só candidatos em quarentena, sem contato e sem conta", () => {
  const captured=JSON.parse(readFileSync(
    new URL("../data/external-staging/guiafix-almirante-tamandare-pr-tecnico-informatica.capture.json",import.meta.url),"utf8"));
  const staged=stagePublicDirectoryBatch(captured);
  assert.equal(staged.listings.length,33);
  assert.equal(staged.scraped_once,true);
  assert.equal(staged.imported_accounts,0);
  assert.equal(staged.published,0);
  const names=new Set(staged.listings.map(x=>x.public_name));
  assert.equal(names.size,33);
  assert(names.has("Eletrônica Tanguá"));
  assert(names.has("Store Tech"));
  assert(names.has("Thiago Manutenção e Suporte de Computadores"));
  for (const candidate of staged.listings) {
    assert.equal(candidate.authorized_contact,false);
    assert.equal(candidate.claimed,false);
    assert.equal(candidate.published,false);
    assert.equal(candidate.status,"quarentena_nao_reivindicado");
    assert(!("phone" in candidate));
    assert(!("email" in candidate));
    assert(!("whatsapp" in candidate));
  }
});
