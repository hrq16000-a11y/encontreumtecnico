// QA 483: genuine local GoTrue sessions -> PostgREST -> unmodified #377 RPC.
// All persistence is localhost-only and synthetic. No remote Supabase credentials.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raw = execFileSync("supabase",["status","-o","env"],{
  cwd:".github/qa/eut-admin-346",encoding:"utf8",stdio:["ignore","pipe","pipe"]
});
const env = Object.fromEntries(raw.split(/\r?\n/).filter(s=>s.includes("=")).map(s=>{
  const ix=s.indexOf("=");return [s.slice(0,ix),s.slice(ix+1).replace(/^"|"$/g,"")];
}));
const api=env.API_URL, anon=env.ANON_KEY, service=env.SERVICE_ROLE_KEY, db=env.DB_URL;
for(const [value,port] of [[api,"54321"],[db,"54322"]]){
  const u=new URL(value);
  if(!["127.0.0.1","localhost"].includes(u.hostname)||u.port!==port)
    throw Error("REFUSING non-local QA endpoint");
}
if(!anon||!service||!process.env.RUNNER_TEMP)throw Error("Missing local ephemeral inputs");
const password="EUT_local_qa_only_483!"; // no real credential, runner-only users.
const nonce=randomUUID().slice(0,8);
const ownerEmail="qa483-owner-"+nonce+"@example.invalid";
const managerEmail="qa483-manager-"+nonce+"@example.invalid";
const regularEmail="qa483-member-"+nonce+"@example.invalid";

