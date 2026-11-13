/* Real Chromium rendering of the PR branch against a loopback PostgREST
 * fixture. No production API, no real identities and no writes.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const BASE = process.env.EUT_BASE_URL;
const FIXTURE = process.env.EUT_FIXTURE_URL;
assert(BASE && FIXTURE, "Both local QA URLs are required");
for (const value of [BASE, FIXTURE]) {
  const parsed = new URL(value);
  assert.equal(parsed.protocol, "http:", "QA must be local HTTP");
  assert.equal(parsed.hostname, "127.0.0.1", "QA must be loopback only");
}
const BASE_ORIGIN = new URL(BASE).origin;
const FIXTURE_ORIGIN = new URL(FIXTURE).origin;
const SUPABASE_ORIGIN = "https://pqtzhctvjbfcunmrvxne.supabase.co";
const ARTIFACTS = process.env.EUT_QA_ARTIFACT_DIR || "/tmp/eut-ibge-qa";
const secret = "qa-secret-never-publish@example.test";
fs.mkdirSync(ARTIFACTS, { recursive: true });
async function installOfflineOnly(context, tracker) {
  await context.route("**/*", async route => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin === BASE_ORIGIN) return route.continue();
    if (target.origin === SUPABASE_ORIGIN) {
      tracker.fixtureRequests++;
      const uri = FIXTURE + target.pathname + target.search;
      const response = await fetch(uri, {
        method: request.method(), headers: { accept: request.headers().accept || "application/json" },
        body: request.method() === "POST" ? request.postData() : undefined,
      });
      return route.fulfill({ status: response.status,
        contentType: response.headers.get("content-type") || "application/json",
        headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
        body: await response.text() });
    }
    tracker.externalBlocked.push(target.origin);
    return route.abort("blockedbyclient");
  });
}
async function eventually(page, predicate, label) {
  await page.waitForFunction(predicate, undefined, { timeout: 25000 })
    .catch(() => { throw new Error("Timeout: " + label); });
}
async function checkViewport(browser, width) {
  const context = await browser.newContext({ locale: "pt-BR", viewport: { width, height: 900 },
    reducedMotion: "reduce" });
  const tracker = { fixtureRequests: 0, externalBlocked: [] };
  await installOfflineOnly(context, tracker);
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push("console: " + message.text().slice(0, 250));
  });
  try {
    const response = await page.goto(BASE + "/tecnicos", { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(response && response.ok(), "Branch /tecnicos must respond successfully");
    await page.locator("#filtro-uf").waitFor({ state: "visible" });
    await page.locator("#filtro-uf").selectOption("PR");
    await page.waitForTimeout(1500);
    console.log("QA_DIAG_UF", JSON.stringify(await page.evaluate(() => ({
      currentUrl: location.href,
      selectedUF: document.querySelector("#filtro-uf")?.value,
      municipalitySelect: Boolean(document.querySelector("#filtro-municipio-ibge")),
      scripts: document.scripts.length,
    }))));
    const selector = page.locator("#filtro-municipio-ibge");
    await selector.waitFor({ state: "visible" });
    await selector.locator('option[value="4125506"]').waitFor({ state: "attached" });
    await selector.selectOption("4125506");
    await eventually(page, () => new URLSearchParams(location.search).get("municipio_ibge") === "4125506",
      "official municipality not selected");
    const cards = page.locator('a[aria-label^="Ver perfil e serviços de"]');
    await eventually(page, () => document.querySelectorAll('a[aria-label^="Ver perfil e serviços de"]').length === 50,
      "page 1 did not render 50 eligible profiles");
    assert.equal(await cards.count(), 50, "first page should show 50 eligible, not candidates");
    const nav = page.getByRole("navigation", { name: "Paginação dos técnicos por município" });
    assert(await nav.getByRole("button", { name: "Anterior" }).isDisabled(),
      "Previous must be disabled on page 1");
    assert(await nav.getByRole("button", { name: /Consultar próxima página/ }).isEnabled(),
      "Next should be enabled when a 51st eligible was verified");
    const snapshot = await page.content();
    assert(!snapshot.includes(secret), "Private fixture data leaked in SSR/DOM");
    assert(!/href=["'](?:tel:|mailto:|https?:\/\/wa\.me)/i.test(await cards.first().innerHTML()),
      "Contact link exposed on public technician card");
    assert(!snapshot.includes("99 nomes"), "Quarantined names must not appear");
    const size = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    assert(size.content <= size.viewport + 4,
      "Horizontal overflow at " + width + "px: " + JSON.stringify(size));
    for (const id of ["filtro-uf", "filtro-municipio-ibge"]) {
      const box = await page.locator("#" + id).boundingBox();
      assert(box && box.height >= 44 && box.width >= 44,
        "Touch target smaller than 44px or hidden: " + id);
    }
    await page.screenshot({ path: path.join(ARTIFACTS, "ibge-" + width + "-page1.png"),
      fullPage: true });
    await nav.getByRole("button", { name: /Consultar próxima página/ }).click();
    await eventually(page, () => document.querySelectorAll('a[aria-label^="Ver perfil e serviços de"]').length === 5 &&
      document.querySelector('nav[aria-label="Paginação dos técnicos por município"]')?.textContent?.includes("Página 2"),
      "page 2 must display remaining five eligible profiles");
    assert.equal(await cards.count(), 5);
    assert(await nav.getByRole("button", { name: /Consultar próxima página/ }).isDisabled(),
      "Next button must be disabled on final eligible page");
    await page.screenshot({ path: path.join(ARTIFACTS, "ibge-" + width + "-page2.png"),
      fullPage: true });
    await nav.getByRole("button", { name: "Anterior" }).click();
    await eventually(page, () => document.querySelectorAll('a[aria-label^="Ver perfil e serviços de"]').length === 50,
      "Previous should restore first 50 eligible profiles");
    await page.locator("#filtro-especialidade").selectOption("computadores");
    await eventually(page, () => document.querySelectorAll('a[aria-label^="Ver perfil e serviços de"]').length === 30,
      "category filter must produce 30 eligible profiles after reset");
    assert(await nav.getByRole("button", { name: "Anterior" }).isDisabled(),
      "Changing category should reset to page 1");
    assert(await nav.getByRole("button", { name: /Consultar próxima página/ }).isDisabled(),
      "Next must be disabled when fewer than 50 eligible profiles remain");
    await page.locator("#filtro-municipio-ibge").selectOption("4106902");
    await eventually(page, () => document.body.textContent?.includes("Nenhum técnico elegível nesta página"),
      "empty official city must show truthful empty state");
    assert.equal(await cards.count(), 0);
    assert(await nav.getByRole("button", { name: /Consultar próxima página/ }).isDisabled(),
      "Empty official city must not offer a fictitious next page");
    assert(!((await page.content()).includes(secret)), "Private fixture leaked in empty state");
    await page.screenshot({ path: path.join(ARTIFACTS, "ibge-" + width + "-empty.png"),
      fullPage: true });
    assert(tracker.fixtureRequests > 0, "Browser did not request synthetic municipality catalog");
    assert(!errors.length, "Page JavaScript errors: " + errors.join(" | "));
    console.log("PASS branch IBGE Chromium", JSON.stringify({ width, fixtureRequests: tracker.fixtureRequests,
      externalRequestsBlocked: tracker.externalBlocked.length, pages: [50, 5],
      categoryEligible: 30, emptyState: true, privacy: true }));
  } catch (error) {
    let diagnostics = {};
    try {
      diagnostics = {
        url: page.url(), body: (await page.locator("body").innerText()).slice(0, 1200),
        activeUF: await page.locator("#filtro-uf").inputValue().catch(() => null),
        scriptCount: await page.evaluate(() => document.scripts.length),
        externalBlocked: tracker.externalBlocked, fixtureRequests: tracker.fixtureRequests,
        pageErrors: errors.slice(0, 10),
      };
      await page.screenshot({ path: path.join(ARTIFACTS, "ibge-" + width + "-failed.png"),
        fullPage: true }).catch(() => {});
    } catch (secondary) {
      diagnostics.inspectError = String(secondary);
    }
    console.error("QA_DIAGNOSTICS", JSON.stringify(diagnostics));
    throw error;
  } finally { await context.close(); }
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) await checkViewport(browser, width);
    console.log("PASS PR #255: actual branch UI with synthetic city, pagination, privacy at 390/1440");
  } finally { await browser.close(); }
})().catch(e => { console.error("FAIL PR #255 branch QA", e.stack); process.exitCode = 1; });
