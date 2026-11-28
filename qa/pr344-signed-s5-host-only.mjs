/**
 * PR #344 S5 QA ONLY. Two independently instantiated "server" adapters share
 * one disposable Postgres budget RPC. No src imports, official backend or deploy.
 * trustedIngressTag is injected by the runner, NEVER from Request headers.
 * This does NOT establish a real Vercel/edge trusted-network identity.
 */
import { createHmac } from "node:crypto";
import { isolatedIssueGate, postIsolatedIssue } from "./pr344-signed-issue-only.mjs";
import { postIsolatedSignedTransition } from "./pr344-signed-transitions-only.mjs";

const reject = (status) => new Response(null, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
function isHexSecret(value) { return typeof value === "string" && /^[0-9a-f]{64}$/.test(value); }
function bucketHash(secret, operation, trustedIngressTag, atSeconds) {
  const minute = Math.floor(atSeconds / 60);
  return createHmac("sha256", Buffer.from(secret, "hex"))
    .update("EUT-PRESENCE-RATE/p1|" + operation + "|" + trustedIngressTag + "|" + minute, "utf8")
    .digest("hex");
}

/** Synthetic host with server-only, injected trusted edge context. */
export function createS5SyntheticHost({
  db, env, trustedIngressTag, allowedOrigin, kid,
  signingKeyHex, hashKeyHex, rateKeyHex, nowSeconds,
}) {
  const ready = isolatedIssueGate(env) &&
    env?.PR344_S5_SIMULATED === "enabled" &&
    /^http:\/\/127\.0\.0\.1:\d+$/.test(allowedOrigin ?? "") &&
    typeof nowSeconds === "function" &&
    typeof db?.rpc === "function" &&
    /^[a-z0-9._:-]{1,96}$/.test(trustedIngressTag ?? "") &&
    isHexSecret(signingKeyHex) && isHexSecret(hashKeyHex) &&
    isHexSecret(rateKeyHex) && /^[A-Za-z0-9_-]{1,16}$/.test(kid ?? "");

  // Ignore all request-supplied IP / forwarding headers; the harness sets
  // trustedIngressTag at host creation, not request time.
  async function applySharedQuota(op, tab, at) {
    if (!ready) return "unavailable";
    const args = {
      _op: op,
      _bucket_hash: bucketHash(rateKeyHex, op, trustedIngressTag, at),
      _tab_hash: tab?.tabHash ?? null,
      _issued_at: tab ? new Date(tab.issuedAt * 1000).toISOString() : null,
      _hard_expires_at: tab ? new Date(tab.hardExpiresAt * 1000).toISOString() : null,
      _at: new Date(at * 1000).toISOString(),
    };
    const { data, error } = await db.rpc("pr344_signed_s5_apply", args);
    if (error || !["ok","rate","gone"].includes(data)) throw Error("isolated budget unavailable");
    return data;
  }

  return Object.freeze({
    issue(request) {
      if (!ready) return Promise.resolve(reject(503));
      return postIsolatedIssue(request, {
        env, allowedOrigin, kid, keyHex: signingKeyHex, nowSeconds,
        reserveIssue: async () => applySharedQuota("issue", null, nowSeconds()),
      });
    },
    start(request) {
      if (!ready) return Promise.resolve(reject(503));
      return postIsolatedSignedTransition(request, {
        env, allowedOrigin, keys: { [kid]: signingKeyHex },
        hashKeyHex, nowSeconds,
        applyVerified: async (op, verified, at) => {
          if (op !== "start") return "unavailable"; // S3 handles beat/leave.
          return applySharedQuota("start", verified, at);
        },
      });
    },
  });
}
