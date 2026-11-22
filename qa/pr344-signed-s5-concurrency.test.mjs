// PR #344 S5 ONLY: two independent synthetic host adapters, ONE disposable
// Supabase Postgres. All "edge" identities are injected by the test runner,
// never taken from caller-controlled HTTP headers or the official EUT network.
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { postIsolatedIssue } from "./pr344-signed-issue-only.mjs";
import { createS5SyntheticHost } from "./pr344-signed-s5-host-only.mjs";

const origin = "http://127.0.0.1:4173";
const env = Object.freeze({
  PR344_LOCAL_ONLY: "yes",
  PR344_ISSUE_TEST_ONLY: "enabled",
  PR344_S5_SIMULATED: "enabled",
  SUPABASE_ACCESS_TOKEN: "",
  VITE_EUT_HTTP_PRESENCE_INGEST: "disabled",
  VITE_EUT_HTTP_PRESENCE_ADMIN_READ: "disabled",
  VITE_EUT_PRIVATE_REALTIME_PRESENCE: "disabled",
});
const api = process.env.PR344_API_URL ?? "";
assert.match(api, /^http:\/\/127\.0\.0\.1:\d+$/, "never contact an official Supabase host");
assert.equal(process.env.SUPABASE_ACCESS_TOKEN, "");
assert.equal(process.env.PR344_LOCAL_ONLY, "yes");
assert.equal(process.env.PR344_S5_SIMULATED, "enabled");
for (const key of ["VITE_EUT_HTTP_PRESENCE_INGEST","VITE_EUT_HTTP_PRESENCE_ADMIN_READ","VITE_EUT_PRIVATE_REALTIME_PRESENCE"]) {
  assert.equal(process.env[key], "disabled");
}
const key = process.env.PR344_SERVICE_ROLE_KEY ?? "";
assert.ok(key && key !== process.env.PR344_ANON_KEY);
const mkDb = () => createClient(api, key, { auth: {
  persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
}});
const dbA = mkDb(), dbB = mkDb(); // Separate host clients/connection pools.
const signingKeyHex = randomBytes(32).toString("hex");
const hashKeyHex = randomBytes(32).toString("hex");
const rateKeyHex = randomBytes(32).toString("hex");
const kid = "s5local";
const fixedSeconds = Math.floor(Date.now() / 60_000) * 60;
const now = { seconds: fixedSeconds };
const common = {
  env, allowedOrigin: origin, kid, signingKeyHex,
  hashKeyHex, rateKeyHex, nowSeconds: () => now.seconds,
};
const issueBody = { op: "issue", consent: true };
const startBody = (credential) => ({ op: "start", credential, consent: true });
const req = (data, forged = {}) => new Request(origin + "/api/presence/leases", {
  method: "POST",
  headers: {
    Origin: origin, "Content-Type": "application/json",
    "Sec-Fetch-Site": "same-origin", ...forged,
  },
  body: JSON.stringify(data),
});
function hosts(identity) {
  return [
    createS5SyntheticHost({ ...common, db: dbA, trustedIngressTag: identity }),
    createS5SyntheticHost({ ...common, db: dbB, trustedIngressTag: identity }),
  ];
}
async function invokeIssue(host, headers) {
  const response = await host.issue(req(issueBody, headers));
  const result = { status: response.status };
  if (response.status === 201) {
    const value = await response.json();
    assert.deepEqual(Object.keys(value).sort(), ["credential","hardExpiresAt"]);
    result.credential = value.credential;
  } else assert.equal(await response.text(), "");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  assert.match(response.headers.get("Cache-Control") ?? "", /no-store/);
  return result;
}
async function invokeStart(host, credential, headers) {
  const result = await host.start(req(startBody(credential), headers));
  assert.equal(await result.text(), "");
  assert.match(result.headers.get("Cache-Control") ?? "", /no-store/);
  return result.status;
}
function bucketHash(op, ingress, at = now.seconds) {
  return createHmac("sha256", Buffer.from(rateKeyHex, "hex"))
    .update("EUT-PRESENCE-RATE/p1|" + op + "|" + ingress + "|" + Math.floor(at / 60), "utf8")
    .digest("hex");
}
async function budget(op, ingress, at = now.seconds) {
  const { data, error } = await dbA.from("pr344_signed_s5_budgets")
    .select("used,bucket_hash").eq("bucket_hash", bucketHash(op, ingress, at)).maybeSingle();
  assert.ifError(error);
  return data?.used ?? 0;
}
async function leases() {
  const { data, error } = await dbA.from("pr344_signed_s5_leases")
    .select("tab_hash,expires_at");
  assert.ifError(error);
  return data;
}
async function fixtureSignedCredential() {
  // S1 issuer used only to prepare a token; no repetition of S1 assertions.
  const result = await postIsolatedIssue(req(issueBody), {
    env, allowedOrigin: origin, kid, keyHex: signingKeyHex,
    nowSeconds: () => now.seconds,
    reserveIssue: async () => "ok", // distinct fixture, no shared S5 budget
  });
  assert.equal(result.status, 201);
  return (await result.json()).credential;
}

