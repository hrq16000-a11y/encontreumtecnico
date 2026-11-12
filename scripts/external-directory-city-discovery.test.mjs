import { test } from "node:test";
import assert from "node:assert/strict";
import { previewCityDiscovery } from "./external-directory-city-discovery.mjs";

const city = {cityIbgeId:4118204, cityLabel:"Paranaguá", regionDdds:["41"]};
const record = (n, fields={}) => ({
  stableKey:`organic:technicians:${String(n).padStart(5,"0")}`,
  enabled:true, published:true, publicEligible:true,
  displayName:`Profissional ${n}`,
  profileUpdatedAt:"2026-11-01T10:00:00Z",
  declaredCoverageCityIds:[],
  declaredDdds:[],
  ...fields,
});

test("city comes first; only declared municipality justifies 'coverage in city'", () => {
  const rows=[
    record(1,{declaredCoverageCityIds:[4118204]}),
    record(2,{declaredDdds:["41"],lastAuthenticatedAt:"2026-11-12T12:00:00Z"}),
    record(3,{declaredDdds:["71"],source_page_city_ibge:4118204}),
  ];
  const result=previewCityDiscovery({...city,records:rows});
  assert.equal(result.total,2);
  assert.equal(result.declared_count,1);
  assert.equal(result.approximate_ddd_count,1);
  assert.equal(result.records[0].match_kind,"declared_municipality");
  assert.equal(result.records[1].match_kind,"approximate_phone_region");
  assert.match(result.headings.declared,/cobertura declarada em Paranaguá/);
  assert.match(result.headings.approximate,/cobertura não confirmada/);
  assert.equal(result.records[1].last_login_at,null);
  assert.equal(result.records[1].availability_confirmed,null);
  assert.equal(result.records[1].distance_km,null);
  assert.equal(result.records[1].service_completed_confirmed,null);
  assert(!JSON.stringify(result).includes("2026-11-12T12:00:00Z"));
  assert(!JSON.stringify(result).includes("source_page_city_ibge"));
  assert.equal(result.public_integration_authorized,false);
});

test("without declared coverage, DDD cannot imply technicians in a specific city", () => {
  const dddOnly=record(5,{declaredDdds:["41"],source_page_city_ibge:4118204});
  const exact=previewCityDiscovery({...city,regionDdds:[],records:[dddOnly]});
  assert.equal(exact.total,0);
  assert.equal(exact.declared_count,0);
  const approx=previewCityDiscovery({...city,records:[dddOnly]});
  assert.equal(approx.declared_count,0);
  assert.equal(approx.approximate_ddd_count,1);
  assert.equal(approx.records[0].match_kind,"approximate_phone_region");
  assert.match(approx.records[0].match_label,/não confirmada/);
});

test("550+ records: stable filtering, full pagination, no global 200 cut", () => {
  const rows=Array.from({length: 560},(_,i)=>record(i+1,
    i%2===0 ? {declaredCoverageCityIds:[4118204]} : {declaredDdds:["41"]}));
  rows.push(record(561,{declaredDdds:["41"],quarantined:true}));
  rows.push(record(562,{declaredCoverageCityIds:[4118204],blocked:true}));
  rows.push(record(563,{declaredDdds:["41"],published:false}));
  rows.push(record(564,{declaredDdds:["41"],publicEligible:false}));
  rows.push(record(565,{declaredDdds:["41"],enabled:false}));
  const opts={...city,records:rows,pageSize:50};
  const pages=Array.from({length:12},(_,i)=>previewCityDiscovery({...opts,page:i+1}));
  assert.equal(pages[0].total,560);
  assert.equal(pages[0].declared_count,280);
  assert.equal(pages[0].approximate_ddd_count,280);
  assert.equal(pages[0].records.length,50);
  assert.equal(pages[10].records.length,50);
  assert.equal(pages[11].records.length,10);
  assert.equal(pages[10].has_next_page,true);
  assert.equal(pages[11].has_next_page,false);
  const keys=pages.flatMap(p=>p.records.map(r=>r.stable_key));
  assert.equal(keys.length,560);
  assert.equal(new Set(keys).size,560);
  assert(keys.indexOf(rows[559].stableKey)>199);
  assert.equal(keys.some(k=>k===rows[560].stableKey),false);
  const reversed=previewCityDiscovery({...opts,records:[...rows].reverse()});
  assert.deepEqual(reversed.records, pages[0].records);
  assert.deepEqual(rows[0],record(1,{declaredCoverageCityIds:[4118204]}));
});

test("service and category context cannot invent a serviced specialty", () => {
  const rows=[
    record(1,{declaredCoverageCityIds:[4118204],declaredServiceSlugs:["computadores"]}),
    record(2,{declaredDdds:["41"],declaredServiceSlugs:["cftv"]}),
    record(3,{declaredDdds:["41"]}),
  ];
  const computers=previewCityDiscovery({...city,records:rows,serviceSlug:"computadores"});
  assert.equal(computers.total,1);
  assert.equal(computers.declared_count,1);
  const missing=previewCityDiscovery({...city,records:rows,serviceSlug:"climatizacao"});
  assert.equal(missing.total,0);
});

test("quarantine and blocking cannot be overcome by DDD, city or recency", () => {
  const records=[
    record(1,{declaredCoverageCityIds:[4118204],quarantined:true}),
    record(2,{declaredDdds:["41"],blocked:true}),
    record(3,{declaredDdds:["41"],enabled:false}),
    record(4,{declaredCoverageCityIds:[4118204],published:false}),
    record(5,{declaredDdds:["41"],publicEligible:false}),
  ];
  const result=previewCityDiscovery({...city,records});
  assert.equal(result.total,0);
  assert.equal(result.declared_count,0);
  assert.equal(result.approximate_ddd_count,0);
  assert.equal(result.records.length,0);
});

test("duplicates and invalid city/DDD parameters fail closed", () => {
  const a=record(1,{declaredCoverageCityIds:[4118204]});
  assert.throws(()=>previewCityDiscovery({...city,records:[a,a]}),/duplicada/);
  assert.throws(()=>previewCityDiscovery({...city,records:[{...a,stableKey:""}]}));
  assert.throws(()=>previewCityDiscovery({...city,records:[a],regionDdds:["071"]}));
  assert.throws(()=>previewCityDiscovery({...city,records:[a],pageSize:201}));
  assert.throws(()=>previewCityDiscovery({...city,records:[a],cityIbgeId:"4118204"}));
  assert.throws(()=>previewCityDiscovery({...city,records:[a],cityLabel:"<script>"}));
  assert.throws(()=>previewCityDiscovery({...city,records:[a],serviceSlug:"/private"}));
});

test("profile update is not recent login or online presence", () => {
  const person=record(1,{
    declaredCoverageCityIds:[4118204],
    profileUpdatedAt:"2026-11-05T12:30:00Z",
    lastAuthenticatedAt:"2026-11-12T13:00:00Z",
    online_now:true,
    phone:"+5541999999999",
    private_address:"Endereço de teste",
  });
  const result=previewCityDiscovery({...city,records:[person]});
  assert.equal(result.headings.recent,"Perfis atualizados recentemente");
  assert.equal(result.records[0].profile_updated_at,"2026-11-05T12:30:00Z");
  assert.equal(result.records[0].last_login_at,null);
  assert.equal(result.records[0].availability_confirmed,null);
  assert.equal(result.records[0].service_completed_confirmed,null);
  assert(!JSON.stringify(result).includes("4199999999"));
  assert(!JSON.stringify(result).includes("Endereço de teste"));
});
