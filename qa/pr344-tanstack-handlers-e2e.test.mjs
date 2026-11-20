// Only actual TanStack Start HTTP routes; never import the route handlers directly.
// All accounts, tokens and storage originate from the disposable localhost stack.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const site = "http://127.0.0.1:4173";
const local = process.env.PR344_API_URL ?? "";
const outage = process.env.PR344_E2E_OUTAGE === "yes";
assert.equal(process.env.PR344_LOCAL_ONLY, "yes");
assert.equal(process.env.SUPABASE_ACCESS_TOKEN ?? "", "");
assert.match(local, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.PR344_HTTP_ALLOWED_ORIGIN, site);
const temp = process.env.RUNNER_TEMP;
assert.ok(temp);
const tokenFile = join(temp, "pr344-disposable-admin-jwt");
const anonKey = process.env.PR344_ANON_KEY ?? "";
const serviceKey = process.env.PR344_SERVICE_ROLE_KEY ?? "";
assert.ok(anonKey && serviceKey && anonKey !== serviceKey);
const service = createClient(local, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const anonymous = () => createClient(local, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const tab = () => randomBytes(16).toString("hex");
const network = "pr344-synthetic-network";
let adminJwt = "";
let techJwt = "";
let adminId = "";
let firstTab = "";
let secondTab = "";
async function lease(op, tabToken, extra = {}) {
  const body = op === "leave" ? { op, tabToken } : { op, tabToken, consent: true };
  return fetch(site + "/api/presence/leases", {
    method: "POST",
    cache: "no-store",
    headers: {
      Origin: site, "Content-Type": "application/json",
      "Sec-Fetch-Site": "same-origin", "x-pr344-synthetic-network": network,
      ...extra,
    },
    body: JSON.stringify(body),
  });
}
async function readCount(jwt = adminJwt) {
  const response = await fetch(site + "/api/admin/presence/count", {
    headers: jwt ? { Authorization: "Bearer " + jwt } : {},
    cache: "no-store",
  });
  return response;
}
async function adminCount() {
  const response = await readCount();
  assert.equal(response.status, 200, "admin count endpoint must be authorized");
  const data = await response.json();
  assert.deepEqual(Object.keys(data).sort(), ["activeConsentedTabs", "checkedAt"]);
  assert.ok(Number.isSafeInteger(data.activeConsentedTabs));
  assert.ok(Number.isFinite(Date.parse(data.checkedAt)));
  assert.match(response.headers.get("Cache-Control") ?? "", /no-store/);
  return data.activeConsentedTabs;
}
if (outage) {
  test("H5: real routes fail closed after disposable Supabase is stopped", async () => {
    adminJwt = readFileSync(tokenFile, "utf8").trim();
    assert.match(adminJwt, /^[^.\s]+\.[^.\s]+\.[^.\s]+$/);
    assert.equal((await lease("start", tab())).status, 503);
    const response = await readCount();
    assert.equal(response.status, 503, "storage/Auth outage must not be misreported as zero or 401");
    assert.equal(await response.text(), "");
    console.log("PASS H5: actual TanStack routes fail closed after local backend shutdown");
  });
} else {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);
    const password = "pr344-isolated-Test_2026!";
    async function synthetic(role) {
      const created = await service.auth.admin.createUser({
        email: "pr344-" + role + "-" + suffix + "@example.invalid",
        password, email_confirm: true,
      });
      assert.ifError(created.error);
      assert.ok(created.data.user?.id);
      return created.data.user;
    }
    const tech = await synthetic("technician");
    const admin = await synthetic("administrator");
    adminId = admin.id;
    const roles = await service.from("pr344_http_synthetic_roles").insert([
      { user_id: tech.id, role: "tecnico" },
      { user_id: admin.id, role: "admin" },
    ]);
    assert.ifError(roles.error);
    async function login(email) {
      const signed = await anonymous().auth.signInWithPassword({ email, password });
      assert.ifError(signed.error);
      assert.ok(signed.data.session?.access_token);
      return signed.data.session.access_token;
    }
    techJwt = await login(tech.email);
    adminJwt = await login(admin.email);
    assert.notEqual(adminJwt, techJwt);
    writeFileSync(tokenFile, adminJwt, { mode: 0o600 });
    console.log("ISOLATED: two synthetic Auth identities, actual TanStack server on loopback");
  });

  test("H1: actual POST rejects missing consent, extra data and cross-origin", async () => {
    assert.equal((await readCount()).status, 200);
    assert.equal(await adminCount(), 0);
    const denied = await lease("start", tab(), { Origin: "https://outside.invalid" });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
    const missingConsent = await fetch(site + "/api/presence/leases", {
      method: "POST", headers: {
        Origin: site, "Content-Type": "application/json",
        "x-pr344-synthetic-network": network,
      }, body: JSON.stringify({ op: "start", tabToken: tab(), consent: false }),
    });
    assert.equal(missingConsent.status, 400);
    const withIdentity = await fetch(site + "/api/presence/leases", {
      method: "POST", headers: {
        Origin: site, "Content-Type": "application/json",
        "x-pr344-synthetic-network": network,
      }, body: JSON.stringify({ op: "start", tabToken: tab(), consent: true, email: "blocked@example.invalid" }),
    });
    assert.equal(withIdentity.status, 400);
    assert.equal(await adminCount(), 0);
    console.log("PASS H1: real HTTP consent and origin validation");
  });

  test("H2: repeated start through route is idempotent, aggregate is unique", async () => {
    firstTab = tab(); secondTab = tab();
    for (let i = 0; i < 3; i++) {
      const response = await lease("start", firstTab);
      assert.equal(response.status, 204);
      assert.equal(await response.text(), "");
    }
    assert.equal(await adminCount(), 1);
    assert.equal((await lease("start", secondTab)).status, 204);
    assert.equal(await adminCount(), 2);
    console.log("PASS H2: start idempotence through deployed-in-runner route");
  });

  test("H3: only current synthetic administrator reads aggregate", async () => {
    assert.equal((await readCount("")).status, 401);
    assert.equal((await readCount("invalid.token.value")).status, 401);
    assert.equal((await readCount(techJwt)).status, 403);
    assert.equal(await adminCount(), 2);
    const revoked = await service.from("pr344_http_synthetic_roles")
      .delete().eq("user_id", adminId).eq("role", "admin");
    assert.ifError(revoked.error);
    assert.equal((await readCount()).status, 403);
    const restored = await service.from("pr344_http_synthetic_roles")
      .insert({ user_id: adminId, role: "admin" });
    assert.ifError(restored.error);
    assert.equal(await adminCount(), 2);
    console.log("PASS H3: persisted admin role checked on each real GET");
  });

  test("H4: actual leave revokes presence, replay cannot restart it", async () => {
    assert.equal((await lease("beat", firstTab)).status, 429);
    assert.equal((await lease("leave", firstTab)).status, 204);
    assert.equal((await lease("leave", secondTab)).status, 204);
    assert.equal(await adminCount(), 0);
    assert.equal((await lease("start", firstTab)).status, 410);
    assert.equal((await lease("beat", secondTab)).status, 410);
    console.log("PASS H4: lease revocation and replay denial through real routes");
  });
}
