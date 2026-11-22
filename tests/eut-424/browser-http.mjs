// EUT #424 — local-only QA-A/QA-B, Node 22 + Chromium CDP (no new packages).
// This source is a prepared test, NOT permission to run it. No production access.
// All fixtures, sessions and contact values must be synthetic and ephemeral.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Hard stop before reading credentials, launching Chrome or making requests.
// Removing this requires a NEW, explicitly approved micro-round.
const EXECUTION_ENABLED = false;
assert.equal(EXECUTION_ENABLED, true, 'EUT424 QA BLOCKED: execution is not authorized');

const EXPECTED_PR = 424;
const EXPECTED_ROOT = 'bfe0b03292dd715373b3641ff6c20105e2147118';
const MIN_BROWSER_WIDTHS = [390, 1440];
const LIVE_HASHES = Object.freeze({
  phone: 'af0e1c0ae8a0d850ad6619b4b4242d79',
  eligible: '8e4e8f56ceb5bc3457164335722125f1',
});

function localhost(raw, allowedPorts) {
  assert(typeof raw === 'string' && raw.length > 0, 'Missing local URL');
  const url = new URL(raw);
  assert.equal(url.protocol, 'http:', 'HTTPS and non-HTTP URLs forbidden');
  assert(['localhost', '127.0.0.1'].includes(url.hostname), 'Remote host forbidden');
  assert(allowedPorts.includes(url.port), 'Unexpected local port');
  assert(!url.username && !url.password && !url.search && !url.hash,
    'URL must have no credentials, query or fragment');
  return url;
}

function safePath(value, label) {
  assert(typeof value === 'string' && value.length <= 96 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), 'Invalid synthetic ' + label);
  assert(!/^tecnico-[a-f0-9]{32}$/.test(value),
    'Admin special-profile route must not be used');
  return value;
}

function syntheticEmail(value) {
  assert(typeof value === 'string' && /^qa-[a-z0-9-]+@example\.test$/.test(value),
    'Only reserved synthetic email permitted');
  return value;
}

function uuid(value) {
  assert(typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
    'Invalid synthetic technician UUID');
  return value.toLowerCase();
}

function proofFile(file) {
  assert(typeof file === 'string' && file.startsWith('/'), 'Proof must be an absolute path');
  const proof = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(proof.pr, EXPECTED_PR);
  assert.equal(proof.source_sha, EXPECTED_ROOT);
  assert.equal(proof.environment, 'discardable-local');
  assert.equal(proof.active_function_hashes?.phone, LIVE_HASHES.phone);
  assert.equal(proof.active_function_hashes?.eligible, LIVE_HASHES.eligible);
  assert.equal(proof.active_bodies_verified, true);
  assert.equal(proof.local_schema_excludes_eut_visibility, true);
  assert.equal(proof.official_data_api_excludes_eut_visibility, true);
  assert.equal(proof.network_isolation?.verified, true);
  assert(['unshare-net', 'container-network-none'].includes(proof.network_isolation?.method));
  assert.equal(proof.official_project_secrets_loaded, false);
  // A self-declared proof file is NOT independent proof. Future orchestrator
  // must create and verify it from real preflight evidence in a sandbox.
}

const env = process.env;
assert.equal(env.EUT_424_LOCAL_QA_APPROVED, 'true', 'Missing separate QA authorization');
const app = localhost(env.APP_URL, ['3000', '4173']);
const api = localhost(env.API_URL, ['54321']);
localhost(env.DB_URL, ['54322']);
assert.equal(app.pathname, '/', 'APP_URL must be the local origin root');
assert.equal(api.pathname, '/', 'API_URL must be the local origin root');
proofFile(env.EUT_424_PROOF_FILE);
assert.equal(env.EUT_424_EGRESS_BLOCKED, 'true', 'Missing network-isolation gate');

const fixture = Object.freeze({
  slug: safePath(env.EUT_424_PUBLIC_SLUG, 'public slug'),
  id: uuid(env.EUT_424_PUBLIC_UUID),
  blocked: safePath(env.EUT_424_BLOCKED_SLUG, 'blocked slug'),
  noConsent: safePath(env.EUT_424_NO_CONSENT_SLUG, 'no-consent slug'),
  rpcFailure: safePath(env.EUT_424_RPC_FAILURE_SLUG, 'RPC-failure slug'),
  email: syntheticEmail(env.EUT_424_LOGIN_EMAIL),
  password: env.EUT_424_LOGIN_PASSWORD,
  phone: env.EUT_424_PRIVATE_PHONE,
});
assert(new Set([fixture.slug, fixture.blocked, fixture.noConsent, fixture.rpcFailure]).size === 4,
  'Synthetic fixtures must be isolated');
assert(typeof fixture.password === 'string' && fixture.password.length >= 8,
  'Missing synthetic password');
assert(typeof fixture.phone === 'string' &&
  /^[+]55[1-9]{2}[2-9][0-9]{7,8}$/.test(fixture.phone),
  'Invalid synthetic private phone');
