/* Chromium QA of the real PR #448 components, using local GoTrue and in-memory records only. */
const assert = require("node:assert/strict");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = process.cwd();
const session = JSON.parse(readFileSync(path.join(project, ".github/qa/eut-admin-448/.runtime/session.json"), "utf8"));
const base = "http://127.0.0.1:4188";
const output = process.env.EUT_QA448_REPORT_DIR || path.join(project, ".github/qa/eut-admin-448/.runtime/results");
const report = { project: "Encontre um Técnico", pr: 448, mode: "local-GoTrue-and-synthetic-UI",
  head: "d0ebe8f07d31fa587c35a3425320be1bcf900d35",
  productionRequests: 0, writes: 0, checks: [], failures: [] };
mkdirSync(output, { recursive: true });
assert.equal(session.api, "http://127.0.0.1:54321", "Remote Auth forbidden");
assert.match(session.email, /^eut-qa448-[a-f0-9]+@example\.invalid$/);
async function localLogin() {
  const res = await fetch(session.api + "/auth/v1/token?grant_type=password", {
    method: "POST", headers: { apikey: session.anon, "content-type": "application/json" },
    body: JSON.stringify({ email: session.email, password: session.password }),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(res.status, 200, "Local GoTrue login failed");
  const result = await res.json();
  assert.equal(typeof result.access_token, "string", "No local GoTrue token");
  const userRes = await fetch(session.api + "/auth/v1/user", {
    headers: { apikey: session.anon, authorization: "Bearer " + result.access_token },
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(userRes.status, 200, "Local token not verified");
  const user = await userRes.json();
  assert.equal(user.id, session.id, "Local token belongs to wrong identity");
  return result.access_token;
}
async function checkViewport(browser, width, token) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "pt-BR" });
  await context.addInitScript(t => { window.__QA448_TOKEN__ = t; }, token);
  const page = await context.newPage();
  const external = [];
  const pageErrors = [];
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) {
      external.push(url.origin);
      report.productionRequests++;
      return route.abort();
    }
    return route.continue();
  });
  page.on("pageerror", error => pageErrors.push(error.message));
  try {
    const response = await page.goto(base + "/.github/qa/eut-admin-448/.runtime/index.html", {
      waitUntil: "networkidle", timeout: 60000,
    });
    assert.equal(response?.status(), 200, "Synthetic local Vite is unavailable");
    await page.getByRole("status", { name: /Autenticado com GoTrue local/ }).waitFor({ timeout: 30000 }).catch(async () => {
      await page.getByText("Autenticado com GoTrue local · dados sintéticos").waitFor({ timeout: 3000 });
    });
    await page.getByRole("heading", { name: "Usuários", exact: true }).waitFor();
    await page.getByRole("table", { name: "Contas cadastradas" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Tabela" }).getAttribute("aria-pressed"), "true");
    await page.getByText("Cliente Sintético 01").waitFor();
    assert.equal(await page.locator('input[aria-label="Selecionar Administrador Sintético"]').count(), 0,
      "Admin accidentally became eligible for bulk actions");
    const size = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert(size.scroll <= size.viewport + 4,
      "Horizontal document overflow at " + width + ": " + size.scroll + "/" + size.viewport);
    assert.equal(await page.locator('a[href^="tel:"],a[href^="mailto:"],a[href*="wa.me"]').count(), 0);
    const body = await page.locator("body").innerText();
    assert(body.includes("s•••"), "Masked synthetic e-mail not rendered");
    assert(!body.includes(session.email), "Synthetic GoTrue credentials visible in UI");
    assert(!body.includes(session.password), "Synthetic password visible in UI");
    await page.screenshot({ path: path.join(output, "qa-448-" + width + ".png"), fullPage: true,
      animations: "disabled" });

    await page.getByRole("button", { name: "Cartões", exact: true }).click();
    assert.equal(await page.getByRole("table", { name: "Contas cadastradas" }).count(), 0);
    await page.getByRole("button", { name: "Tabela", exact: true }).click();
    await page.getByRole("table", { name: "Contas cadastradas" }).waitFor();

    await page.getByRole("checkbox", { name: "Selecionar Cliente Sintético 01" }).check();
    await page.getByText("1 selecionada(s)").waitFor();
    await page.getByRole("button", { name: "Banir selecionadas", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Confirmar ações auditadas" }).isDisabled(), true);
    await page.getByRole("button", { name: "Limpar seleção" }).click();
    assert.equal(await page.getByRole("button", { name: "Confirmar ações auditadas" }).count(), 0);

    await page.getByRole("button", { name: "Editar nome" }).first().click();
    await page.getByRole("form", { name: "Confirmar alteração de conta" }).waitFor();
    await page.getByRole("button", { name: "Cancelar alteração" }).click();

    await page.getByRole("button", { name: "Próximo" }).click();
    await page.getByText("Cliente Sintético 20").waitFor();
    await page.getByRole("button", { name: "Anterior" }).click();
    await page.getByText("Cliente Sintético 01").waitFor();

    const search = page.getByRole("textbox", { name: "Pesquisar contas" });
    await search.fill("Cliente Sintético 03");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await page.getByText("Cliente Sintético 03").waitFor();
    assert.equal(await page.getByText("Cliente Sintético 01").count(), 0, "Search has stale rows");
    await search.fill("");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await page.getByText("Cliente Sintético 01").waitFor();

    const tabs = page.getByRole("tablist", { name: "Perfis dos usuários" });
    const allTab = tabs.getByRole("tab", { name: "Todos" });
    await allTab.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await tabs.getByRole("tab", { name: "Admins" }).getAttribute("aria-selected"), "true");
    await page.getByRole("table", { name: "Administradores cadastrados" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Consultar conta" }).count(), 1);
    await tabs.getByRole("tab", { name: "Técnicos" }).click();
    const professional = page.getByRole("link", { name: "Gestão detalhada de técnicos" }).first();
    assert.match(await professional.getAttribute("href"), /\/admin\/tecnicos/);
    const shortcut = page.getByRole("link", { name: "Gerenciar fichas técnicas" });
    assert.match(await shortcut.getAttribute("href"), /\/admin\/tecnicos/);

    assert.deepEqual(external, [], "External application request attempted");
    assert.deepEqual(pageErrors, [], "Client script errors");
    const writeAttempts = await page.evaluate(() => globalThis.__qa448WriteAttempts || 0);
    assert.equal(writeAttempts, 0, "Synthetic UI attempted an admin write");
    report.checks.push({ width, result: "PASS", scrollWidth: size.scroll,
      viewport: size.viewport, auth: "real-GoTrue-local",
      actions: "cancelled", remoteRequests: external.length, writes: writeAttempts });
    console.log("QA448_CHROMIUM_PASS " + JSON.stringify(report.checks.at(-1)));
  } catch (error) {
    report.failures.push({ width, message: String(error.message).slice(0, 500),
      externalOrigins: [...new Set(external)], pageErrors });
    await page.screenshot({ path: path.join(output, "qa-448-" + width + "-failure.png"),
      fullPage: true }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}
(async () => {
  const token = await localLogin();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) await checkViewport(browser, width, token);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error("QA448_CHROMIUM_NO_GO: " + String(error.message).slice(0, 500));
  process.exitCode = 1;
}).finally(() => {
  writeFileSync(path.join(output, "qa-448-report.json"), JSON.stringify(report, null, 2));
});
