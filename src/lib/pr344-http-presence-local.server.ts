/** PR #344: test-only Supabase bridge.
 * Both server flags OFF by default. Reject every non-loopback backend, including
 * the official EUT project. This file is NOT the future production adapter.
 */
import { createClient } from "@supabase/supabase-js";
import type {
  PresenceHttpServices, LeaseOperation, LeaseResult, AdminDecision,
} from "./pr344-http-presence-handlers.server";

const loopback = /^http:\/\/127\.0\.0\.1:\d+$/;
export async function loadPr344IsolatedServices(): Promise<PresenceHttpServices | null> {
  const env = process.env;
  const url = env["PR344_API_URL"] ?? "";
  const allowedOrigin = env["PR344_HTTP_ALLOWED_ORIGIN"] ?? "";
  const anonKey = env["PR344_ANON_KEY"] ?? "";
  const serviceKey = env["PR344_SERVICE_ROLE_KEY"] ?? "";
  const pepper = env["PR344_TEST_PEPPER"] ?? "";
  if (env["PR344_LOCAL_ONLY"] !== "yes" ||
    env["PR344_HTTP_INGEST_ENABLED"] !== "enabled" ||
    env["PR344_HTTP_ADMIN_READ_ENABLED"] !== "enabled" ||
    !loopback.test(url) || !loopback.test(allowedOrigin) ||
    !anonKey || !serviceKey || anonKey === serviceKey ||
    !/^[0-9a-f]{64}$/.test(pepper) ||
    Boolean(env["SUPABASE_ACCESS_TOKEN"])) return null;

  const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
  const service = createClient(url, serviceKey, { auth });
  const publicAuth = createClient(url, anonKey, { auth });
  const secret = Uint8Array.from(pepper.match(/../g)!, (hex) => parseInt(hex, 16));
  const key = await crypto.subtle.importKey(
    "raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  async function digest(value: string) {
    const bytes = new Uint8Array(await crypto.subtle.sign(
      "HMAC", key, new TextEncoder().encode(value),
    ));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return {
    allowedOrigin,
    now: () => new Date(),
    async applyLease(op: LeaseOperation, token: string, request: Request): Promise<LeaseResult> {
      // Trusted network identification is NOT implemented for real edge traffic.
      // This synthetic header exists only inside the disposable loopback test.
      const network = request.headers.get("x-pr344-synthetic-network") ?? "";
      if (!/^[a-z0-9:._-]{1,80}$/i.test(network)) throw Error("no test network context");
      const current = new Date();
      const { data, error } = await service.rpc("pr344_http_synthetic_apply", {
        _op: op,
        _tab_hash: await digest("tab:" + token),
        _bucket_hash: op === "start"
          ? await digest("bucket:" + network + ":" + Math.floor(current.getTime() / 60000))
          : null,
        _at: current.toISOString(),
      });
      if (error || (data !== "ok" && data !== "rate" && data !== "gone")) {
        throw Error("isolated lease failure");
      }
      return data;
    },
    async verifyCurrentAdmin(jwt: string): Promise<AdminDecision> {
      const { data, error } = await publicAuth.auth.getUser(jwt);
      if (error || !data.user?.id) return "unauthorized";
      // Current database row, never stale JWT metadata or client-side flags.
      const role = await service.from("pr344_http_synthetic_roles")
        .select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
      if (role.error) throw Error("isolated role lookup failure");
      return role.data ? "admin" : "forbidden";
    },
    async countActive(): Promise<number> {
      const { count, error } = await service.from("pr344_http_synthetic_leases")
        .select("tab_hash", { count: "exact", head: true })
        .eq("state", "active").gt("expires_at", new Date().toISOString());
      if (error || count === null) throw Error("isolated count failure");
      return count;
    },
  };
}
