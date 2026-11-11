import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stagePublicDirectoryBatch } from "./external-directory-batch.mjs";

const capture = JSON.parse(readFileSync(new URL(
  "../data/external-staging/guiafix-cruzeiro-do-sul-ac-tecnico-informatica.capture.json",
  import.meta.url), "utf8"));

test("Cruzeiro do Sul: somente os 53 nomes da única captura ficam em quarentena", () => {
  const result = stagePublicDirectoryBatch(capture);
  assert.equal(capture.source_explicit_list_count, 53);
  assert.equal(result.scraped_once, true);
  assert.equal(result.listings.length, 53);
  assert.equal(result.city, "Cruzeiro do Sul");
  assert.equal(result.uf, "AC");
  assert.equal(result.city_ibge, 1200203);
  assert.equal(result.category, "tecnico-de-informatica");
  assert.equal(result.imported_accounts, 0);
  assert.equal(result.published, 0);
  const names = new Set();
  for (const candidate of result.listings) {
    assert.equal(candidate.status, "quarentena_nao_reivindicado");
    assert.equal(candidate.claimed, false);
    assert.equal(candidate.published, false);
    assert.equal(candidate.authorized_contact, false);
    for (const forbidden of [
      "phone", "whatsapp", "email", "user_id", "technician_id",
      "verified", "rating", "review_count", "available_now"
    ]) assert.equal(Object.hasOwn(candidate, forbidden), false);
    const normalized = candidate.public_name.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    assert(!names.has(normalized));
    names.add(normalized);
  }
  assert.equal(names.size, 53);
});

test("não transformar contador 950 ou localização não verificada em perfis ativos", () => {
  assert.match(capture.source_counter, /^950 /);
  assert.equal(capture.listings.length, 53);
  assert.equal(capture.city, "Cruzeiro do Sul");
  assert.equal(capture.listings.some(item => Object.hasOwn(item, "phone")), false);
  assert.equal(capture.listings.some(item => Object.hasOwn(item, "active")), false);
});
