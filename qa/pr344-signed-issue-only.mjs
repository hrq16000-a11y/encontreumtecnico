/**
 * PR #344 — ISOLATED ONLY: signed 'issue' capability and verifier for S1/S2.
 * Never imported by src/, never connected to official Supabase, no deployment.
 * No start/beat/leave handler or production adapter is implemented here.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ISSUE_TTL_SECONDS = 900;
const MAX_BODY_BYTES = 512;
const BASE = "EUT-PRESENCE-LEASE/p1|";
const TAB_BASE = "EUT-PRESENCE-TAB/p1|";
const privateHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const fail = (status) => new Response(null, { status, headers: privateHeaders });

export function isolatedIssueGate(env = process.env) {
  return env.PR344_LOCAL_ONLY === "yes" &&
    env.PR344_ISSUE_TEST_ONLY === "enabled" &&
    env.SUPABASE_ACCESS_TOKEN === "" &&
    env.VITE_EUT_HTTP_PRESENCE_INGEST === "disabled" &&
    env.VITE_EUT_HTTP_PRESENCE_ADMIN_READ === "disabled" &&
    env.VITE_EUT_PRIVATE_REALTIME_PRESENCE === "disabled";
}

function canonical(bytes, text, expectedSize) {
  return bytes.length === expectedSize && bytes.toString("base64url") === text;
}

function signingBytes(keyHex) {
  if (typeof keyHex !== "string" || !/^[0-9a-f]{64}$/.test(keyHex)) return null;
  return Buffer.from(keyHex, "hex");
}

function mac(key, text) {
  return createHmac("sha256", key).update(text, "ascii").digest();
}

function splitCredential(credential) {
  if (typeof credential !== "string" || credential.length > 128) return null;
  const match = /^p1\.([A-Za-z0-9_-]{1,16})\.([A-Za-z0-9_-]{22})\.([1-9][0-9]{9})\.([1-9][0-9]{9})\.([A-Za-z0-9_-]{43})$/.exec(credential);
  if (!match) return null;
  const [, kid, nonce, iat, exp, tag] = match;
  const nonceBytes = Buffer.from(nonce, "base64url");
  const tagBytes = Buffer.from(tag, "base64url");
  if (!canonical(nonceBytes, nonce, 16) || !canonical(tagBytes, tag, 32)) return null;
  const issuedAt = Number(iat);
  const hardExpiresAt = Number(exp);
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(hardExpiresAt) ||
    hardExpiresAt - issuedAt !== ISSUE_TTL_SECONDS) return null;
  return { kid, nonce, iat, exp, tag, tagBytes, issuedAt, hardExpiresAt };
}

/**
 * Called strictly BEFORE any storage access. A 410 after purging a tombstone
 * proves replay rejection does not depend on that record surviving.
 */
export function verifySignedCredential(credential, options) {
  const parsed = splitCredential(credential);
  if (!parsed) return { status: 400 };
  const keyHex = options?.keys?.[parsed.kid];
  if (!keyHex) return { status: 400 }; // unknown kid
  const key = signingBytes(keyHex);
  const hashKey = signingBytes(options?.hashKeyHex);
  if (!key || !hashKey) return { status: 503 }; // missing/invalid server secrets
  const signedPart = "p1." + parsed.kid + "." + parsed.nonce + "." + parsed.iat + "." + parsed.exp;
  const expected = mac(key, BASE + signedPart);
  if (expected.length !== parsed.tagBytes.length ||
      !timingSafeEqual(expected, parsed.tagBytes)) return { status: 400 };

  const now = options?.nowSeconds?.();
  if (!Number.isSafeInteger(now)) return { status: 503 };
  if (parsed.issuedAt > now + 10) return { status: 400 };
  if (now >= parsed.hardExpiresAt) return { status: 410 };
  return {
    status: 204,
    nonce: parsed.nonce,
    issuedAt: parsed.issuedAt,
    hardExpiresAt: parsed.hardExpiresAt,
    tabHash: mac(hashKey, TAB_BASE + parsed.nonce).toString("hex"),
  };
}

/** Pure S2 lease-deadline helper; DOES NOT implement beat/start or mutate a DB. */
export function syntheticLeaseDeadline(verification, nowSeconds) {
  if (verification?.status !== 204 || !Number.isSafeInteger(nowSeconds) ||
    nowSeconds >= verification.hardExpiresAt) return null;
  return Math.min(nowSeconds + 75, verification.hardExpiresAt);
}

async function smallJson(request) {
  const length = request.headers.get("content-length");
  if (length && (!/^[0-9]+$/.test(length) || Number(length) > MAX_BODY_BYTES)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const parts = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      parts.push(result.value);
    }
    if (!size) return null;
    const joined = Buffer.concat(parts.map(part => Buffer.from(part)), size);
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(joined));
  } catch { return null; }
}

/** Test-only HTTP contract. A required quota callback fails closed. */
export async function postIsolatedIssue(request, options) {
  if (!isolatedIssueGate(options?.env ?? process.env)) return fail(503);
  if (request.method !== "POST") return fail(405);
  if (!options || !/^http:\/\/127\.0\.0\.1:\d+$/.test(options.allowedOrigin ?? "") ||
    request.headers.get("origin") !== options.allowedOrigin ||
    new URL(request.url).origin !== options.allowedOrigin ||
    (request.headers.has("sec-fetch-site") &&
      request.headers.get("sec-fetch-site") !== "same-origin")) return fail(403);
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
    request.headers.get("content-type")?.trim() ?? "")) return fail(400);

  const body = await smallJson(request);
  if (!body || Array.isArray(body) || typeof body !== "object" ||
    Object.keys(body).sort().join(",") !== "consent,op" ||
    body.op !== "issue" || body.consent !== true) return fail(400);

  const key = signingBytes(options.keyHex);
  if (!key || !/^[A-Za-z0-9_-]{1,16}$/.test(options.kid ?? "") ||
    typeof options.reserveIssue !== "function") return fail(503);

  try {
    // The injected limiter is synthetic in this micro-round; S5 will test
    // multi-instance, trustworthy ingress and atomic quota separately.
    const allowed = await options.reserveIssue();
    if (allowed === "rate") return fail(429);
    if (allowed !== "ok") return fail(503);
    const now = options.nowSeconds?.();
    if (!Number.isSafeInteger(now) ||
      String(now).length !== 10 ||
      String(now + ISSUE_TTL_SECONDS).length !== 10) return fail(503);
    const nonce = randomBytes(16).toString("base64url");
    const signedPart = "p1." + options.kid + "." + nonce + "." + now + "." + (now + ISSUE_TTL_SECONDS);
    const credential = signedPart + "." + mac(key, BASE + signedPart).toString("base64url");
    if (credential.length > 128) return fail(503);
    return new Response(JSON.stringify({
      credential,
      hardExpiresAt: new Date((now + ISSUE_TTL_SECONDS) * 1000).toISOString(),
    }), {
      status: 201,
      headers: { ...privateHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch { return fail(503); }
}
