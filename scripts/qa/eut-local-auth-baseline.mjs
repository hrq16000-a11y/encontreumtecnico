// REAL LOCAL GoTrue + REST/RLS on a disposable runner, NOT hosted R1 QA.
import assert from "node:assert/strict";
const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = process.env;
assert.match(API_URL || "", /^http:\/\/(?:127\.0\.0\.1|localhost):[0-9]+$/);
assert.ok(ANON_KEY && SERVICE_ROLE_KEY, "Missing LOCAL test credentials");
const root=API_URL.replace(/\/+$/, "");
const headers=(key,extra={})=>({
  apikey:key, Authorization:"Bearer "+key, "Content-Type":"application/json", ...extra
});
async function json(path,options,purpose) {
  const res=await fetch(root+path,options);
  if(!res.ok) throw new Error(purpose+": local HTTP "+res.status);
  return res.json();
}
async function localUser(kind) {
  const email="eut-"+kind+"-only@example.invalid";
  const password="SyntheticOnly-2026-LocalNotASecret";
  const u=await json("/auth/v1/admin/users",{
    method:"POST",headers:headers(SERVICE_ROLE_KEY),
    body:JSON.stringify({email,password,email_confirm:true})
  },"GoTrue synthetic create");
  const id=u.user?.id??u.id;
  assert.match(id||"",/^[0-9a-f-]{36}$/i);
  const session=await json("/auth/v1/token?grant_type=password",{
    method:"POST",headers:headers(ANON_KEY),
    body:JSON.stringify({email,password})
  },"GoTrue synthetic sign-in");
  assert.ok(session.access_token&&session.user?.id===id,"Local JWT mismatch");
  const role=await fetch(root+"/rest/v1/user_roles",{
    method:"POST",headers:headers(SERVICE_ROLE_KEY),
    body:JSON.stringify({user_id:id,role:kind})
  });
  assert.equal(role.status,201,"Local test role insert failed");
  return {id,jwt:session.access_token};
}
async function rows(url,jwt,label) {
  const a=await json(url,{headers:headers(ANON_KEY,{Authorization:"Bearer "+jwt})},label);
  assert.ok(Array.isArray(a),label+" must return an array");
  return a;
}
const admin=await localUser("admin");
const tech=await localUser("tecnico");
const p=await rows("/rest/v1/profiles?select=id&id=eq."+tech.id,tech.jwt,"Owner profile RLS");
assert.equal(p.length,1,"Local auth.users profile trigger missing");
const roles=await rows("/rest/v1/user_roles?select=role&user_id=eq."+admin.id,admin.jwt,"Admin role RLS");
assert.deepEqual(roles.map(x=>x.role),["admin"]);
const created=await fetch(root+"/rest/v1/technicians?select=id,status",{
  method:"POST",headers:headers(ANON_KEY,{Authorization:"Bearer "+tech.jwt,Prefer:"return=representation"}),
  body:JSON.stringify({user_id:tech.id,display_name:"Profissional Sintético Local",city:"Curitiba",status:"pendente"})
});
assert.equal(created.status,201,"Owner technician create: HTTP "+created.status);
const item=(await created.json())[0];
assert.ok(item?.id&&item.status==="pendente","Local technician row missing");
const endpoint="/rest/v1/technicians?select=id&id=eq."+item.id;
assert.equal((await rows(endpoint,tech.jwt,"Owner reload")).length,1);
assert.equal((await rows(endpoint,admin.jwt,"Admin readback")).length,1);
assert.equal((await rows(endpoint,ANON_KEY,"Anonymous pending guard")).length,0);
console.log("LOCAL_AUTH_BASELINE_OK: GoTrue, JWT, profile trigger, role RLS and pending technician REST");
console.log("R1_AUTHLESS_QA_NOT_RUN: current minimal migration set lacks R1 contact and catalog RPCs");
