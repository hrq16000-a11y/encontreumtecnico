/* Isolated Chromium QA of the deployed customer funnel. No real writes.
 * Uses the published React UI with synthetic catalog responses, intercepts
 * the contact_messages INSERT, blocks every other non-GET request.
 * Screenshots are collected only from synthetic accounts/fields.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE = process.env.EUT_BASE_URL || "https://www.encontreumtecnico.com.br";
const target = new URL(BASE);
assert.equal(target.protocol, "https:");
assert.equal(target.hostname, "www.encontreumtecnico.com.br");
const artifacts = process.env.EUT_QA_ARTIFACT_DIR ||
  path.resolve("artifacts/eut-funnel-visual-410");
fs.mkdirSync(artifacts, { recursive: true });
const expected = {
  especialidade: "computadores",
  servico: "formatacao-de-notebooks",
  cidade: "Curitiba",
  uf: "PR",
  prioridade: "regiao",
};
const municipalities = [
  { id: 4106902, name: "Curitiba", uf: "PR", latitude: -25.43, longitude: -49.27 },
];
const categories = [
  { slug: "computadores", label: "Computadores e notebooks", description: "QA sintético" },
];
const services = [
  { slug: "formatacao-de-notebooks", category_slug: "computadores", label: "Formatação de notebooks" },
];

async function exercise(browser, width, height) {
  const folder = path.join(artifacts, String(width));
  fs.mkdirSync(folder, { recursive: true });
  const context = await browser.newContext({
    viewport: { width, height }, locale: "pt-BR",
    serviceWorkers: "block", reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  let mockInserts = 0;
  const blockedWrites = [];
  const mockedReads = new Set();
  let stage = "entry";

  // Register route BEFORE the first navigation. Every mutation is denied
  // unless it is the exact synthetic contact_messages POST, which is
  // fulfilled locally without forwarding to Supabase.
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const apiPath = url.pathname;
    if (method === "GET" && apiPath.includes("/rest/v1/eut_ibge_municipalities")) {
      mockedReads.add("municipalities");
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(municipalities) });
    }
    if (method === "GET" && apiPath.includes("/rest/v1/eut_service_categories")) {
      mockedReads.add("categories");
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(categories) });
    }
    if (method === "GET" && apiPath.includes("/rest/v1/eut_service_types")) {
      mockedReads.add("services");
      return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(services) });
    }
    if (method === "POST" && apiPath.endsWith("/rest/v1/contact_messages")) {
      mockInserts += 1;
      const body = request.postData() || "";
      assert(body.includes("Formatação de notebooks"),
        "Synthetic lead lost its requested service");
      assert(!body.includes("contact_phone"),
        "Private contact must never appear in synthetic request");
      return route.fulfill({ status: 201, contentType: "application/json", body: "" });
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      blockedWrites.push(method + " " + apiPath);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });

  async function screenshot(name) {
    await page.screenshot({
      path: path.join(folder, name + ".png"),
      animations: "disabled", fullPage: false,
    });
  }
  try {
    const response = await page.goto(new URL("/como-funciona", BASE).href, {
      waitUntil: "domcontentloaded", timeout: 60000,
    });
    assert(response && response.status() === 200,
      "Public entry page did not return HTTP 200");
    await page.locator('button[aria-controls="eut-free-help-dialog"]')
      .waitFor({ state: "attached" });
    // The cookie preferences banner can also carry role=dialog. Dismiss it
    // only inside this disposable context, then target the assistance ID.
    const rejectCookies = page.getByRole("button", { name: "Rejeitar", exact: true });
    if (await rejectCookies.isVisible().catch(() => false)) {
      await rejectCookies.click();
    }
    await page.waitForTimeout(500);

    // Production's documented event opens the actual lazy-loaded component.
    // The requested specific service is a synthetic context from a profile.
    // No user account, backend record or private profile is required.
    const help = {
      mode: "direct", service: "Formatação de notebooks", city: "Curitiba", uf: "PR",
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.evaluate((detail) => window.dispatchEvent(
        new CustomEvent("eut-open-free-help", { detail })), help);
      try {
        await page.locator('#eut-free-help-dialog[role="dialog"]').waitFor({ state: "visible", timeout: 3000 });
        break;
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }
    const dialog = page.locator('#eut-free-help-dialog[role="dialog"]');
    await screenshot("00-atendimento-aberto");
    stage = "service";
    const serviceInput = dialog.getByRole("combobox", { name: "Tipo de serviço" });
    assert.equal(await serviceInput.inputValue(), "Formatação de notebooks");
    await dialog.getByRole("textbox", { name: /Qual problema/i })
      .fill("Meu notebook reinicia sozinho e preciso de manutenção técnica");
    await screenshot("01-servico");

    await dialog.getByRole("button", { name: /Continuar/i }).click();
    stage = "ibge";
    await page.waitForFunction(() =>
      document.querySelector("#municipio-opcoes")?.value === "4106902");
    assert.equal(await dialog.getByRole("combobox",
      { name: "Estado (UF)" }).inputValue(), "PR");
    assert.equal(await dialog.getByRole("combobox",
      { name: "Município selecionado" }).inputValue(), "4106902");
    await dialog.getByRole("textbox", { name: "Seu nome" })
      .fill("Cliente QA sintético");
    await dialog.getByRole("textbox", { name: "E-mail para resposta" })
      .fill("cliente-sintetico@example.com");
    await dialog.locator('input[type="checkbox"]').check();
    await screenshot("02-cidade-ibge");

    const geometry = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      const bounds = modal?.getBoundingClientRect();
      return {
        viewport: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        modalClientWidth: modal?.clientWidth,
        modalScrollWidth: modal?.scrollWidth,
        modalBounds: bounds && { left: bounds.left, right: bounds.right },
      };
    });
    assert.equal(geometry.viewport, width, "Unexpected viewport CSS width");
    assert(geometry.pageScrollWidth <= width + 2,
      "Horizontal page overflow at " + width);
    assert(geometry.modalScrollWidth <= geometry.modalClientWidth + 2,
      "Modal horizontal overflow at " + width);
    assert(geometry.modalBounds.left >= -1 &&
      geometry.modalBounds.right <= width + 1,
      "Modal is clipped horizontally at " + width);

    stage = "synthetic-submit";
    await dialog.getByRole("button",
      { name: /Registrar interesse e continuar/i }).click();
    await dialog.getByText("Pedido registrado!").waitFor({ state: "visible" });
    assert.equal(mockInserts, 1, "Expected exactly one intercepted synthetic INSERT");
    await screenshot("03-confirmacao-sintetica");

    stage = "directory";
    await dialog.getByRole("button",
      { name: /Ver técnicos na minha região/i }).click();
    await page.waitForURL((u) => u.pathname.replace(/\/$/, "") === "/tecnicos", {
      timeout: 20000,
    });
    const resultUrl = new URL(page.url());
    for (const [field, value] of Object.entries(expected)) {
      assert.equal(resultUrl.searchParams.get(field), value,
        "Directory lost filter " + field);
    }
    for (const forbidden of ["email", "name", "telefone", "contact_phone"]) {
      assert(!resultUrl.searchParams.has(forbidden),
        "Private field leaked into directory URL: " + forbidden);
    }
    await screenshot("04-busca-filtrada");
    assert.deepEqual(blockedWrites, [],
      "Unexpected attempted mutation: " + blockedWrites.join(", "));
    assert(mockedReads.has("municipalities"), "IBGE catalog read was not mocked");
    assert(mockedReads.has("categories") && mockedReads.has("services"),
      "Active service/category catalog was not mocked");

    const summary = { viewport: width, status: "PASS", geometry,
      filters: Object.fromEntries(Object.keys(expected).map(k =>
        [k, resultUrl.searchParams.get(k)])),
      interceptedInserts: mockInserts, blockedWrites: blockedWrites.length,
      fixtureReads: [...mockedReads].sort() };
    fs.writeFileSync(path.join(folder, "result.json"),
      JSON.stringify(summary, null, 2) + "\n");
    console.log("PASS " + width + "px", JSON.stringify(summary));
  } catch (error) {
    try { await screenshot("FAIL-" + stage); } catch { /* browser unavailable */ }
    let dialogText = "";
    try {
      dialogText = (await page.locator('#eut-free-help-dialog').innerText({
        timeout: 1500,
      })).slice(0, 900);
    } catch { /* dialog may not have opened */ }
    fs.writeFileSync(path.join(folder, "failure.json"),
      JSON.stringify({ viewport: width, stage, error: String(error),
        dialogText, mockInserts, blockedWrites }, null, 2) + "\n");
    throw error;
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const failed = [];
  try {
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      try { await exercise(browser, width, height); }
      catch (error) {
        failed.push(width + "px: " + String(error));
        console.error("FAIL " + width + "px", String(error));
      }
    }
  } finally { await browser.close(); }
  if (failed.length) {
    console.error("QA not approved:\n" + failed.join("\n"));
    process.exitCode = 1;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
