// Authorized QA only: all accounts, services and requests stay on localhost.
// A single synthetic Auth account is seeded via local GoTrue; the browser signs in
// through the real UI and opens its own public profile.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const API = "http://127.0.0.1:54321";
const APP = "http://127.0.0.1:4173";
assert.equal(process.env.API_URL, API, "FAIL CLOSED: unexpected local API");
assert.equal(process.env.SUPABASE_URL, API, "FAIL CLOSED: server uses nonlocal API");
assert(process.env.ANON_KEY && process.env.SERVICE_ROLE_KEY, "Missing ephemeral keys");
assert.equal(process.env.SUPABASE_PUBLISHABLE_KEY, process.env.ANON_KEY);
assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SERVICE_ROLE_KEY);
const email = "eut-public-profile-qa@example.invalid";
const password = "LocalSyntheticOnly!2026";

const loopback = (href) => {
  const url = new URL(href);
  return ["http:", "https:", "ws:", "wss:"].includes(url.protocol)
    && ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
};
async function localRequest(path, options = {}) {
  const url = new URL(path, API);
  assert.equal(url.origin, API);
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: options.admin ? process.env.SERVICE_ROLE_KEY : process.env.ANON_KEY,
      Authorization: "Bearer " + (options.token || (options.admin ? process.env.SERVICE_ROLE_KEY : process.env.ANON_KEY)),
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const raw = await response.text();
  assert(response.ok, "Local API request failed, HTTP " + response.status + " at " + path.split("?")[0]);
  return raw ? JSON.parse(raw) : null;
}

async function main() {
  const user = await localRequest("/auth/v1/admin/users", {
    method: "POST", admin: true,
    body: { email, password, email_confirm: true },
  });
  assert.match(user.id, /^[0-9a-f-]{36}$/i);
  const session = await localRequest("/auth/v1/token?grant_type=password", {
    method: "POST", body: { email, password },
  });
  assert(session.access_token && session.user.id === user.id);
  await localRequest("/rest/v1/rpc/choose_account_type", {
    method: "POST", token: session.access_token, body: { _role: "tecnico" },
  });
  const published = await localRequest("/rest/v1/rpc/eut_publish_my_technician", {
    method: "POST", token: session.access_token,
    body: {
      _display_name: "Profissional Local QA",
      _state_uf: "PR",
      _city: "Curitiba",
      _neighborhood: "Centro",
      _region: "Curitiba",
      _bio: "Suporte local sintético.",
      _specialties: ["informatica"],
      _service_slugs: ["formatacao"],
    },
  });
  assert.equal(published.state, "publicado");
  const rows = await localRequest("/rest/v1/technicians?select=id,public_slug,status&user_id=eq." + user.id, {
    token: session.access_token,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, published.technician_id);
  assert.equal(rows[0].status, "aprovado");
  const slug = rows[0].public_slug;
  assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const target = "/tecnicos/" + slug;

  const external = [];
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"],
  });
  try {
    const context = await browser.newContext({
      locale: "pt-BR",
      serviceWorkers: "block",
      viewport: { width: 390, height: 844 },
    });
    await context.route("**/*", async (route) => {
      const url = route.request().url();
      if (!loopback(url)) {
        external.push(new URL(url).origin);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    await context.routeWebSocket("**/*", async (ws) => {
      if (!loopback(ws.url())) {
        external.push(new URL(ws.url()).origin);
        await ws.close();
        return;
      }
      await ws.connectToServer();
    });

    const page = await context.newPage();
    const login = await page.goto(APP + "/entrar", { waitUntil: "domcontentloaded" });
    assert(login && login.status() === 200, "Local login page did not return 200");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.goto(APP + "/area-tecnico", { waitUntil: "domcontentloaded" });

    const profileLink = page.getByRole("link", { name: /Conferir meu perfil publicado/ });
    await profileLink.waitFor({ state: "visible", timeout: 30000 });
    assert.equal(await profileLink.getAttribute("href"), target);
    await profileLink.click();
    await page.waitForURL(APP + target, { timeout: 30000 });

    // This is the real HTTP gate; SPA navigation alone does not prove SSR 200.
    const response = await page.goto(APP + target, { waitUntil: "domcontentloaded" });
    assert(response && response.status() === 200, "Profile SSR did not return HTTP 200");
    assert((await page.locator("body").innerText()).includes("Profissional Local QA"));
    assert.equal(
      await page.locator('link[rel="canonical"]').first().getAttribute("href"),
      "https://www.encontreumtecnico.com.br" + target,
    );
    const html = await page.content();
    assert(!html.includes(email), "Private account email leaked in public HTML");
    assert(!html.includes("phone_e164") && !html.includes("contact_phone"),
      "Private contact field leaked in public HTML");
    assert.deepEqual(external, [], "Browser attempted nonlocal network access");
    console.log("PASS isolated browser: Auth UI, stable ID, canonical slug, HTTP 200, no private contact");
    await context.close();
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error("FAIL local public profile QA:", error.message);
  process.exitCode = 1;
});
