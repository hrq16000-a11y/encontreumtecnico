// PR #344 S3 + affected signed-expiry transitions only.
// Real SQL transactions on fresh local Supabase; QA-only HTTP-shaped handler.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { postIsolatedIssue, verifySignedCredential } from "./pr344-signed-issue-only.mjs";
import { postIsolatedSignedTransition } from "./pr344-signed-transitions-only.mjs";

const origin = "http://127.0.0.1:4173";
const epoch = Math.floor(Date.now() / 1000);
const kid = "local1";
const signingKey = randomBytes(32).toString("hex");
const hashKey = randomBytes(32).toString("hex");
const flags = {
  PR344_LOCAL_ONLY: "yes",
  PR344_ISSUE_TEST_ONLY: "enabled",
  SUPABASE_ACCESS_TOKEN: "",
  VITE_EUT_HTTP_PRESENCE_INGEST: "disabled",
  VITE_EUT_HTTP_PRESENCE_ADMIN_READ: "disabled",
  VITE_EUT_PRIVATE_REALTIME_PRESENCE: "disabled",
};

assert.equal(process.env.PR344_LOCAL_ONLY, "yes");
assert.equal(process.env.SUPABASE_ACCESS_TOKEN, "");
for (const key of [
  "VITE_EUT_HTTP_PRESENCE_INGEST",
  "VITE_EUT_HTTP_PRESENCE_ADMIN_READ",
  "VITE_EUT_PRIVATE_REALTIME_PRESENCE",
]) assert.equal(process.env[key], "disabled");
const apiUrl = process.env.PR344_API_URL ?? "";
assert.match(apiUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
const serviceKey = process.env.PR344_SERVICE_ROLE_KEY ?? "";
assert.ok(serviceKey && serviceKey !== process.env.PR344_ANON_KEY);
const db = createClient(apiUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const iso = (secs) => new Date(secs * 1000).toISOString();
const keys = { [kid]: signingKey };

function jsonRequest(body, headers = {}) {
  return new Request(origin + "/api/presence/leases", {
    method: "POST",
    headers: {
      Origin: origin, "Content-Type": "application/json",
      "Sec-Fetch-Site": "same-origin", ...headers,
    },
    body: JSON.stringify(body),
  });
}
async function mint() {
  // Only fixture setup, not another S1 test.
  const response = await postIsolatedIssue(jsonRequest({ op: "issue", consent: true }), {
    env: flags, allowedOrigin: origin, kid, keyHex: signingKey,
    nowSeconds: () => epoch, reserveIssue: async () => "ok",
  });
  assert.equal(response.status, 201, "S1 signed issue fixture must exist");
  const { credential } = await response.json();
  return credential;
}
function verified(credential, at = epoch + 1) {
  const x = verifySignedCredential(credential, {
    keys, hashKeyHex: hashKey, nowSeconds: () => at,
  });
  assert.equal(x.status, 204);
  return x;
}
async function row(credential) {
  const { tabHash } = verified(credential);
  const result = await db.from("pr344_signed_s3_leases")
    .select("tab_hash,state,issued_at,hard_expires_at,expires_at,purge_after,last_beat_at")
    .eq("tab_hash", tabHash).maybeSingle();
  assert.ifError(result.error);
  return result.data;
}
async function count(at) {
  const result = await db.from("pr344_signed_s3_leases")
    .select("tab_hash", { count: "exact", head: true })
    .eq("state", "active").gt("expires_at", iso(at)).gt("hard_expires_at", iso(at));
  assert.ifError(result.error);
  return result.count;
}
function services(at, inject = {}) {
  return {
    env: flags, allowedOrigin: origin, keys, hashKeyHex: hashKey,
    nowSeconds: () => at,
    async applyVerified(op, verifiedCredential, actualAt) {
      const result = await db.rpc("pr344_signed_s3_apply", {
        _op: op,
        _tab_hash: verifiedCredential.tabHash,
        _issued_at: iso(verifiedCredential.issuedAt),
        _hard_expires_at: iso(verifiedCredential.hardExpiresAt),
        _at: iso(actualAt),
      });
      if (result.error) throw Error("disposable SQL transition unavailable");
      return result.data;
    },
    ...inject,
  };
}
async function operation(op, credential, at, extra = {}) {
  const payload = op === "leave" ? { op, credential } : { op, credential, consent: true };
  const res = await postIsolatedSignedTransition(jsonRequest(payload), services(at, extra));
  assert.equal(await res.text(), "", "private transition must expose status only");
  return res.status;
}

test("S3a: signed leave-before-start persists tombstone; late start/beat cannot revive", async () => {
  const cred = await mint();
  assert.equal(await operation("leave", cred, epoch + 2), 204);
  assert.equal(await operation("start", cred, epoch + 3), 410);
  assert.equal(await operation("beat", cred, epoch + 4), 410);
  const state = await row(cred);
  assert.equal(state?.state, "revoked");
  assert.equal(Date.parse(state.purge_after), (epoch + 1020) * 1000);
  assert.equal(await count(epoch + 5), 0);
  const fresh = await mint();
  assert.notEqual(verified(fresh).tabHash, verified(cred).tabHash);
  assert.equal(await operation("start", fresh, epoch + 5), 204);
  assert.equal(await count(epoch + 6), 1);
});

test("S3b: signed start is idempotent, beat is limited, leave is monotonic", async () => {
  const cred = await mint();
  assert.equal(await operation("start", cred, epoch + 1), 204);
  assert.equal(await operation("start", cred, epoch + 2), 204);
  assert.equal(await count(epoch + 3) >= 1, true);
  assert.equal(await operation("beat", cred, epoch + 10), 429);
  assert.equal(await operation("beat", cred, epoch + 26), 204);
  assert.equal(await operation("leave", cred, epoch + 27), 204);
  assert.equal(await operation("start", cred, epoch + 28), 410);
  assert.equal(await operation("beat", cred, epoch + 29), 410);
  assert.equal((await row(cred))?.state, "revoked");
});

test("S3c: concurrent beat and leave share SQL serialization; leave always wins", async () => {
  const cred = await mint();
  assert.equal(await operation("start", cred, epoch + 1), 204);
  const [leave, beat] = await Promise.all([
    operation("leave", cred, epoch + 26),
    operation("beat", cred, epoch + 26),
  ]);
  assert.equal(leave, 204);
  assert.ok([204, 410].includes(beat), "beat may win before leave, never after it");
  assert.equal((await row(cred))?.state, "revoked");
  assert.equal(await operation("start", cred, epoch + 27), 410);
  assert.equal(await operation("beat", cred, epoch + 42), 410);
});

test("S3d: late heartbeat is capped at absolute exp; expired credential bypasses storage", async () => {
  const cred = await mint();
  assert.equal(await operation("start", cred, epoch + 820), 204);
  assert.equal(await operation("beat", cred, epoch + 849), 204);
  assert.equal(Date.parse((await row(cred))?.expires_at), (epoch + 900) * 1000);
  assert.equal(await operation("beat", cred, epoch + 899), 204);
  assert.equal(Date.parse((await row(cred))?.expires_at), (epoch + 900) * 1000);

  let calls = 0;
  const noop = { applyVerified: async () => { calls++; return "ok"; } };
  for (const op of ["start", "beat", "leave"]) {
    assert.equal(await operation(op, cred, epoch + 900, noop), 410);
  }
  assert.equal(calls, 0, "HMAC hard-expiry must deny all SQL access");
});

test("S3e: transition path rejects legacy/forged credentials before RPC", async () => {
  const cred = await mint();
  const changed = cred.slice(0, -2) + (cred.at(-2) === "A" ? "B" : "A") + cred.at(-1);
  let calls = 0;
  const noSql = { applyVerified: async () => { calls++; return "ok"; } };
  assert.equal(await operation("start", "f".repeat(32), epoch + 1, noSql), 400);
  assert.equal(await operation("beat", changed, epoch + 1, noSql), 400);
  assert.equal(calls, 0);
  assert.equal((await count(epoch + 1)) >= 0, true);
});
