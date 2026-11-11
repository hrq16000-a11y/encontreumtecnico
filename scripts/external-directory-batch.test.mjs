import { test } from "node:test";
import assert from "node:assert/strict";
import { stagePublicDirectoryBatch } from "./external-directory-batch.mjs";
const input = {
  source_page: "https://guiafix.com.br/almirante-tamandare-pr/tecnico-de-informatica",
  city: "Almirante Tamandaré", uf: "PR", city_ibge: 4100400,
  category: "tecnico-de-informatica", single_capture_confirmed: true,
  listings: [
    {public_name:"Loja de Reparos"},
    {public_name:"loja   de reparos"},
    {public_name:"Contato 41999998888"},
    {public_name:"Nome incompleto…"},
    {public_name:"Assistência Eletrônica"},
  ],
};
test("retém somente dados públicos mínimos e não cadastra ninguém",()=>{
  const result=stagePublicDirectoryBatch(input);
  assert.equal(result.listings.length,2);
  assert.equal(result.published,0);
  assert.equal(result.imported_accounts,0);
  for (const x of result.listings) {
    assert.equal(x.authorized_contact,false);
    assert.equal(x.claimed,false);
    assert.equal(x.published,false);
    assert.equal(JSON.stringify(x).includes("41999998888"),false);
    assert.equal(Object.hasOwn(x,"phone"),false);
  }
});
test("rejeita outra cidade, categoria, origem ou URL com parâmetros",()=>{
  for(const change of [
    {city:"Curitiba"}, {category:"cftv"},
    {source_page:"https://example.com/almirante-tamandare-pr/tecnico-de-informatica"},
    {source_page:input.source_page+"?page=2"},
    {source_page:"http://guiafix.com.br/almirante-tamandare-pr/tecnico-de-informatica"},
  ]) assert.throws(()=>stagePublicDirectoryBatch({...input,...change}));
});
