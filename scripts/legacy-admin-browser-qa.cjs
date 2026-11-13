/* Real Chromium against an isolated, in-memory Vite fixture; no hosted data. */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const BASE = process.env.EUT_LEGACY_QA_URL || "http://127.0.0.1:4187";

async function checkWidth(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "pt-BR" });
  const page = await context.newPage();
  const external = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(BASE).origin) {
      external.push(url.origin);
      return route.abort();
    }
    return route.continue();
  });
  try {
    const response = await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
    assert.equal(response?.status(), 200, "Local synthetic Vite failed");
    await page.getByRole("button", { name: "Ver ficha · Demonstração Sintética" }).waitFor();
    const demo = page.locator('button[aria-controls="legacy-details-candidate-207"]');
    const controlledId = await demo.getAttribute("aria-controls");
    assert.equal(controlledId, "legacy-details-candidate-207");
    const details = page.locator("#" + controlledId);
    assert.equal(await details.count(), 1, "aria-controls target must exist while collapsed");
    assert.equal(await details.isHidden(), true);
    assert.equal(await demo.getAttribute("aria-expanded"), "false");
    await demo.focus();
    await page.keyboard.press("Enter");
    assert.equal(await demo.getAttribute("aria-expanded"), "true");
    assert.equal(await details.isVisible(), true);
    assert.equal(await demo.evaluate((el) => document.activeElement === el), true, "Open lost focus");
    assert.match(await details.innerText(), /demo-sintetica/);
    await page.keyboard.press("Enter");
    assert.equal(await demo.getAttribute("aria-expanded"), "false");
    assert.equal(await details.isHidden(), true);
    assert.equal(await details.count(), 1, "Collapse removed aria-controls target");
    assert.equal(await demo.evaluate((el) => document.activeElement === el), true, "Close lost focus");

    assert.equal(await page.getByRole("checkbox", { name: "Selecionar cadastro WordPress 207" }).isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "Editar nome" }).first().isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "Restaurar lote" }).isDisabled(), true);
    await page.getByRole("button", { name: "Selecionar página" }).click();
    await page.getByText("1 selecionada(s)").waitFor();
    assert.equal(await page.getByRole("checkbox", { name: "Selecionar cadastro WordPress 301" }).isChecked(), true);
    assert.equal(await page.getByRole("button", { name: "Revisar lote" }).isEnabled(), true);
    assert.equal(await page.getByRole("button", { name: "Arquivar lote" }).isEnabled(), true);
    assert.equal(await page.getByRole("button", { name: "Restaurar lote" }).isDisabled(), true);
    await page.getByRole("button", { name: "Revisar lote" }).click();
    await page.getByRole("form", { name: "Confirmar gestão histórica" }).waitFor();
    await page.getByRole("button", { name: "Cancelar ação histórica" }).click();
    const body = await page.locator("body").innerText();
    assert(!body.includes("PRIVATE_SYNTHETIC_"), "Synthetic private contact leaked to visible page");
    assert.equal(await page.locator('a[href^="tel:"],a[href^="mailto:"],a[href*="wa.me"]').count(), 0);
    assert.deepEqual(external, [], "External network request attempted");
    const size = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert(size.scrollWidth <= size.width + 4, "Horizontal overflow at " + width);
    console.log("LEGACY_ADMIN_CHROMIUM_PASS " + JSON.stringify({
      width, ariaControls: "stable", keyboard: "Enter opens/closes",
      focus: "retained", selection: "restricted", demo: "protected",
      rpc: "not submitted", contacts: "private", externalRequests: external.length,
      overflow: false,
    }));
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await checkWidth(browser, 390);
    await checkWidth(browser, 1440);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("LEGACY_ADMIN_CHROMIUM_FAIL", error); process.exitCode = 1; });
