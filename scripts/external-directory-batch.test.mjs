import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("os três snapshots originais continuam com 33+13+53 nomes, zero publicação e contato", () => {
  const fixtures = [
    ["guiafix-almirante-tamandare-pr-tecnico-informatica.capture.json",33,"Almirante Tamandaré","PR",4100400],
    ["guiafix-paranagua-pr-tecnico-informatica.capture.json",13,"Paranaguá","PR",4118204],
    ["guiafix-cruzeiro-do-sul-ac-tecnico-informatica.capture.json",53,"Cruzeiro do Sul","AC",1200203],
  ];
  let total = 0;
  for (const [filename,count,city,uf,ibge] of fixtures) {
    const source=JSON.parse(readFileSync(new URL("../data/external-staging/"+filename,import.meta.url),"utf8"));
    assert.equal(source.listings.length,count);
    assert(source.listings.every(x=>Object.keys(x).length===1 && typeof x.public_name==="string"));
    const staged=stagePublicDirectoryBatch(source);
    assert.equal(staged.listings.length,count);
    assert.equal(staged.city,city);
    assert.equal(staged.uf,uf);
    assert.equal(staged.city_ibge,ibge);
    assert.equal(staged.imported_accounts,0);
    assert.equal(staged.published,0);
    for (const candidate of staged.listings) {
      assert.equal(candidate.status,"quarentena_nao_reivindicado");
      assert.equal(candidate.claimed,false);
      assert.equal(candidate.authorized_contact,false);
      assert.equal(candidate.published,false);
      for (const field of ["phone","email","whatsapp","technician_id","user_id"]) assert.equal(Object.hasOwn(candidate,field),false);
    }
    total+=staged.listings.length;
  }
  assert.equal(total,99);
});

test("três municípios têm allowlist estrita; Encontrey só conserva o recorte original", () => {
  const allowed=[
    ["https://guiafix.com.br/almirante-tamandare-pr/tecnico-de-informatica","Almirante Tamandaré","PR",4100400],
    ["https://guiafix.com.br/paranagua-pr/tecnico-de-informatica","Paranaguá","PR",4118204],
    ["https://guiafix.com.br/cruzeiro-do-sul-ac/tecnico-de-informatica","Cruzeiro do Sul","AC",1200203]
  ];
  for(let i=0;i<allowed.length;i++){
    const [source_page,city,uf,city_ibge]=allowed[i];
    const fixture={source_page,city,uf,city_ibge,category:"tecnico-de-informatica",listings:[{public_name:"Laboratório Sintético"}]};
    assert.equal(stagePublicDirectoryBatch(fixture).listings.length,1);
    for(let j=0;j<allowed.length;j++){
      if(j===i)continue;
      const [,otherCity,otherUf,otherIbge]=allowed[j];
      assert.throws(()=>stagePublicDirectoryBatch({...fixture,city:otherCity,uf:otherUf,city_ibge:otherIbge}));
    }
    assert.throws(()=>stagePublicDirectoryBatch({...fixture,source_page:source_page+"?page=2"}));
    const enontrey={...fixture,source_page:"https://encontrey.com.br/"};
    if(i===0) assert.equal(stagePublicDirectoryBatch(enontrey).listings.length,1);
    else assert.throws(()=>stagePublicDirectoryBatch(enontrey));
  }
});