async function request(path,{token=anon,method="POST",body}={}){
  const response=await fetch(api+path,{
    method,headers:{apikey:anon,authorization:"Bearer "+token,"content-type":"application/json"},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(18000)
  });
  let data;try{data=await response.json()}catch{data=null}
  return {status:response.status,data};
}
function assert(ok,msg){if(!ok)throw Error(msg)}
async function createUser(email){
  const r=await request("/auth/v1/admin/users",{
    token:service,body:{email,password,email_confirm:true}
  });
  assert([200,201].includes(r.status)&&r.data?.id,"GoTrue admin/users failed "+r.status);
  return r.data.id;
}
async function signIn(email,id){
  const r=await request("/auth/v1/token?grant_type=password",{body:{email,password}});
  assert(r.status===200&&r.data?.access_token,"GoTrue password login failed "+r.status);
  const token=r.data.access_token;
  const claims=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString("utf8"));
  assert(claims.sub===id&&/^[0-9a-f-]{36}$/i.test(claims.session_id||""),
    "Real Auth session_id JWT missing");
  const me=await request("/auth/v1/user",{method:"GET",token});
  assert(me.status===200&&me.data?.id===id,"GoTrue user/session not verified");
  return {token,claims};
}
function sql(query){
  // The database CLI credential is confined to 127.0.0.1:54322.
  return execFileSync("psql",[db,"-X","-tA","-v","ON_ERROR_STOP=1","-c",query],
    {encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}
const ownerId=await createUser(ownerEmail);
const managerId=await createUser(managerEmail);
const memberId=await createUser(regularEmail);
const owner=await signIn(ownerEmail,ownerId);
const manager=await signIn(managerEmail,managerId);
const member=await signIn(regularEmail,memberId);
for(const value of [ownerId,managerId,memberId]) assert(/^[0-9a-f-]{36}$/i.test(value),"Bad local uuid");
sql("INSERT INTO public.user_roles(user_id,role) VALUES "+
  "('"+ownerId+"'::uuid,'admin'),('"+managerId+"'::uuid,'admin'),"+
  "('"+memberId+"'::uuid,'cliente');"+
  "INSERT INTO eut_migration.project_owner_bootstrap(singleton,owner_email,claimed_user_id,claimed_at) "+
  "VALUES(true,'"+ownerEmail+"','"+ownerId+"'::uuid,now());");
const rpc=(name,token,body)=>request("/rest/v1/rpc/"+name,{token,body});
const publicRead=()=>rpc("eut_public_directory_settings",anon);
const ownerRead=token=>rpc("eut_owner_directory_settings",token);
const ownerWrite=(token,settings,version,reason)=>rpc("eut_owner_update_directory_settings",token,{
  _settings:settings,_expected_version:version,_reason:reason
});
const forbidden=r=>r.status===401||r.status===403||r.data?.code==="42501";
const initialPublic=await publicRead();
assert(initialPublic.status===200&&Object.keys(initialPublic.data??{}).length===8,
  "Public RPC did not expose exactly eight safe settings");
const before=await ownerRead(owner.token);
assert(before.status===200&&before.data?.version===1&&before.data?.audit?.length===0,
  "Owner initial read/version/audit failed");
for(const [actor,name] of [[anon,"anonymous"],[manager.token,"manager"],[member.token,"member"]]){
  assert(forbidden(await ownerRead(actor)),"Unauthorized "+name+" owner read granted");
  assert(forbidden(await ownerWrite(actor,initialPublic.data,1,"Negacao QA 483")),
    "Unauthorized "+name+" write granted");
}
const settingsRank={...before.data.settings,online_priority:false};
const writeRank=await ownerWrite(owner.token,settingsRank,1,"Alteracao local ranking QA483");
assert(writeRank.status===200&&writeRank.data?.version===2,"Real rank update failed");
const afterRank=await ownerRead(owner.token);
assert(afterRank.status===200&&afterRank.data?.version===2&&
  afterRank.data.settings.online_priority===false&&afterRank.data.audit?.length===1,
  "Rank reread and audit failed");
const settingsCard={...settingsRank,photo_outline:false};
const writeCard=await ownerWrite(owner.token,settingsCard,2,"Alteracao local card QA483");
assert(writeCard.status===200&&writeCard.data?.version===3,"Real card update failed");
const renewedOwner=await signIn(ownerEmail,ownerId);
const after=await ownerRead(renewedOwner.token);
assert(after.status===200&&after.data?.version===3&&after.data.audit?.length===2&&
  after.data.settings.photo_outline===false&&after.data.settings.online_priority===false,
  "Reopened owner session did not observe persistence and audit");
const pub=await publicRead();
assert(pub.status===200&&pub.data?.online_priority===false&&pub.data?.photo_outline===false&&
  Object.keys(pub.data??{}).length===8,"Public directory settings did not reflect changes");

const old=await ownerWrite(owner.token,settingsRank,1,"Versao antiga QA483");
assert(old.status>=400&&old.data?.code==="40001","Stale CAS was allowed");
const badKey=await ownerWrite(owner.token,{...settingsCard,private_phone:"x"},3,"Parametro privado QA483");
assert(badKey.status>=400&&badKey.data?.code==="22023","Unexpected key was allowed");
const short=await ownerWrite(owner.token,settingsCard,3,"abc");
assert(short.status>=400&&short.data?.code==="22023","Short audit reason allowed");

sql("INSERT INTO public.qa_483_blocked_accounts(user_id) VALUES ('"+ownerId+"'::uuid)");
const suspended=await ownerWrite(owner.token,{...settingsCard,online_priority:true},3,
  "Conta bloqueada QA483");
assert(forbidden(suspended),"Blocked owner could mutate");
sql("DELETE FROM public.qa_483_blocked_accounts WHERE user_id='"+ownerId+"'::uuid");

const audit=sql("SELECT jsonb_build_object("+
  "'count',count(*)::int,"+
  "'attributed',count(*) FILTER (WHERE actor_id='"+ownerId+"'::uuid)::int,"+
  "'sessions',count(DISTINCT session_id)::int,"+
  "'reasons',count(*) FILTER (WHERE length(reason)>=8)::int,"+
  "'updated_at_present',bool_and(changed_at IS NOT NULL),"+
  "'after_versions',jsonb_agg(version ORDER BY version))::text"+
  " FROM eut_migration.directory_display_audit");
const auditData=JSON.parse(audit);
assert(auditData.count===2&&auditData.attributed===2&&auditData.sessions>=1&&
  auditData.reasons===2&&auditData.updated_at_present===true&&
  JSON.stringify(auditData.after_versions)==="[2,3]","Audit provenance mismatch");
const unchanged=await ownerRead(renewedOwner.token);
assert(unchanged.data?.version===3&&unchanged.data?.audit?.length===2,
  "Rejected actions unexpectedly mutated settings");

const output=join(process.env.RUNNER_TEMP,"eut483-synthetic-owner.json");
writeFileSync(output,JSON.stringify({email:ownerEmail}),{mode:0o600});
mkdirSync("artifacts/eut-483",{recursive:true});
writeFileSync("artifacts/eut-483/auth-evidence.json",JSON.stringify({
  testedCommit:process.env.GITHUB_SHA??"unknown",
  endpoint:"http://127.0.0.1:54321",
  goTrueSessions:"PASS",sessionIdVerified:true,
  ownerRead:"PASS",ownerWriteAndReread:"PASS",
  rankToggleApplied:true,cardToggleApplied:true,publicReadObserved:true,
  nonOwnerDenied:true,staleAndInvalidDenied:true,blockedOwnerDenied:true,
  versionAfter:3,audits:2,auditAttribution:"PASS"
},null,2));
console.log("PASS QA483: real local GoTrue sessions, owner write/reopen, 2 audited events, public flags, denial for anon/admin/nonadmin/stale/blocked. No remote writes.");
