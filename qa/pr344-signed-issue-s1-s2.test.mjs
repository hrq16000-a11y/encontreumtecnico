// PR #344 S1/S2 ONLY: synthetic, disposable; never connect an official project.
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  ISSUE_TTL_SECONDS,
  isolatedIssueGate,
  postIsolatedIssue,
  syntheticLeaseDeadline,
  verifySignedCredential,
} from "./pr344-signed-issue-only.mjs";

const origin = "http://127.0.0.1:4173";
const signKey = randomBytes(32).toString("hex");
const hashKey = randomBytes(32).toString("hex");
const kid = "local1";
const epoch = Math.floor(Date.now() / 1000);
const flags = {
  PR344_LOCAL_ONLY: "yes", PR344_ISSUE_TEST_ONLY: "enabled",
  SUPABASE_ACCESS_TOKEN: "",
  VITE_EUT_HTTP_PRESENCE_INGEST: "disabled",
  VITE_EUT_HTTP_PRESENCE_ADMIN_READ: "disabled",
  VITE_EUT_PRIVATE_REALTIME_PRESENCE: "disabled",
};
function config(nowSeconds = () => epoch, extra = {}) {
  return {
    env: flags, allowedOrigin: origin, kid, keyHex: signKey,
    nowSeconds, reserveIssue: async () => "ok", ...extra,
  };
}
function verify(credential, nowSeconds) {
  return verifySignedCredential(credential, {
    keys: { [kid]: signKey }, hashKeyHex: hashKey, nowSeconds: () => nowSeconds,
  });
}
function request(json, extraHeaders = {}, url = origin) {
  return new Request(url + "/api/presence/leases", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Origin: origin,
      "Sec-Fetch-Site": "same-origin", ...extraHeaders,
    },
    body: typeof json === "string" ? json : JSON.stringify(json),
  });
}
async function mint(at = epoch, extra = {}) {
  const response = await postIsolatedIssue(request({ op: "issue", consent: true }), config(() => at, extra));
  assert.equal(response.status, 201);
  const json = await response.json();
  assert.deepEqual(Object.keys(json).sort(), ["credential", "hardExpiresAt"]);
  return json;
}

test("S1: issue responds 201 with canonical 128-bit nonce, HMAC and absolute expiry", async () => {
  const issued = await mint();
  const value = issued.credential;
  assert.ok(value.length <= 128);
  assert.match(value, /^p1\.[A-Za-z0-9_-]{1,16}\.[A-Za-z0-9_-]{22}\.[0-9]{10}\.[0-9]{10}\.[A-Za-z0-9_-]{43}$/);
  const parts = value.split(".");
  assert.equal(parts.length, 6);
  const canonicalNonce = Buffer.from(parts[2], "base64url");
  assert.equal(canonicalNonce.length, 16);
  assert.equal(canonicalNonce.toString("base64url"), parts[2]);
  assert.equal(Number(parts[4]) - Number(parts[3]), ISSUE_TTL_SECONDS);
  const independentMac = createHmac("sha256", Buffer.from(signKey, "hex"))
    .update("EUT-PRESENCE-LEASE/p1|" + parts.slice(0, 5).join("."), "ascii")
    .digest("base64url");
  assert.ok(independentMac === parts[5], "HMAC domain/bytes must match independent calculation");
  assert.equal(issued.hardExpiresAt, new Date((epoch + 900) * 1000).toISOString());
  const verified = verify(value, epoch);
  assert.equal(verified.status, 204);
  assert.match(verified.tabHash, /^[0-9a-f]{64}$/);
  assert.equal(verified.hardExpiresAt, epoch + 900);
  const another = await mint();
  assert.notEqual(another.credential, value);
});

test("S1: no issue while flags off; consent, source, body and extra fields rejected before quota", async () => {
  let reserved = 0;
  const options = config(undefined, { reserveIssue: async () => { reserved++; return "ok"; } });
  assert.equal(isolatedIssueGate(flags), true);
  const disabled = { ...flags, PR344_ISSUE_TEST_ONLY: "disabled" };
  assert.equal(isolatedIssueGate(disabled), false);
  assert.equal((await postIsolatedIssue(request({ op: "issue", consent: true }),
    { ...options, env: disabled })).status, 503);
  const forbidden = { ...flags, VITE_EUT_HTTP_PRESENCE_INGEST: "enabled" };
  assert.equal((await postIsolatedIssue(request({ op: "issue", consent: true }),
    { ...options, env: forbidden })).status, 503);
  for (const json of [
    { op: "issue" },
    { op: "issue", consent: false },
    { op: "issue", consent: true, nonce: "chosen-by-browser" },
    { op: "issue", consent: true, email: "private@example.invalid" },
    { op: "beat", consent: true },
    JSON.stringify({ op: "issue", consent: true }) + " ".repeat(550),
  ]) {
    assert.equal((await postIsolatedIssue(request(json), options)).status, 400);
  }
  assert.equal((await postIsolatedIssue(
    request({ op: "issue", consent: true }, { Origin: "https://malicious.invalid" }), options)).status, 403);
  assert.equal((await postIsolatedIssue(
    request({ op: "issue", consent: true }, { "Sec-Fetch-Site": "cross-site" }), options)).status, 403);
  assert.equal(reserved, 0);
});

