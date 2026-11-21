import { describe, expect, it, vi } from "vitest";
import { getAdminPresenceCount, postPresenceLease, type PresenceHttpServices } from "./pr344-http-presence-handlers.server";
import { loadPr344IsolatedServices } from "./pr344-http-presence-local.server";

const ORIGIN = "http://127.0.0.1:4173";
const TOKEN = "a".repeat(32);
const JWT = "synthetic.jwt.token";
const CLOCK = new Date("2026-11-20T22:00:00.000Z");

const lease = (op: "start" | "beat" | "leave") =>
  op === "leave" ? { op, tabToken: TOKEN } : { op, tabToken: TOKEN, consent: true };
const services = (changes: Partial<PresenceHttpServices> = {}): PresenceHttpServices => ({
  allowedOrigin: ORIGIN, now: () => CLOCK,
  applyLease: vi.fn(async () => "ok" as const),
  verifyCurrentAdmin: vi.fn(async () => "admin" as const),
  countActive: vi.fn(async () => 3),
  ...changes,
});
function post(data: unknown, extraHeaders: Record<string, string> = {}, url = ORIGIN) {
  return new Request(url + "/api/presence/leases", {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin", ...extraHeaders },
    body: typeof data === "string" ? data : JSON.stringify(data),
  });
}
function get(token?: string) {
  return new Request(ORIGIN + "/api/admin/presence/count", {
    headers: token ? { Authorization: token } : {},
  });
}

describe("PR344 new TanStack HTTP handlers (isolated contract only)", () => {
  it("does not load any backend without local-only flags", async () => {
    // Both server flags are explicitly disabled in the dedicated workflow.
    expect(await loadPr344IsolatedServices()).toBeNull();
    expect((await postPresenceLease(post(lease("start")), null)).status).toBe(503);
    expect((await getAdminPresenceCount(get("Bearer " + JWT), null)).status).toBe(503);
  });
  it("rejects wrong Origin, wrong request host and cross-site fetch before storage", async () => {
    const d = services();
    expect((await postPresenceLease(post(lease("start"), { Origin: "https://evil.invalid" }), d)).status).toBe(403);
    expect((await postPresenceLease(post(lease("start"), {}, "http://127.0.0.1:5000"), d)).status).toBe(403);
    expect((await postPresenceLease(post(lease("start"), { "Sec-Fetch-Site": "cross-site" }), d)).status).toBe(403);
    expect(d.applyLease).not.toHaveBeenCalled();
  });
  it("accepts exact start, beat, leave and exposes no write response body", async () => {
    const d = services();
    for (const op of ["start", "beat", "leave"] as const) {
      const res = await postPresenceLease(post(lease(op)), d);
      expect(res.status).toBe(204);
      expect(await res.text()).toBe("");
      expect(res.headers.get("cache-control")).toContain("no-store");
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    }
    expect(d.applyLease).toHaveBeenCalledTimes(3);
  });
  it("rejects extra fields, absent consent, short token and leave with consent", async () => {
    const d = services();
    for (const invalid of [
      { ...lease("start"), email: "private@example.invalid" },
      { ...lease("start"), consent: false },
      { ...lease("start"), tabToken: "short" },
      { ...lease("start"), tabToken: "A".repeat(32) },
      { ...lease("leave"), consent: true },
      { ...lease("start"), op: "other" },
      [lease("start")],
    ]) expect((await postPresenceLease(post(invalid), d)).status).toBe(400);
    expect(d.applyLease).not.toHaveBeenCalled();
  });
  it("rejects oversized streamed JSON, invalid JSON and wrong Content-Type", async () => {
    const d = services();
    expect((await postPresenceLease(post('{' + ' '.repeat(520)), d)).status).toBe(400);
    expect((await postPresenceLease(post('{bad'), d)).status).toBe(400);
    expect((await postPresenceLease(post(lease("start"), { "Content-Type": "text/plain" }), d)).status).toBe(400);
    expect(d.applyLease).not.toHaveBeenCalled();
  });
  it("maps shared SQL transitions and failure to only status codes", async () => {
    for (const [result, status] of [["rate", 429], ["gone", 410]] as const) {
      expect((await postPresenceLease(post(lease("start")), services({
        applyLease: async () => result,
      }))).status).toBe(status);
    }
    const response = await postPresenceLease(post(lease("start")), services({
      applyLease: async () => { throw new Error("private backend diagnostic"); },
    }));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });
  it("returns 401 to no/invalid JWT without querying admin roles or leases", async () => {
    const d = services();
    expect((await getAdminPresenceCount(get(), d)).status).toBe(401);
    expect((await getAdminPresenceCount(get("Bearer malformed"), d)).status).toBe(401);
    expect(d.verifyCurrentAdmin).not.toHaveBeenCalled();
    expect(d.countActive).not.toHaveBeenCalled();
  });
  it("returns 401/403 for verified non-admins and never queries aggregate", async () => {
    for (const [decision, status] of [["unauthorized", 401], ["forbidden", 403]] as const) {
      const d = services({ verifyCurrentAdmin: async () => decision });
      const response = await getAdminPresenceCount(get("Bearer " + JWT), d);
      expect(response.status).toBe(status);
      expect(await response.text()).toBe("");
      expect(d.countActive).not.toHaveBeenCalled();
    }
  });
  it("returns only count and checkedAt for current admin", async () => {
    const res = await getAdminPresenceCount(get("Bearer " + JWT), services());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ activeConsentedTabs: 3, checkedAt: CLOCK.toISOString() });
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
  it("never invents zero when admin check or storage fails, nor returns invalid counts", async () => {
    for (const count of [-1, NaN, Infinity, 2.5]) {
      expect((await getAdminPresenceCount(get("Bearer " + JWT), services({
        countActive: async () => count,
      }))).status).toBe(503);
    }
    expect((await getAdminPresenceCount(get("Bearer " + JWT), services({
      verifyCurrentAdmin: async () => { throw Error("role query unavailable"); },
    }))).status).toBe(503);
    expect((await getAdminPresenceCount(get("Bearer " + JWT), services({
      countActive: async () => { throw Error("count unavailable"); },
    }))).status).toBe(503);
  });
});
