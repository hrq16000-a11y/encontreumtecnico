import { test } from "node:test";
import assert from "node:assert/strict";
import { previewCitySurface } from "./external-directory-city-surface.mjs";

const city = { cityIbgeId:4118204,cityLabel:"Paranaguá",regionDdds:["41"] };
const complete = {
  ...city, state:"fixture_complete",
  sourceExhaustive:true,municipalEvidenceChecked:true,
  areaMappingChecked:true,referenceTime:"2026-11-12T14:00:00Z",
};
const row = (id, extra={}) => ({
  stableKey:"organic:technicians:"+String(id).padStart(5,"0"),
  displayName:"Profissional "+id,
  enabled:true,published:true,publicEligible:true,
  declaredCoverageCityIds:[4118204],declaredDdds:[],
  declaredServiceSlugs:["computadores"],declaredCategorySlugs:["computadores"],
  profileUpdatedAt:"2026-11-10T13:00:00Z",
  ...extra,
});

test("Home displays verified municipal coverage and segregates DDD-only region", () => {
  const source = [
    row(1,{phone:"+5541999999999",private_address:"Casa de cliente"}),
    row(2,{declaredCoverageCityIds:[],declaredDdds:["41"]}),
    row(3,{declaredCoverageCityIds:[],declaredDdds:["71"]}),
  ];
  const actual=previewCitySurface({...complete,context:"home",records:source});
  assert.equal(actual.state,"fixture_ready");
  assert.deepEqual(actual.sections.map(x=>x.kind),[
    "declared_coverage","telephone_region_approximate","recent_profile_updates",
  ]);
  assert.equal(actual.declared_count,1);
  assert.equal(actual.approximate_ddd_count,1);
  assert.match(actual.sections[0].heading,/cobertura declarada em Paranaguá/);
  assert.match(actual.sections[1].heading,/cobertura não confirmada/);
  assert.equal(actual.sections[0].total_count,1);
  assert.equal(actual.sections[1].total_count,1);
  assert.equal(actual.sections[2].total_count,null);
  assert.equal(actual.sections[2].count_is_exhaustive,false);
  assert.equal(actual.cta.kind,"existing_help_request_funnel");
  assert.equal(actual.cta.href,null);
  assert.equal(actual.public_integration_authorized,false);
  assert(!JSON.stringify(actual).includes("99999999"));
  assert(!JSON.stringify(actual).includes("Casa de cliente"));
  assert(!JSON.stringify(actual).includes("last_login"));
  assert(Object.isFrozen(actual.sections));
});

test("category and service surfaces reuse city-first catalogue with declared taxonomy", () => {
  const a=row(1);
  const b=row(2,{declaredServiceSlugs:["cftv"],declaredCategorySlugs:["seguranca"]});
  const c=row(3,{declaredServiceSlugs:[],declaredCategorySlugs:[]});
  const base={...complete,records:[a,b,c],referenceTime:null};
  const category=previewCitySurface({...base,context:"category",categorySlug:"computadores"});
  assert.equal(category.total,1);
  assert.equal(category.sections[0].cards[0].stable_key,a.stableKey);
  const service=previewCitySurface({...base,context:"service",serviceSlug:"computadores"});
  assert.equal(service.total,1);
  assert.equal(service.sections[0].cards[0].stable_key,a.stableKey);
  const noCategory=previewCitySurface({...base,context:"category",categorySlug:"climatizacao"});
  assert.equal(noCategory.total,0);
  assert.match(noCategory.fallback,/Nenhum profissional/);
  assert.equal(previewCitySurface({...base,context:"home"}).total,3);
  assert.throws(()=>previewCitySurface({...base,context:"category"}));
  assert.throws(()=>previewCitySurface({...base,context:"service"}));
});

test("incomplete, loading and failed sources fail closed without counts or claims", () => {
  for(const props of [
    {...complete,sourceExhaustive:false},
    {...complete,municipalEvidenceChecked:false},
    {...complete,state:"loading"},
    {...complete,state:"unavailable"},
  ]) {
    const display=previewCitySurface({...props,records:[row(1)]});
    assert.equal(display.verified_counts,false);
    assert.equal(display.declared_count,null);
    assert.equal(display.approximate_ddd_count,null);
    assert.equal(display.sections.length,0);
    assert.match(display.fallback,/cidade|região/);
    assert.equal(display.public_integration_authorized,false);
  }
});