test("S1: tamper, unknown kid and legacy format are rejected before any storage access", async () => {
  const issued = await mint();
  const cred = issued.credential;
  const segments = cred.split(".");
  const forgedTag = segments.slice(0, 5).concat(
    segments[5].slice(0, -1) + (segments[5].at(-1) === "A" ? "B" : "A")).join(".");
  const forgedExp = segments.slice(0, 4).concat(String(Number(segments[4]) + 1), segments[5]).join(".");
  const bad = [
    "f".repeat(32),
    cred.replace(".local1.", ".unknown."),
    cred.replace(/^p1/, "p2"),
    forgedTag,
    forgedExp,
    cred + ".extra",
    cred.replaceAll(".", ""),
  ];
  let storageCalls = 0;
  for (const value of bad) {
    const result = verify(value, epoch);
    if (result.status === 204) storageCalls++;
    assert.equal(result.status, 400);
  }
  assert.equal(storageCalls, 0);
  assert.equal(verify(cred, epoch - 11).status, 400, "future iat beyond 10s");
  assert.equal(verifySignedCredential(cred, {
    keys: { [kid]: signKey }, hashKeyHex: "", nowSeconds: () => epoch,
  }).status, 503);
});

test("S1: quota and signing dependency failure return 429/503 without issuing credentials", async () => {
  const json = { op: "issue", consent: true };
  const rate = await postIsolatedIssue(request(json), config(undefined, {
    reserveIssue: async () => "rate",
  }));
  assert.equal(rate.status, 429);
  const missing = await postIsolatedIssue(request(json), config(undefined, {
    keyHex: "",
  }));
  assert.equal(missing.status, 503);
  const failed = await postIsolatedIssue(request(json), config(undefined, {
    reserveIssue: async () => { throw Error("synthetic unavailable"); },
  }));
  assert.equal(failed.status, 503);
  for (const res of [rate, missing, failed]) {
    assert.equal(await res.text(), "");
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
    assert.match(res.headers.get("Cache-Control"), /no-store/);
  }
});

test("S2: 900s expiry boundary and lease deadline never extend absolute exp", async () => {
  const issued = await mint();
  const before = verify(issued.credential, epoch + 899);
  assert.equal(before.status, 204);
  assert.equal(syntheticLeaseDeadline(before, epoch + 899), epoch + 900);
  const current = verify(issued.credential, epoch + 700);
  assert.equal(current.status, 204);
  assert.equal(syntheticLeaseDeadline(current, epoch + 700), epoch + 775);
  assert.equal(syntheticLeaseDeadline(current, epoch + 899), epoch + 900);
  assert.equal(syntheticLeaseDeadline(current, epoch + 900), null);
  assert.equal(verify(issued.credential, epoch + 900).status, 410);
  assert.equal(verify(issued.credential, epoch + 1800).status, 410);
});

test("S2: real disposable Postgres tombstone purge still rejects expired signed replay pre-storage", async () => {
  assert.equal(process.env.PR344_LOCAL_ONLY, "yes");
  assert.equal(process.env.SUPABASE_ACCESS_TOKEN, "");
  const apiUrl = process.env.PR344_API_URL ?? "";
  assert.match(apiUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
  const ephemeralKey = process.env.PR344_SERVICE_ROLE_KEY ?? "";
  assert.ok(ephemeralKey && ephemeralKey !== process.env.PR344_ANON_KEY);
  const client = createClient(apiUrl, ephemeralKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const nowActual = Math.floor(Date.now() / 1000);
  const historicalIssuedAt = nowActual - 1100; // exp is now-200; purge_after is now-80
  const issued = await mint(historicalIssuedAt);
  const before = verify(issued.credential, historicalIssuedAt + 1);
  assert.equal(before.status, 204);
  const tabHash = before.tabHash;
  const fromSec = (sec) => new Date(sec * 1000).toISOString();
  const record = {
    tab_hash: tabHash,
    expires_at: fromSec(historicalIssuedAt + 75),
    hard_expires_at: fromSec(historicalIssuedAt + 900),
    purge_after: fromSec(historicalIssuedAt + 1020),
  };
  const inserted = await client.from("pr344_signed_issue_s2_fixture").insert(record);
  assert.ifError(inserted.error);
  const deleted = await client.from("pr344_signed_issue_s2_fixture")
    .delete().lte("purge_after", new Date().toISOString()).eq("tab_hash", tabHash)
    .select("tab_hash");
  assert.ifError(deleted.error);
  assert.equal(deleted.data?.length, 1, "actual physical purge must delete the tombstone");
  const remaining = await client.from("pr344_signed_issue_s2_fixture")
    .select("tab_hash", { count: "exact", head: true }).eq("tab_hash", tabHash);
  assert.ifError(remaining.error);
  assert.equal(remaining.count, 0);

  let storageReadsOrWrites = 0;
  const replay = verify(issued.credential, Math.floor(Date.now() / 1000));
  if (replay.status === 204) storageReadsOrWrites++;
  assert.equal(replay.status, 410, "signed exp blocks replay even though tombstone was physically deleted");
  assert.equal(storageReadsOrWrites, 0, "expired credential must fail before any lease storage access");
});
