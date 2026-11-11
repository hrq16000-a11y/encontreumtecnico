import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stagePublicDirectoryBatch } from "./external-directory-batch.mjs";

test("Paranaguá: lote único contém 13 nomes e nenhum contato, conta ou aprovação", () => {
  const raw = JSON.parse(readFileSync(new URL(
    "../data/external-staging/guiafix-paranagua-pr-tecnico-informatica.capture.json",
    import.meta.url), "utf8"));
  const staged = stagePublicDirectoryBatch(raw);
  assert.equal(staged.scraped_once, true);
  assert.equal(staged.city, "Paranaguá");
  assert.equal(staged.uf, "PR");
  assert.equal(staged.city_ibge, 4118204);
  assert.equal(staged.category, "tecnico-de-informatica");
  assert.equal(staged.listings.length, 13);
  assert.equal(staged.imported_accounts, 0);
  assert.equal(staged.published, 0);
  const normalized = staged.listings.map(x => x.public_name.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim());
  assert.equal(new Set(normalized).size, 13);
  for (const candidate of staged.listings) {
    assert.equal(candidate.claimed, false);
    assert.equal(candidate.authorized_contact, false);
    assert.equal(candidate.published, false);
    assert.equal(candidate.status, "quarentena_nao_reivindicado");
    for (const forbidden of ["phone", "whatsapp", "email", "user_id", "technician_id", "rating", "status_publicado"]) {
      assert.equal(Object.hasOwn(candidate, forbidden), false);
    }
  }
});

test("Catálogo não mistura referências externas com profissionais aprovados", () => {
  const refs = readFileSync("src/components/paranagua-external-references.tsx", "utf8");
  const category = readFileSync("src/routes/servicos.$categoria.tsx", "utf8");
  assert.match(refs, /não cadastrado neste portal/);
  assert.match(refs, /não é enviada automaticamente/);
  assert.match(refs, /mode: "managed"/);
  assert.doesNotMatch(refs, /wa\.me|tel:|mailto:|technician_id|approved|aprovado/);
  assert.match(category, /const PUBLIC_EXTERNAL_REFERENCES_ENABLED = false/);
  assert.match(category, /PUBLIC_EXTERNAL_REFERENCES_ENABLED && category\.slug === "computadores"/);
  assert.match(category, /<ParanaguaExternalReferences/);
  assert.match(category, /listApprovedTechnicians/);
});
