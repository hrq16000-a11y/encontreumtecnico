/**
 * PR #344: signed start/beat/leave CONTRACT ONLY, for disposable QA.
 * Not reachable from TanStack production routes; no official Supabase imports.
 * Reuses already approved S1/S2 verifier; S3 tests only affected transitions.
 */
import {
  isolatedIssueGate,
  verifySignedCredential,
} from "./pr344-signed-issue-only.mjs";

const statusOnly = (status) => new Response(null, { status, headers: {
  "Cache-Control": "no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
}});
const TYPES = new Set(["start", "beat", "leave"]);

async function exactBody(request) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^[0-9]+$/.test(declared) || Number(declared) > 512)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 512) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(Buffer.from(chunk.value));
    }
    if (!bytes) return null;
    const json = JSON.parse(new TextDecoder("utf-8", { fatal:true })
      .decode(Buffer.concat(chunks, bytes)));
    if (json === null || typeof json !== "object" || Array.isArray(json)) return null;
    if (!TYPES.has(json.op) || typeof json.credential !== "string") return null;
    const expected = json.op === "leave" ? "credential,op" : "consent,credential,op";
    if (Object.keys(json).sort().join(",") !== expected ||
      (json.op !== "leave" && json.consent !== true)) return null;
    return json;
  } catch { return null; }
}

/**
 * Dependencies from isolated test runner only:
 *  - nowSeconds clock, keys and hashKeyHex: private server-only synthetic secrets
 *  - applyVerified(): RPC with persisted tombstone/atomic transitions
 *
 * Crucial: no call to applyVerified before HMAC and exp verification.
 */
export async function postIsolatedSignedTransition(request, options) {
  if (!isolatedIssueGate(options?.env ?? process.env)) return statusOnly(503);
  if (request.method !== "POST") return statusOnly(405);
  if (!options || !/^http:\/\/127\.0\.0\.1:\d+$/.test(options.allowedOrigin ?? "") ||
    request.headers.get("origin") !== options.allowedOrigin ||
    new URL(request.url).origin !== options.allowedOrigin ||
    (request.headers.has("sec-fetch-site") &&
      request.headers.get("sec-fetch-site") !== "same-origin")) return statusOnly(403);
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
    request.headers.get("content-type")?.trim() ?? "")) return statusOnly(400);
  const payload = await exactBody(request);
  if (!payload) return statusOnly(400);
  if (typeof options.applyVerified !== "function" ||
      typeof options.nowSeconds !== "function") return statusOnly(503);

  try {
    const now = options.nowSeconds();
    const verified = verifySignedCredential(payload.credential, {
      keys: options.keys,
      hashKeyHex: options.hashKeyHex,
      nowSeconds: () => now,
    });
    if (verified.status !== 204) return statusOnly(verified.status);
    const result = await options.applyVerified(payload.op, verified, now);
    if (result === "ok") return statusOnly(204);
    if (result === "rate") return statusOnly(429);
    if (result === "gone") return statusOnly(410);
  } catch { /* Neither tokens nor storage diagnostics are exposed/logged. */ }
  return statusOnly(503);
}
