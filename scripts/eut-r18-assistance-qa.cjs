/* Candidate-only, read-only QA. Never sends a request, logs in or checks consent. */
const assert = require("node:assert/strict");
const { mkdir } = require("node:fs/promises");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  await mkdir("artifacts/eut-r18", { recursive: true });
  try {
    for (const width of [390, 768, 1440]) {
      const context = await browser.newContext({ locale: "pt-BR", viewport: { width, height: 844 }, reducedMotion: "reduce" });
      // Block external data writes and analytics in this synthetic session.
      await context.route("**/*", route => {
        const req = route.request();
        if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
        return route.continue();
      });
      const page = await context.newPage();
      try {
        const base = process.env.EUT_BASE_URL || "http://127.0.0.1:4173";
        const response = await page.goto(base + "/contato", { waitUntil: "domcontentloaded", timeout: 60000 });
        assert(response && response.ok(), "contact candidate not available");
        const trigger = page.getByRole("button", { name: "Pedir ajuda ao portal", exact: true });
        await trigger.waitFor({ state: "visible", timeout: 30000 });
        await trigger.scrollIntoViewIfNeeded();
        const origin = page.url();
        const scroll = await page.evaluate(() => window.scrollY);
        await trigger.click();
        const dialog = page.locator("#eut-free-help-dialog");
        const service = dialog.getByRole("combobox", { name: "Tipo de serviço" });
        await service.waitFor({ state: "visible", timeout: 30000 });
        assert.equal(page.url(), origin);
        assert(await service.evaluate(e => e.getBoundingClientRect().height >= 44), "touch target");
        await service.fill("cftv");
        await dialog.getByRole("option", { name: "CFTV e segurança", exact: true }).waitFor();
        const options = dialog.getByRole("listbox");
        const box = await options.boundingBox();
        assert(box && box.x >= -1 && box.x + box.width <= width + 1, "suggestions overflow");
        await page.screenshot({ path: "artifacts/eut-r18/" + width + "-choices.png" });
        await service.press("ArrowDown");
        await service.press("Enter");
        assert.equal(await service.getAttribute("data-choice-value"), "CFTV e segurança");
        const when = dialog.getByRole("combobox", { name: "Para quando?" });
        await when.fill("amanha");
        await when.press("Enter");
        assert.equal(await when.getAttribute("data-choice-value"), "Amanhã");
        await dialog.getByRole("textbox", { name: /Qual problema/ }).fill("Equipamento de teste não liga há dois dias");
        await dialog.getByRole("button", { name: "Continuar", exact: true }).click();
        const uf = dialog.getByRole("combobox", { name: "Estado (UF)" });
        await uf.waitFor({ state: "visible" });
        await uf.fill("parana");
        await dialog.getByRole("option", { name: "Paraná (PR)", exact: true }).waitFor();
        await uf.press("Enter");
        assert.equal(await uf.getAttribute("data-choice-value"), "PR");
        assert.equal(page.url(), origin);
        await page.screenshot({ path: "artifacts/eut-r18/" + width + "-uf.png" });
        await uf.click();
        await uf.press("Escape");
        assert(await dialog.isVisible(), "Escape should dismiss suggestions before the funnel");
        await uf.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        assert.equal(page.url(), origin);
        assert(Math.abs(await page.evaluate(() => window.scrollY) - scroll) <= 4, "origin scroll moved");
        assert(await trigger.evaluate(el => document.activeElement === el), "focus not returned");
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 4), "horizontal overflow");
        console.log("R18 candidate PASS", width, "context, keyboard, UF, Escape, focus, scroll, reduced motion; no submission");
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