test("S5a: 14 concurrent issue across two hosts share one atomic five-slot budget", async () => {
  const ingress = "runner-edge-issue-a";
  const [a,b] = hosts(ingress);
  const operations = Array.from({ length: 14 }, (_, i) =>
    invokeIssue(i % 2 ? a : b, {
      "x-forwarded-for": i % 2 ? "203.0.113.99" : "198.51.100.2",
      "x-real-ip": "192.0.2.50",
      "x-pr344-synthetic-network": "forged-" + i,
    }));
  const results = await Promise.all(operations);
  assert.equal(results.filter(x => x.status === 201).length, 5);
  assert.equal(results.filter(x => x.status === 429).length, 9);
  assert.equal(new Set(results.filter(x => x.credential).map(x => x.credential)).size, 5);
  assert.equal(await budget("issue", ingress), 5, "no lost updates under burst");
  assert.equal(await budget("start", ingress), 0, "issue and start have distinct budgets");
});

test("S5b: 20 concurrent start retries of one signed tab charge only once across hosts", async () => {
  const ingress = "runner-edge-start-b";
  const [a,b] = hosts(ingress);
  const credential = await fixtureSignedCredential();
  const statuses = await Promise.all(Array.from({length:20}, (_,i) =>
    invokeStart(i%2 ? a : b, credential, {
      "x-forwarded-for": "198.51.100." + (i+1),
      "x-pr344-synthetic-network": "client-controlled",
    })));
  assert.deepEqual(new Set(statuses), new Set([204]));
  assert.equal(await budget("start", ingress), 1);
  const rows = await leases();
  assert.ok(rows.length >= 1);
  assert.equal(new Set(rows.map(x => x.tab_hash)).size, rows.length);
  // 4 genuinely new credentials use the last slots, 6th must hit 429.
  for (let i=0;i<4;i++) assert.equal(
    await invokeStart(i%2 ? a : b, await fixtureSignedCredential()), 204);
  assert.equal(await budget("start", ingress), 5);
  assert.equal(await invokeStart(a, await fixtureSignedCredential()), 429);
  assert.equal(await invokeStart(b, credential), 204, "retry remains 204 at full quota");
  assert.equal(await budget("start", ingress), 5, "retry did not consume a sixth slot");
});

test("S5c: forwarded header forgery cannot choose a different server-trusted bucket", async () => {
  const ingressA = "runner-edge-real-a", ingressB = "runner-edge-real-b";
  const a = hosts(ingressA)[0];
  const b = hosts(ingressB)[1];
  // Same faked headers on both hosts do NOT force the same bucket;
  // different fake headers on one host do NOT create new allowance.
  for (let i=0;i<5;i++) {
    assert.equal((await invokeIssue(a, { "x-forwarded-for": "192.0.2."+i,
      "x-pr344-synthetic-network": "runner-edge-real-b" })).status, 201);
  }
  assert.equal((await invokeIssue(a, { "x-forwarded-for":"203.0.113.55" })).status, 429);
  assert.equal((await invokeIssue(b, { "x-forwarded-for":"192.0.2.1",
    "x-pr344-synthetic-network": ingressA })).status, 201);
  assert.equal(await budget("issue", ingressA), 5);
  assert.equal(await budget("issue", ingressB), 1);
});

test("S5d: issue retries are non-idempotent but bounded across hosts and time windows", async () => {
  const ingress = "runner-edge-retry-d";
  const [a,b] = hosts(ingress);
  for (let i=0;i<5;i++) assert.equal((await invokeIssue(i%2 ? a : b)).status, 201);
  assert.equal((await invokeIssue(b)).status, 429, "timeout retry cannot bypass exhausted quota");
  assert.equal(await budget("issue", ingress), 5);
  const oldTime = now.seconds;
  try {
    now.seconds += 60;
    assert.equal((await invokeIssue(a)).status, 201, "new signed server time bucket");
    assert.equal(await budget("issue", ingress, oldTime), 5);
    assert.equal(await budget("issue", ingress), 1);
  } finally { now.seconds = oldTime; }
});

test("S5e: missing trusted context/limiter fail closed before any SQL mutation", async () => {
  let calls = 0;
  const guardedDb = { rpc: async () => { calls++; throw new Error("should not be called"); }};
  const noEdge = createS5SyntheticHost({ ...common, db: guardedDb });
  const notLocal = createS5SyntheticHost({ ...common, db: guardedDb,
    trustedIngressTag: "runner-edge-valid", env: { ...env, PR344_S5_SIMULATED: "disabled" } });
  for (const host of [noEdge,notLocal]) {
    assert.equal((await invokeIssue(host)).status, 503);
    assert.equal(await invokeStart(host, await fixtureSignedCredential()), 503);
  }
  assert.equal(calls, 0);
  const failedDb = { rpc: async () => { calls++; throw Error("disposable storage unavailable"); }};
  const down = createS5SyntheticHost({ ...common, db: failedDb,
    trustedIngressTag: "runner-edge-down-e" });
  assert.equal((await invokeIssue(down)).status, 503);
  assert.equal(await invokeStart(down, await fixtureSignedCredential()), 503);
  assert.equal(calls, 2, "storage outage is not a silent success or free issuance");
});

test("S5f: forged/malformed start never reserves shared quota", async () => {
  const ingress = "runner-edge-malformed-f";
  const [a] = hosts(ingress);
  assert.equal(await invokeStart(a,"f".repeat(32)),400);
  assert.equal(await budget("start", ingress),0);
});