assert(typeof globalThis.WebSocket === 'function',
  'Node 22 WebSocket/CDP support required');
assert(typeof env.CHROMIUM_BIN === 'string' && existsSync(env.CHROMIUM_BIN),
  'Use previously available Chromium binary; do not install');

const permittedOrigins = new Set([app.origin, api.origin]);
function requireLocalRequest(raw) {
  const u = new URL(raw);
  assert.equal(u.protocol, 'http:', 'Network request must use HTTP');
  assert(permittedOrigins.has(u.origin), 'Remote or unexpected network request blocked');
  assert(!u.username && !u.password, 'Network credentials prohibited');
  return u;
}

async function getHttp(path) {
  const url = requireLocalRequest(new URL(path, app).href);
  const response = await fetch(url, {
    method: 'GET', redirect: 'manual', cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  const body = await response.text();
  assert(body.length < 2_000_000, 'Unexpectedly large HTML');
  return { status: response.status, location: response.headers.get('location'), body };
}

function noLeak(markup) {
  assert(!markup.includes(fixture.phone), 'Private phone leaked to public HTTP');
  assert(!markup.includes(fixture.phone.slice(1)), 'Private phone digits leaked');
  assert(!markup.includes(fixture.email), 'Synthetic login email leaked');
  assert(!markup.includes(fixture.password), 'Synthetic password leaked');
  assert(!/(?:access_token|refresh_token)"?\s*:\s*"eyJ/i.test(markup),
    'Session token leaked');
}

async function httpQaB() {
  const publicPage = await getHttp('/tecnicos/' + fixture.slug);
  assert.equal(publicPage.status, 200, 'Public eligible profile must be HTTP 200');
  assert(/<html[\s>]/i.test(publicPage.body) &&
    /rel=["']canonical["']/i.test(publicPage.body),
    'Expected actual SSR HTML and canonical link');
  assert(publicPage.body.includes('/tecnicos/' + fixture.slug),
    'Public canonical slug missing from HTML');
  noLeak(publicPage.body);

  const uuidPage = await getHttp('/tecnicos/' + fixture.id);
  assert.equal(uuidPage.status, 301, 'Legacy UUID must use HTTP 301');
  assert(uuidPage.location, '301 must provide Location');
  const target = requireLocalRequest(new URL(uuidPage.location, app).href);
  assert.equal(target.pathname, '/tecnicos/' + fixture.slug,
    'Legacy redirect must use the same technician canonical slug');

  for (const slug of [fixture.blocked, fixture.noConsent]) {
    const denied = await getHttp('/tecnicos/' + slug);
    assert.equal(denied.status, 404, 'Ineligible profile must be true HTTP 404');
    noLeak(denied.body);
  }

  // The local orchestrator must create a synthetic isolated RPC-failure case.
  // A missing row is NOT a valid substitute for this failure fixture.
  const failure = await getHttp('/tecnicos/' + fixture.rpcFailure);
  assert(failure.status >= 500 && failure.status <= 599,
    'Failed RPC must surface as 5xx, never a false 404 or soft 200');
  noLeak(failure.body);
  return ['public-200', 'legacy-301', 'ineligible-404', 'rpc-5xx', 'html-privacy'];
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(read, ms = 20000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const result = await read();
    if (result) return result;
    await delay(200);
  }
  throw new Error('Local browser readiness/check timed out');
}

async function startChromium() {
  const profile = mkdtempSync(join(tmpdir(), 'eut-424-chrome-'));
  let child;
  try {
    child = spawn(env.CHROMIUM_BIN, [
      '--headless=new', '--no-first-run', '--disable-background-networking',
      '--disable-extensions', '--disable-sync', '--no-default-browser-check',
      '--disable-component-update', '--disable-features=MediaRouter',
      '--user-data-dir=' + profile, '--remote-debugging-port=0', 'about:blank',
    ], { stdio: 'ignore', env: { ...env, HOME: profile } });
    let launchError = null;
    child.on('error', e => { launchError = e; });
    const port = await waitFor(() => {
      if (launchError || child.exitCode !== null) {
        throw new Error('Chromium could not start');
      }
      const file = join(profile, 'DevToolsActivePort');
      if (!existsSync(file)) return null;
      const number = Number(readFileSync(file, 'utf8').split(/\r?\n/)[0]);
      return Number.isInteger(number) && number > 0 && number < 65536 ? number : null;
    }, 12000);
    const discovery = new URL('http://127.0.0.1:' + port + '/json/list');
    const targets = await (await fetch(discovery, {
      signal: AbortSignal.timeout(5000),
    })).json();
    const tab = targets.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
    assert(tab, 'Chromium debugging tab unavailable');
    const debugUrl = new URL(tab.webSocketDebuggerUrl);
    assert.equal(debugUrl.protocol, 'ws:');
    assert.equal(debugUrl.hostname, '127.0.0.1');
    assert.equal(debugUrl.port, String(port));
    return { child, profile, debuggerUrl: debugUrl.href };
  } catch (error) {
    child?.kill();
    rmSync(profile, { recursive: true, force: true });
    throw error;
  }
}

async function openCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const handlers = new Map();
  let nextId = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', e => {
    let message;
    try { message = JSON.parse(String(e.data)); } catch { return; }
    if (message.id) {
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id);
      clearTimeout(task.timer);
      if (message.error) task.reject(new Error('Chromium CDP command failed'));
      else task.resolve(message.result);
    } else if (handlers.has(message.method)) {
      Promise.resolve(handlers.get(message.method)(message.params)).catch(() => {
        // Errors are recorded in the browser network blocker, not printed.
      });
    }
  });
  socket.addEventListener('close', () => {
    for (const task of pending.values()) {
      clearTimeout(task.timer);
      task.reject(new Error('Chromium closed unexpectedly'));
    }
    pending.clear();
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Chromium CDP timeout'));
    }, 12000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return {
    send,
    on(method, fn) { handlers.set(method, fn); },
    close() { socket.close(); },
  };
}

