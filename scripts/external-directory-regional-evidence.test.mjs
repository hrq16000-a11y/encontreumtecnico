import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { previewDeclaredRegionalMatch } from "./external-directory-regional-evidence.mjs";
import { previewQuarantinedSourceAliases } from "./external-directory-identity-preview.mjs";

const ibgeParanagua = 4118204;
const ibgeAlmirante = 4100400;
const ibgeCruzeiroDoSul = 1200203;

test("DDD 71 matches only as approximate telephone region, never city or availability", () => {
  const record = {enabled:true, declaredDdds:["71"],declaredCoverageCityIds:[]};
  const value = previewDeclaredRegionalMatch(record,{ddd:"71"});
  assert.equal(value.ddd_match,true);
  assert.equal(value.municipality_match,false);
  assert.equal(value.possible_match_for_review,true);
  assert.equal(value.match_evidence,"telephone_region_approximate");
  assert.equal(value.geographic_claim,"Região telefônica aproximada (DDD)");
  assert.equal(value.city_inferred_from_ddd,false);
  assert.equal(value.distance_km,null);
  assert.equal(value.availability_confirmed,null);
  assert.equal(value.service_confirmed,null);
  assert.equal(value.registry_id,null);
  assert.equal(value.publication_authorized,false);
  assert(Object.isFrozen(value));
  const city = previewDeclaredRegionalMatch(record,{cityIbgeId:ibgeParanagua});
  assert.equal(city.possible_match_for_review,false);
  assert.equal(city.municipality_match,false);
  assert.equal(city.ddd_match,false);
});

test("declared city coverage is explicit and unaffected by an unrelated DDD", () => {
  const technician = {
    enabled:true,declaredDdds:["41"],
    declaredCoverageCityIds:[ibgeParanagua],
    declaredBaseCityIbgeId:ibgeAlmirante,
  };
  const original = structuredClone(technician);
  const municipal = previewDeclaredRegionalMatch(technician,{cityIbgeId:ibgeParanagua});
  assert.equal(municipal.municipality_match,true);
  assert.equal(municipal.match_evidence,"declared_municipality");
  assert.equal(municipal.geographic_claim,"Cobertura municipal declarada");
  assert.equal(municipal.possible_match_for_review,true);
  const base = previewDeclaredRegionalMatch(technician,{cityIbgeId:ibgeAlmirante});
  assert.equal(base.possible_match_for_review,true);
  const unrelated = previewDeclaredRegionalMatch(technician,{cityIbgeId:ibgeCruzeiroDoSul});
  assert.equal(unrelated.possible_match_for_review,false);
  assert.equal(unrelated.municipality_match,false);
  assert.deepEqual(technician,original);
});

test("DDD and municipality combined filters require both independent evidence sources", () => {
  const candidate = {
    enabled:true,declaredDdds:["41"],declaredCoverageCityIds:[ibgeParanagua],
  };
  const both = previewDeclaredRegionalMatch(candidate,{ddd:"41",cityIbgeId:ibgeParanagua});
  assert.equal(both.evidence_matches_filters,true);
  assert.equal(both.possible_match_for_review,true);
  assert.equal(both.match_evidence,"declared_municipality");
  const wrongDDD = previewDeclaredRegionalMatch(candidate,{ddd:"71",cityIbgeId:ibgeParanagua});
  assert.equal(wrongDDD.municipality_match,true);
  assert.equal(wrongDDD.ddd_match,false);
  assert.equal(wrongDDD.evidence_matches_filters,false);
  const wrongCity = previewDeclaredRegionalMatch(candidate,{ddd:"41",cityIbgeId:ibgeCruzeiroDoSul});
  assert.equal(wrongCity.ddd_match,true);
  assert.equal(wrongCity.municipality_match,false);
  assert.equal(wrongCity.evidence_matches_filters,false);
});

test("quarantine, block, absence of enabled and no filters never make anyone searchable", () => {
  const known = {declaredDdds:["71"],declaredCoverageCityIds:[ibgeParanagua]};
  for (const record of [
    known, {...known,enabled:false},
    {...known,enabled:true,quarantined:true},
    {...known,enabled:true,blocked:true},
  ]) {
    const result = previewDeclaredRegionalMatch(record,{ddd:"71"});
    assert.equal(result.ddd_match,true);
    assert.equal(result.possible_match_for_review,false);
    assert.equal(result.publication_authorized,false);
  }
  const empty = previewDeclaredRegionalMatch({...known,enabled:true},{});
  assert.equal(empty.evidence_matches_filters,false);
  assert.equal(empty.possible_match_for_review,false);
  assert.equal(empty.match_evidence,"none");
});

test("source-page municipality on 33-name quarantine is NOT declared coverage", () => {
  const capture = JSON.parse(readFileSync(new URL(
    "../data/external-staging/guiafix-almirante-tamandare-pr-tecnico-informatica.capture.json",
    import.meta.url,
  ),"utf8"));
  const staged = previewQuarantinedSourceAliases(capture);
  assert.equal(staged.records.length,33);
  for(const row of staged.records) {
    const value = previewDeclaredRegionalMatch(row,{cityIbgeId:ibgeAlmirante});
    assert.equal(value.municipality_match,false);
    assert.equal(value.possible_match_for_review,false);
    assert.equal(value.publication_authorized,false);
    assert.equal(value.city_inferred_from_ddd,false);
  }
  assert.equal(staged.enabled_count,0);
  assert.equal(staged.published_count,0);
});

test("malformed DDD, IBGE or list data fails closed rather than inferring a location", () => {
  const eligible = {enabled:true,declaredDdds:["71"],declaredCoverageCityIds:[ibgeParanagua]};
  for (const invalidDDD of ["071","7","abc","",71]) {
    assert.throws(() => previewDeclaredRegionalMatch(eligible,{ddd:invalidDDD}));
  }
  for (const invalidIBGE of [0,123456,12345678,"4118204",null]) {
    // Explicit null means no city filter; other malformed identifiers fail.
    if (invalidIBGE === null) continue;
    assert.throws(() => previewDeclaredRegionalMatch(eligible,{cityIbgeId:invalidIBGE}));
  }
  assert.throws(() => previewDeclaredRegionalMatch({...eligible,declaredDdds:["071"]},{ddd:"71"}));
  assert.throws(() => previewDeclaredRegionalMatch({...eligible,declaredCoverageCityIds:["4118204"]},{cityIbgeId:ibgeParanagua}));
  assert.throws(() => previewDeclaredRegionalMatch({...eligible,declaredCoverageCityIds:null,declaredDdds:"71"},{ddd:"71"}));
  assert.throws(() => previewDeclaredRegionalMatch(null,{ddd:"71"}));
  assert.throws(() => previewDeclaredRegionalMatch(eligible,null));
});

test("no inference of municipality, route or operational service from source city or DDD", () => {
  const input = {
    enabled:true,declaredDdds:["71"],
    source_page_city_ibge:ibgeParanagua,
    source_page:"https://example.invalid/",
    online_now:true, // ignored: not a trusted availability signal
  };
  const result=previewDeclaredRegionalMatch(input,{ddd:"71",cityIbgeId:ibgeParanagua});
  assert.equal(result.ddd_match,true);
  assert.equal(result.municipality_match,false);
  assert.equal(result.possible_match_for_review,false);
  assert.equal(result.distance_km,null);
  assert.equal(result.availability_confirmed,null);
  assert.equal(result.service_confirmed,null);
  assert.equal(result.city_inferred_from_ddd,false);
  assert.equal(result.publication_authorized,false);
});
