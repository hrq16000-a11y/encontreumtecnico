import { test } from "node:test";
import assert from "node:assert/strict";
import { previewSanitizedCityBackendResponse } from "./external-directory-city-response.mjs";

const context = {
  routeKey:"home", cityIbgeId:4118204, cityLabel:"Paranaguá",
  regionDdds:["41"], state:"fixture_complete",
  referenceTime:"2026-11-12T14:00:00Z",
  evidence: {
    sourceExhaustive:true,
    eligibilityChecked:true,
    authorizedScopeChecked:true,
    municipalEvidenceChecked:true,
    cityDddMappingChecked:true,
  },
};
const row=(n,extra={})=>({
  stableKey:"organic:technicians:"+String(n).padStart(6,"0"),
  sourceKind:"organic",eligibilityAttested:true,
  enabled:true,published:true,publicEligible:true,
  publicSlugVerified:true,publicSlug:"tecnico-"+n,
  displayName:"Técnico "+n,
  profileUpdatedAt:"2026-11-10T13:00:00Z",
  declaredCoverageCityIds:[4118204],declaredDdds:[],
  declaredCategorySlugs:["computadores"],declaredServiceSlugs:["formatacao"],
  ...extra,
});

test("allowlist keeps only public fields, protects private identifiers and contact data",()=>{
  const source=row(1,{
    phone:"+5541999999999",email:"segredo@exemplo.test",
    private_address:"Rua de Teste 123",client_name:"Cliente Privado",
    auth_user_id:"private-auth",lastAuthenticatedAt:"2026-11-12T09:00:00Z",
    online_now:true,service_request_id:"private-request",
    source_key:"private-source",wp_post_id:123,
  });
  const original=structuredClone(source);
  const response=previewSanitizedCityBackendResponse({...context,records:[source]});
  assert.deepEqual(source,original);
  assert.equal(response.state,"fixture_ready");
  assert.equal(response.public_integration_authorized,false);
  assert.equal(response.is_real_backend_response,false);
  assert.deepEqual(response.city,{ibge_id:4118204,label:"Paranaguá"});
  assert.equal(response.totals.eligible_matches,1);
  assert.equal(response.totals.declared_municipality,1);
  const card=response.sections[0].cards[0];
  assert.deepEqual(card,{
    display_name:"Técnico 1",
    match_kind:"declared_municipality",
    match_label:"Cobertura municipal declarada",
    profile_path:"/tecnicos/tecnico-1",
    profile_updated_at:"2026-11-10T13:00:00Z",
  });
  const serialized=JSON.stringify(response);
  for(const secret of ["999999999","segredo@","Rua de Teste","Cliente Privado",
    "private-auth","private-request","private-source","last_login","online_now","stable_key",
    "wp_post_id","auth_user_id"]) assert.equal(serialized.includes(secret),false,secret);
  assert(Object.isFrozen(response));
  assert(Object.isFrozen(response.sections[0].cards[0]));
});

test("no eligibility attestations or source review: no published cards or counts",()=>{
  const rows=[
    row(1,{eligibilityAttested:false}),
    row(2,{enabled:false}),
    row(3,{blocked:true}),
    row(4,{quarantined:true,sourceKind:"external",sourceReviewed:false}),
    row(5,{sourceKind:"wordpress",sourceReviewed:false}),
    row(6,{published:false}),
    row(7,{publicEligible:false}),
  ];
  const r=previewSanitizedCityBackendResponse({...context,records:rows});
  assert.equal(r.totals.eligible_matches,0);
  assert.equal(r.sections.length,0);
  assert.match(r.fallback,/Nenhum profissional/);
});

test("external/WordPress sources can only enter fixture when separately reviewed and eligible",()=>{
  const rows=[
    row(1,{sourceKind:"external",sourceReviewed:true}),
    row(2,{sourceKind:"wordpress",sourceReviewed:true,declaredCoverageCityIds:[],declaredDdds:["41"]}),
    row(3,{sourceKind:"external",sourceReviewed:false}),
    row(4,{sourceKind:"wordpress",sourceReviewed:false}),
  ];
  const r=previewSanitizedCityBackendResponse({...context,records:rows});
  assert.equal(r.totals.eligible_matches,2);
  assert.equal(r.totals.declared_municipality,1);
  assert.equal(r.totals.approximate_telephone_region,1);
  assert.match(r.sections[1].heading,/cobertura não confirmada/);
  assert.equal(r.sections[1].cards[0].match_kind,"approximate_phone_region");
  assert.equal(r.public_integration_authorized,false);
});

test("truncated, unavailable or unchecked fixtures never publish counts/cards",()=>{
  const gateNames=["sourceExhaustive","eligibilityChecked","authorizedScopeChecked","municipalEvidenceChecked"];
  for(const gate of gateNames){
    const r=previewSanitizedCityBackendResponse({
      ...context,records:[row(1)],evidence:{...context.evidence,[gate]:false},
    });
    assert.equal(r.state,"insufficient_evidence");
    assert.equal(r.totals,null);
    assert.equal(r.pagination,null);
    assert.equal(r.sections.length,0);
    assert.equal(r.city,null);
    assert.equal(r.public_integration_authorized,false);
  }
  for(const state of ["loading","unavailable"]){
    const r=previewSanitizedCityBackendResponse({...context,records:[row(1)],state});
    assert.equal(r.totals,null);
    assert.equal(r.sections.length,0);
    assert.match(r.fallback,/cidade|região/);
  }
});