async function browserQaAAndVisual() {
  const browser = await startChromium();
  let cdp;
  try {
    cdp = await openCdp(browser.debuggerUrl);
    const { send } = cdp;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Fetch.enable', {
      patterns: [{ urlPattern: '*', requestStage: 'Request' }],
    });
    let externalRequestBlocked = false;
    cdp.on('Fetch.requestPaused', async ({ requestId, request }) => {
      try {
        requireLocalRequest(request.url);
        await send('Fetch.continueRequest', { requestId });
      } catch {
        externalRequestBlocked = true;
        await send('Fetch.failRequest', {
          requestId, errorReason: 'BlockedByClient',
        }).catch(() => {});
      }
    });
    async function evalInPage(expression) {
      const response = await send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true,
      });
      assert(!response.exceptionDetails, 'Browser page evaluation failed');
      return response.result?.value;
    }
    async function navigate(path) {
      const url = requireLocalRequest(new URL(path, app).href);
      await send('Page.navigate', { url: url.href });
      await waitFor(async () => {
        const result = await evalInPage('document.readyState === "complete"');
        return result === true;
      });
      assert.equal(await evalInPage('location.origin'), app.origin);
    }
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
    });
    await navigate('/entrar');
    await waitFor(() => evalInPage(
      'Boolean(document.querySelector("input[type=email]") && document.querySelector("input[type=password]"))'
    ));
    // Real GoTrue signInWithPassword through the existing UI, not a forged JWT.
    await evalInPage('document.querySelector("input[type=email]").focus()');
    await send('Input.insertText', { text: fixture.email });
    await evalInPage('document.querySelector("input[type=password]").focus()');
    await send('Input.insertText', { text: fixture.password });
    await evalInPage('document.querySelector("input[type=password]").closest("form").requestSubmit()');
    await waitFor(async () => {
      const state = await evalInPage(
        'location.pathname !== "/entrar" || !document.querySelector("input[type=password]")'
      );
      return state === true;
    }, 25000);
    await navigate('/area-tecnico');
    const link = await waitFor(() => evalInPage(
      'Array.from(document.querySelectorAll("a[href]")).map(a=>a.getAttribute("href")).find(h=>h === "/tecnicos/' +
      fixture.slug + '") || null'
    ), 30000);
    assert.equal(link, '/tecnicos/' + fixture.slug,
      'QA-A verified public profile link absent after local GoTrue login');

    for (const width of MIN_BROWSER_WIDTHS) {
      await send('Emulation.setDeviceMetricsOverride', {
        width, height: width === 390 ? 844 : 900,
        deviceScaleFactor: 1, mobile: width === 390,
      });
      await navigate('/tecnicos/' + fixture.slug);
      await waitFor(() => evalInPage('Boolean(document.querySelector("main"))'));
      const metrics = await evalInPage('({width:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth})');
      assert.equal(metrics.width, width, 'Incorrect Chromium viewport');
      assert(metrics.html <= width + 1 && metrics.body <= width + 1,
        'Horizontal overflow at ' + width);
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9,
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9,
      });
      const focus = await evalInPage('Boolean(document.activeElement && document.activeElement !== document.body)');
      assert(focus, 'Keyboard focus not established');
      const capture = await send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: false,
      });
      assert(capture?.data?.length > 1200,
        'Viewport screenshot could not be captured');
      // Screenshots are kept only in memory and never logged or uploaded.
    }
    assert(!externalRequestBlocked, 'An unexpected external network request was attempted');
    return ['local-gotrue-link', 'chromium-390', 'chromium-1440'];
  } finally {
    cdp?.close();
    browser.child.kill();
    rmSync(browser.profile, { recursive: true, force: true });
  }
}

// One serial, fail-fast QA. Nothing starts until every above gate succeeds.
const completed = [...await httpQaB(), ...await browserQaAAndVisual()];
console.log(JSON.stringify({ scope: 'EUT424-synthetic-local', outcome: 'PASS', checks: completed }));
