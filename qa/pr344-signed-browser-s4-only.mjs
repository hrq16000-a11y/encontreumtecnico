/**
 * PR #344 S4: synthetic browser-lifecycle state machine ONLY.
 * Not imported from src/, not an implementation of the official consumer.
 * Inject issue/send/clock/document/window; no network, SQL or Supabase access.
 * S1-S3 are prior evidence; this module tests only consent/race orchestration.
 */
const forbidden = /^\/(?:admin|area-tecnico|area-cliente|entrar|acesso-contato|redefinir-senha|ajuda-acesso|reivindicar-cadastro|lp2\/(?:admin|admin-portal|entrar|meu-perfil|acompanhar|clientes|atividades|cliente))(?:\/|$)/;

export function createS4IsolatedPresence(options) {
  const { window, document, issue, send, nowMs, getConsent, flags } = options;
  if (!window || !document || typeof issue !== "function" ||
      typeof send !== "function" || typeof nowMs !== "function" ||
      typeof getConsent !== "function") throw new Error("S4 isolated dependencies required");

  let pathname = options.pathname ?? "/";
  let epoch = 0;
  let pending = false;
  let rotating = false;
  let stopped = false;
  let pageSuspended = false;
  let failed = false;
  let active = null;
  let beatInFlight = false;

  const enabled = flags?.PR344_LOCAL_ONLY === "yes" &&
    flags?.PR344_S4_SIMULATED === "enabled" &&
    flags?.VITE_EUT_HTTP_PRESENCE_INGEST === "disabled" &&
    flags?.VITE_EUT_HTTP_PRESENCE_ADMIN_READ === "disabled" &&
    flags?.VITE_EUT_PRIVATE_REALTIME_PRESENCE === "disabled";

  const permitted = () => {
    if (stopped || pageSuspended || !enabled || document.visibilityState !== "visible" ||
        forbidden.test(pathname)) return false;
    try {
      return JSON.parse(getConsent() || "null")?.presence === true;
    } catch { return false; }
  };

  function fireLeave(lease) {
    if (!lease) return;
    // Preserve a tombstone even when a previous start or beat is still in flight.
    // Failure/timeout is not permission to start another concurrent epoch.
    void Promise.resolve().then(() => send("leave", lease.credential, true))
      .catch(() => undefined);
  }

  function retire() {
    epoch++;
    const previous = active;
    active = null;
    pending = false;
    rotating = false;
    beatInFlight = false;
    fireLeave(previous);
  }

  function validIssue(response) {
    const expiry = Date.parse(response?.hardExpiresAt ?? "");
    return typeof response?.credential === "string" &&
      response.credential.startsWith("p1.") &&
      Number.isFinite(expiry) && expiry > nowMs();
  }

  async function begin() {
    if (!permitted() || failed || active || pending || rotating) return;
    const generation = ++epoch;
    pending = true;
    try {
      const reply = await issue();
      if (generation !== epoch || !permitted()) return; // stale issue discarded
      if (!validIssue(reply)) throw new Error("invalid isolated issue reply");
      const lease = { credential: reply.credential,
        hardExpiresAtMs: Date.parse(reply.hardExpiresAt), started: false };
      active = lease; // Retire may now send leave even if start is still in flight.
      const status = await send("start", lease.credential, false);
      if (generation !== epoch || !permitted() || active !== lease) return;
      if (status !== 204) throw new Error("start failed");
      lease.started = true;
    } catch {
      if (generation === epoch) { failed = true; retire(); }
    } finally {
      if (generation === epoch) pending = false;
    }
  }

  async function rotate() {
    if (!permitted() || failed || pending || rotating ||
        !active?.started) return;
    const previous = active;
    const generation = ++epoch;
    rotating = true;
    try {
      const reply = await issue();
      if (generation !== epoch || !permitted() || active !== previous) return;
      if (!validIssue(reply) || reply.credential === previous.credential) {
        throw new Error("invalid renewal");
      }
      // Never start new presence until old leave is CONFIRMED 204.
      const status = await send("leave", previous.credential, true);
      if (generation !== epoch || !permitted() || active !== previous) return;
      if (status !== 204) throw new Error("uncertain old leave");
      active = null;
      const lease = { credential: reply.credential,
        hardExpiresAtMs: Date.parse(reply.hardExpiresAt), started: false };
      active = lease;
      const started = await send("start", lease.credential, false);
      if (generation !== epoch || !permitted() || active !== lease) return;
      if (started !== 204) throw new Error("new start failed");
      lease.started = true;
    } catch {
      if (generation === epoch) { failed = true; retire(); }
    } finally {
      if (generation === epoch) rotating = false;
    }
  }

  async function tick() {
    if (!permitted()) { if (active || pending || rotating) retire(); return; }
    if (failed || pending || rotating) return;
    if (!active) { await begin(); return; }
    if (!active.started || beatInFlight) return;

    if (nowMs() >= active.hardExpiresAtMs) {
      retire();
      void begin(); // New epoch: expired credential is never reused.
      return;
    }
    if (nowMs() >= active.hardExpiresAtMs - 60_000) {
      await rotate();
      return;
    }

    const generation = epoch;
    const lease = active;
    beatInFlight = true;
    try {
      const status = await send("beat", lease.credential, false);
      if (generation !== epoch || active !== lease || !permitted()) return;
      // A non-204 is not a reason to create new presences immediately.
      if (status !== 204 && status !== 429) throw new Error("heartbeat failed");
    } catch {
      if (generation === epoch) { failed = true; retire(); }
    } finally { if (generation === epoch) beatInFlight = false; }
  }

  function sync() {
    if (!permitted()) {
      if (active || pending || rotating) retire();
      // On the next explicit consent/visibility episode a new issue is allowed.
      failed = false;
      return;
    }
    if (!active && !pending && !rotating && !failed) void begin();
  }

  function storage(event) {
    if (event.key === "eut-cookie-consent" || event.key === null) sync();
  }

  function hide() { pageSuspended = true; retire(); } // Freeze even if visibility remains visible.
  function restore() { pageSuspended = false; sync(); }
  window.addEventListener("eut-consent-changed", sync);
  window.addEventListener("storage", storage);
  window.addEventListener("pagehide", hide);
  window.addEventListener("pageshow", restore);
  document.addEventListener("visibilitychange", sync);
  sync();

  return {
    tick,
    setPathname(path) { pathname = path; sync(); },
    snapshot() { return { active: active?.credential ?? null,
      started: active?.started ?? false, pending, rotating, failed }; },
    dispose() {
      if (stopped) return;
      stopped = true;
      window.removeEventListener("eut-consent-changed", sync);
      window.removeEventListener("storage", storage);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", sync);
      retire();
    },
  };
}
