import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

/** Service-only access ingestion; disabled unless the operator explicitly enables and
 * verifies trusted Vercel proxy headers + private server secrets. No request payload, no
 * client-submitted IP/path, no IP returned to the browser, no user tracking fingerprint.
 * This is a client-triggered app-use record, not a comprehensive HTTP access log.
 */
export const recordMinimalApplicationAccess = createServerFn({ method: "POST" })
  .handler(async (): Promise<void> => {
    if (process.env["EUT_VISITOR_ACCESS_ENABLED"] !== "true") return;
    const serviceKey = process.env["EUT_SUPABASE_SERVICE_ROLE_KEY"];
    const projectUrl = process.env["EUT_SUPABASE_PROJECT_URL"];
    if (!serviceKey || !projectUrl) return;
    const raw = getRequestHeader("x-vercel-forwarded-for") ?? "";
    const ip = raw.split(",")[0]?.trim() ?? "";
    if (!ip || ip.length > 45 || !/^[0-9a-fA-F:.]+$/.test(ip)) return;
    const db = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await db.rpc("eut_visitor_access_ingest", { _origin_ip: ip });
  });

/** Only verified server operations may send a security result; no client-exposed endpoint. */
export async function recordServerSecurityOutcome(
  kind: "auth_failure" | "request_rejected" | "contact_limit",
  outcome: "blocked" | "rejected",
): Promise<void> {
  if (process.env["EUT_VISITOR_SECURITY_ENABLED"] !== "true") return;
  const serviceKey = process.env["EUT_SUPABASE_SERVICE_ROLE_KEY"];
  const projectUrl = process.env["EUT_SUPABASE_PROJECT_URL"];
  if (!serviceKey || !projectUrl) return;
  const db = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await db.rpc("eut_visitor_security_ingest", { _kind: kind, _outcome: outcome });
}