test("only verified city↔DDD map may produce secondary regional cards/counts",()=>{
  const rows=[
    row(1,{declaredCoverageCityIds:[],declaredDdds:["41"]}),
    row(2,{declaredCoverageCityIds:[4118204]}),
  ];
  const a=previewSanitizedCityBackendResponse({
    ...context,records:rows,evidence:{...context.evidence,cityDddMappingChecked:false},
  });
  assert.equal(a.totals.declared_municipality,1);
  assert.equal(a.totals.approximate_telephone_region,null);
  assert.equal(a.sections.some(s=>s.kind==="telephone_region_approximate"),false);
  const b=previewSanitizedCityBackendResponse({...context,records:rows});
  assert.equal(b.totals.eligible_matches,2);
  assert.equal(b.totals.approximate_telephone_region,1);
  assert.equal(b.sections[1].cards[0].profile_path,"/tecnicos/tecnico-1");
  assert.equal(b.sections[1].cards[0].match_kind,"approximate_phone_region");
});

test("missing, unsafe or unverified public slug yields no guessed profile link",()=>{
  const names=[
    row(1,{publicSlugVerified:false}),
    row(2,{publicSlug:"../secret"}),
    row(3,{publicSlug:"the/other"}),
    row(4,{publicSlug:null}),
    row(5,{displayName:"WhatsApp +55 41 99999-9999"}),
    row(6,{displayName:"Contato admin@example.test"}),
  ];
  const r=previewSanitizedCityBackendResponse({...context,records:names,pageSize:12});
  assert.equal(r.totals.eligible_matches,6);
  const cards=r.sections[0].cards;
  assert(cards.slice(0,4).every(c=>c.profile_path===null));
  assert(cards.slice(4).every(c=>c.display_name==="Profissional com dados mínimos"));
  assert(!JSON.stringify(r).includes("99999"));
  assert(!JSON.stringify(r).includes("admin@example.test"));
});

test("a 560-eligible fixture paginates all pages with exhaustive counts and safe keys",()=>{
  const rows=Array.from({length:560},(_,i)=>row(i+1,i%2===0
    ? {} : {declaredCoverageCityIds:[],declaredDdds:["41"]}));
  rows.push(row(561,{quarantined:true,sourceKind:"external"}));
  const opts={...context,records:rows,pageSize:50,referenceTime:null};
  const pages=Array.from({length:12},(_,i)=>previewSanitizedCityBackendResponse({...opts,page:i+1}));
  assert.equal(pages[0].totals.eligible_matches,560);
  assert.equal(pages[0].totals.declared_municipality,280);
  assert.equal(pages[0].totals.approximate_telephone_region,280);
  assert.equal(pages[10].pagination.has_next_page,true);
  assert.equal(pages[11].pagination.has_next_page,false);
  const paths=pages.flatMap(p=>p.sections.flatMap(s=>s.cards.map(c=>c.profile_path)));
  assert.equal(paths.length,560);
  assert.equal(new Set(paths).size,560);
  assert(paths.includes("/tecnicos/tecnico-560"));
  const reversed=previewSanitizedCityBackendResponse({...opts,records:[...rows].reverse()});
  assert.deepEqual(reversed.sections,pages[0].sections);
});

test("existing category/service routes apply category facet, not invented service completion",()=>{
  const rows=[
    row(1,{declaredCategorySlugs:["computadores"],declaredServiceSlugs:[]}),
    row(2,{declaredCategorySlugs:["redes"],declaredServiceSlugs:["computadores"]}),
  ];
  const cat=previewSanitizedCityBackendResponse({
    ...context,routeKey:"category",routeCategorySlug:"computadores",records:rows,
  });
  const service=previewSanitizedCityBackendResponse({
    ...context,routeKey:"service_category",routeCategorySlug:"computadores",records:rows,
  });
  assert.equal(cat.totals.eligible_matches,1);
  assert.equal(service.totals.eligible_matches,1);
  assert.equal(service.sections[0].cards[0].profile_path,"/tecnicos/tecnico-1");
  assert.equal(JSON.stringify(service).includes("service_completed_confirmed"),false);
});

test("duplicate identities and invalid sources fail closed",()=>{
  assert.throws(()=>previewSanitizedCityBackendResponse({
    ...context,records:[row(1),row(1)],
  }),/duplicada/);
  assert.throws(()=>previewSanitizedCityBackendResponse({
    ...context,records:[row(1,{sourceKind:"unknown"})],
  }),/fonte/);
  assert.throws(()=>previewSanitizedCityBackendResponse({
    ...context,records:[row(1)],routeKey:"__proto__",
  }));
  assert.throws(()=>previewSanitizedCityBackendResponse({
    ...context,evidence:null,records:[row(1)],
  }));
  assert.throws(()=>previewSanitizedCityBackendResponse({
    ...context,records:"invalid",
  }));
});
