import { test } from "node:test";
import assert from "node:assert/strict";
import { stagePublicDirectoryBatch } from "./external-directory-batch.mjs";

const input = {
  source_page: "https://guiafix.com.br/cruzeiro-do-sul-ac/tecnico-de-informatica",
  city: "Cruzeiro do Sul", uf: "AC", city_ibge: 1200203,
  category: "tecnico-de-informatica", single_capture_confirmed: true,
  listings: [{ public_name: "Oficina Teste A" }, { public_name: "oficina teste a" },
    { public_name: "Assistência Teste B" }, { public_name: "Contato 68999998888" }],
};

test("isolamento: Cruzeiro do Sul/AC somente com cidade/UF/IBGE/category corretos", () => {
  const result = stagePublicDirectoryBatch(input);
  assert.equal(result.city, "Cruzeiro do Sul");
  assert.equal(result.uf, "AC");
  assert.equal(result.city_ibge, 1200203);
  assert.equal(result.listings.length, 2);
  assert.equal(result.published, 0);
  assert.equal(result.imported_accounts, 0);
  for (const row of result.listings) {
    assert.equal(row.claimed, false);
    assert.equal(row.authorized_contact, false);
    assert.equal(row.published, false);
    assert.equal(row.status, "quarentena_nao_reivindicado");
    assert(!JSON.stringify(row).includes("68999998888"));
  }
});

test("rejeita outras cidades, categoria, paginação e fontes", () => {
  for (const alteration of [
    { city: "Rio Branco" }, { uf: "PR" }, { city_ibge: 4100400 },
    { category: "refrigeracao" },
    { source_page: input.source_page + "?page=2" },
    { source_page: "https://example.com/cruzeiro-do-sul-ac/tecnico-de-informatica" },
    { source_page: "https://guiafix.com.br/paranagua-pr/tecnico-de-informatica" },
  ]) {
    assert.throws(() => stagePublicDirectoryBatch({ ...input, ...alteration }));
  }
});
