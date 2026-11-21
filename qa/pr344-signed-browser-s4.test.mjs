// PR #344 — S4 only: deterministic browser event and asynchronous race simulations.
// Reuses the approved S1 signer strictly as a fixture, not as repeated S1 assertions.
// No official consumers, handlers, SQL, browser network or Supabase are involved.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { postIsolatedIssue } from "./pr344-signed-issue-only.mjs";
import { createS4IsolatedPresence } from "./pr344-signed-browser-s4-only.mjs";

const ORIGIN = "http://127.0.0.1:4173";
const INITIAL_MS = Date.parse("2026-11-21T14:00:00.000Z");
const SIGN_KEY = randomBytes(32).toString("hex");
const ISSUE_FLAGS = Object.freeze({
  PR344_LOCAL_ONLY: "yes", PR344_ISSUE_TEST_ONLY: "enabled",
  SUPABASE_ACCESS_TOKEN: "",
  VITE_EUT_HTTP_PRESENCE_INGEST: "disabled",
  VITE_EUT_HTTP_PRESENCE_ADMIN_READ: "disabled",
  VITE_EUT_PRIVATE_REALTIME_PRESENCE: "disabled",
});
const S4_FLAGS = Object.freeze({ ...ISSUE_FLAGS, PR344_S4_SIMULATED: "enabled" });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function drain() {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
}
async function signedFixture(nowMs) {
  const request = new Request(ORIGIN + "/api/presence/leases", {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify({ op: "issue", consent: true }),
  });
  const reply = await postIsolatedIssue(request, {
    env: ISSUE_FLAGS, allowedOrigin: ORIGIN, keyHex: SIGN_KEY,
    kid: "s4local", reserveIssue: async () => "ok",
    nowSeconds: () => Math.floor(nowMs / 1000),
  });
  assert.equal(reply.status, 201, "existing S1 fixture should be usable");
  return reply.json();
}

function harness({ consent = true, route = "/", visibility = "visible", flags = S4_FLAGS } = {}) {
  const win = new EventTarget();
  const doc = new EventTarget();
  const env = {
    consent, route, visibility, now: INITIAL_MS,
    issues: 0, calls: [], live: new Set(),
  };
  Object.defineProperty(doc, "visibilityState", { get: () => env.visibility });
  let issueImpl = () => signedFixture(env.now);
  const defaultSend = async (op, credential) => {
    if (op === "start") env.live.add(credential);
    if (op === "leave") env.live.delete(credential);
    return 204;
  };
  let sendImpl = defaultSend;
  const ctl = createS4IsolatedPresence({
    window: win, document: doc, pathname: env.route,
    flags,
    nowMs: () => env.now,
    getConsent: () => JSON.stringify({ analytics: true, presence: env.consent }),
    issue: async () => { env.issues++; return issueImpl(); },
    send: (op, credential, keepalive) => {
      env.calls.push({ op, credential, keepalive });
      return sendImpl(op, credential, keepalive);
    },
  });
  function storageChange() {
    const e = new Event("storage");
    Object.defineProperty(e, "key", { value: "eut-cookie-consent" });
    win.dispatchEvent(e);
  }
  return {
    ...env,
    win, doc, ctl, defaultSend,
    snapshot: () => ctl.snapshot(),
    get issues() { return env.issues; },
    get calls() { return env.calls; },
    get live() { return env.live; },
    get now() { return env.now; },
    setTime(ms) { env.now = ms; },
    setIssue(fn) { issueImpl = fn; },
    setSend(fn) { sendImpl = fn; },
    changeConsent(allowed, fromOtherTab = false) {
      env.consent = allowed;
      if (fromOtherTab) storageChange();
      else win.dispatchEvent(new Event("eut-consent-changed"));
    },
    setRoute(pathname) { env.route = pathname; ctl.setPathname(pathname); },
    setVisibility(value) { env.visibility = value; doc.dispatchEvent(new Event("visibilitychange")); },
    event(name) { win.dispatchEvent(new Event(name)); },
    dispose() { ctl.dispose(); },
  };
}