test("without independently verified city-DDD mapping, the hint is omitted", () => {
  const records=[
    row(1,{declaredCoverageCityIds:[],declaredDdds:["41"]}),
    row(2),
  ];
  const value=previewCitySurface({...complete,areaMappingChecked:false,records,referenceTime:null});
  assert.equal(value.declared_count,1);
  assert.equal(value.approximate_ddd_count,null);
  assert.equal(value.total,1);
  assert.equal(value.sections.some(x=>x.kind==="telephone_region_approximate"),false);
});

test("DDD-only is an approximate hint, not 'we have technicians in this city'", () => {
  const value=previewCitySurface({...complete,records:[
    row(1,{declaredCoverageCityIds:[],declaredDdds:["41"]}),
  ],referenceTime:null});
  assert.equal(value.declared_count,0);
  assert.equal(value.approximate_ddd_count,1);
  assert(value.sections.every(x=>x.kind!=="declared_coverage"));
  assert.match(value.fallback,/Sem cobertura municipal declarada/);
  assert.match(value.sections[0].heading,/cobertura não confirmada/);
});

test("quarantined and blocked records never appear even with a city or DDD", () => {
  const records=[
    row(1,{quarantined:true}),
    row(2,{blocked:true}),
    row(3,{enabled:false}),
    row(4,{published:false}),
    row(5,{publicEligible:false}),
    row(6,{declaredCoverageCityIds:[],declaredDdds:["41"],quarantined:true}),
  ];
  const display=previewCitySurface({...complete,records});
  assert.equal(display.total,0);
  assert.equal(display.sections.length,0);
  assert.match(display.fallback,/Nenhum profissional/);
});

test("560 complete eligible records paginate deterministically, never drop after 200", () => {
  const records=Array.from({length:560},(_,i)=>row(i+1, i%2
    ? {declaredCoverageCityIds:[],declaredDdds:["41"]}
    : {}));
  const opts={...complete,records,pageSize:50,referenceTime:null};
  const pages=Array.from({length:12},(_,i)=>previewCitySurface({...opts,page:i+1}));
  assert.equal(pages[0].declared_count,280);
  assert.equal(pages[0].approximate_ddd_count,280);
  assert.equal(pages[0].total,560);
  assert.equal(pages[11].has_next_page,false);
  const ids=pages.flatMap(x=>x.sections.flatMap(s=>s.cards.map(c=>c.stable_key)));
  assert.equal(ids.length,560);
  assert.equal(new Set(ids).size,560);
  assert.equal(ids.includes(records[559].stableKey),true);
  assert.deepEqual(
    previewCitySurface({...opts,records:[...records].reverse()}).sections,
    pages[0].sections,
  );
});

test("recent label uses only genuine profile updates, never login/presence metadata", () => {
  const r=row(1,{profileUpdatedAt:"2026-09-01T12:00:00Z",
    lastAuthenticatedAt:"2026-11-12T13:00:00Z",online_now:true});
  const display=previewCitySurface({...complete,records:[r]});
  assert.equal(display.sections.some(s=>s.kind==="recent_profile_updates"),false);
  assert.equal(display.sections[0].cards[0].last_login_at,null);
  const future=row(2,{profileUpdatedAt:"2026-12-01T12:00:00Z"});
  const other=previewCitySurface({...complete,records:[future]});
  assert.equal(other.sections.some(s=>s.kind==="recent_profile_updates"),false);
  assert(!JSON.stringify(other).includes("2026-11-12T13:00:00Z"));
  assert.throws(()=>previewCitySurface({...complete,records:[r],
    referenceTime:"yesterday"}));
});

test("invalid contexts and duplicate catalogue identities fail closed", () => {
  assert.throws(()=>previewCitySurface({...complete,context:"advertising",records:[]}));
  assert.throws(()=>previewCitySurface({...complete,records:[row(1),row(1)]}),
    /duplicada/);
  assert.throws(()=>previewCitySurface({...complete,
    context:"service",serviceSlug:"<unsafe>",records:[row(1)]}));
});