test("S4a: flags OFF and analytics consent never issue; restricted routes cannot issue", async () => {
  const off = harness({ flags: { ...S4_FLAGS, PR344_S4_SIMULATED: "disabled" } });
  off.event("pageshow");
  off.changeConsent(true);
  await off.ctl.tick();
  assert.equal(off.issues, 0);
  assert.equal(off.calls.length, 0);
  off.dispose();

  const h = harness({ consent: false });
  h.changeConsent(false);
  assert.equal(h.issues, 0);
  h.setRoute("/admin/metricas");
  h.changeConsent(true);
  await drain();
  assert.equal(h.issues, 0);
  h.setRoute("/area-tecnico");
  assert.equal(h.issues, 0);
  h.setRoute("/");
  await drain();
  assert.equal(h.issues, 1);
  assert.equal(h.calls.filter(c => c.op === "start").length, 1);
  h.dispose();
});

test("S4b: delayed issue is discarded after consent revocation, including cross-tab storage", async () => {
  const h = harness({ consent: false });
  const late = deferred();
  h.setIssue(() => late.promise);
  h.changeConsent(true);
  assert.equal(h.issues, 1);
  assert.equal(h.snapshot().pending, true);
  h.changeConsent(false, true);
  assert.equal(h.snapshot().active, null);
  late.resolve(await signedFixture(INITIAL_MS));
  await drain();
  assert.equal(h.calls.length, 0);
  assert.equal(h.snapshot().active, null);
  h.setIssue(() => signedFixture(INITIAL_MS));
  h.changeConsent(true);
  await drain();
  assert.equal(h.issues, 2);
  assert.equal(h.calls.filter(c => c.op === "start").length, 1);
  h.dispose();
});

test("S4c: private navigation or hidden document invalidates in-flight issue and blocks heartbeat", async () => {
  const h = harness({ consent: false });
  const late = deferred();
  h.setIssue(() => late.promise);
  h.changeConsent(true);
  h.setRoute("/admin/metricas");
  h.setVisibility("hidden");
  late.resolve(await signedFixture(INITIAL_MS));
  await drain();
  assert.equal(h.calls.length, 0);
  await h.ctl.tick();
  assert.equal(h.issues, 1);
  h.setIssue(() => signedFixture(h.now));
  h.setVisibility("visible");
  await drain();
  assert.equal(h.issues, 1, "still private");
  h.setRoute("/tecnicos");
  await drain();
  assert.equal(h.issues, 2);
  assert.equal(h.calls.filter(c => c.op === "start").length, 1);
  h.setVisibility("hidden");
  await drain();
  assert.equal(h.calls.filter(c => c.op === "leave").length, 1);
  const beats = h.calls.filter(c => c.op === "beat").length;
  await h.ctl.tick();
  assert.equal(h.calls.filter(c => c.op === "beat").length, beats);
  h.setVisibility("visible");
  await drain();
  assert.equal(h.issues, 3);
  assert.equal(h.calls.filter(c => c.op === "start").length, 2);
  h.dispose();
});

test("S4d: BFCache pagehide suspends even when visibility stays visible; pageshow creates new epoch", async () => {
  const h = harness();
  await drain();
  const old = h.snapshot().active;
  assert.ok(old?.startsWith("p1."));
  assert.equal(h.snapshot().started, true);
  h.event("pagehide");
  await drain();
  assert.equal(h.snapshot().active, null);
  assert.equal(h.live.size, 0);
  await h.ctl.tick();
  assert.equal(h.issues, 1, "no new issue while page remains in BFCache");
  h.event("pageshow");
  await drain();
  assert.equal(h.issues, 2);
  assert.ok(h.snapshot().started);
  assert.notEqual(h.snapshot().active, old);
  assert.equal(h.live.size, 1);
  h.dispose();
});

test("S4e: late start response after pagehide cannot resurrect stale epoch", async () => {
  const h = harness();
  const delayedStart = deferred();
  h.setSend(async (op, credential, keepalive) => {
    if (op === "start" && h.calls.filter(c => c.op === "start").length === 1) return delayedStart.promise;
    return h.defaultSend(op, credential, keepalive);
  });
  await drain();
  const old = h.snapshot().active;
  assert.ok(old);
  assert.equal(h.snapshot().started, false);
  h.event("pagehide");
  await drain();
  assert.equal(h.snapshot().active, null);
  assert.ok(h.calls.some(c => c.op === "leave" && c.credential === old));
  delayedStart.resolve(204);
  await drain();
  assert.equal(h.snapshot().active, null, "stale success ignored");
  h.event("pageshow");
  await drain();
  assert.notEqual(h.snapshot().active, old);
  assert.equal(h.snapshot().started, true);
  h.dispose();
});

test("S4f: 14-minute rotation waits for confirmed old leave; never counts two active epochs", async () => {
  const h = harness();
  await drain();
  const old = h.snapshot().active;
  assert.equal(h.live.size, 1);
  const heldLeave = deferred();
  h.setSend(async (op, credential, keepalive) => {
    if (op === "leave" && credential === old) {
      const status = await heldLeave.promise;
      if (status === 204) h.live.delete(credential);
      return status;
    }
    return h.defaultSend(op, credential, keepalive);
  });
  h.setTime(INITIAL_MS + 840_000);
  const rotating = h.ctl.tick();
  await drain();
  assert.equal(h.snapshot().rotating, true);
  assert.equal(h.calls.filter(c => c.op === "start").length, 1);
  assert.equal(h.calls.filter(c => c.op === "leave").length, 1);
  assert.equal(h.live.size, 1);
  heldLeave.resolve(204);
  await rotating;
  await drain();
  assert.equal(h.live.size, 1);
  assert.notEqual(h.snapshot().active, old);
  assert.equal(h.snapshot().started, true);
  assert.equal(h.calls.filter(c => c.op === "start").length, 2);
  h.dispose();
});

test("S4g: failed old leave blocks new start; revocation during delayed rotation discards new issue", async () => {
  const first = harness();
  await drain();
  const old = first.snapshot().active;
  first.setTime(INITIAL_MS + 840_000);
  first.setSend(async (op, credential, keepalive) => {
    if (op === "leave" && credential === old) return 503;
    return first.defaultSend(op, credential, keepalive);
  });
  await first.ctl.tick();
  await drain();
  assert.equal(first.calls.filter(c => c.op === "start").length, 1);
  assert.equal(first.snapshot().active, null);
  assert.equal(first.snapshot().failed, true);
  await first.ctl.tick();
  assert.equal(first.calls.filter(c => c.op === "start").length, 1);
  first.dispose();

  const second = harness();
  await drain();
  const previous = second.snapshot().active;
  const late = deferred();
  second.setIssue(() => late.promise);
  second.setTime(INITIAL_MS + 840_000);
  const rotating = second.ctl.tick();
  await drain();
  second.changeConsent(false);
  await drain();
  assert.ok(second.calls.some(c => c.op === "leave" && c.credential === previous));
  late.resolve(await signedFixture(second.now));
  await rotating;
  await drain();
  assert.equal(second.calls.filter(c => c.op === "start").length, 1);
  assert.equal(second.snapshot().active, null);
  second.dispose();
});

test("S4h: rapid consent/page events do not issue multiple concurrent credentials", async () => {
  const h = harness({ consent: false });
  const late = deferred();
  h.setIssue(() => late.promise);
  h.changeConsent(true);
  for (let i = 0; i < 8; i++) {
    h.event("eut-consent-changed");
    h.event("pageshow");
  }
  assert.equal(h.issues, 1);
  late.resolve(await signedFixture(INITIAL_MS));
  await drain();
  assert.equal(h.calls.filter(c => c.op === "start").length, 1);
  assert.equal(h.live.size, 1);
  h.dispose();
});
