/* Read-only Chromium regression against the PR's local dev server.
 * This is automated viewport coverage, NOT authenticated QA or a production check.
 */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = process.env.EUT_BASE_URL;
if (!base || !/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) {
  throw new Error("Browser regression requires a local 127.0.0.1 preview");
}

async function ready() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch { /* local dev server is not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Local Vite preview was not ready within 60 seconds");
}

async function mobile(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  try {
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
    const trigger = page.locator('button[aria-controls="eut-mobile-menu"]');
    await trigger.waitFor({ state: "visible" });
    // Allow TanStack client hydration to attach its event handlers.
    await page.waitForTimeout(1000);
    await trigger.click();
    await page.waitForFunction(() =>
      document.querySelector('button[aria-controls="eut-mobile-menu"]')?.getAttribute("aria-expanded") === "true");
    const menu = page.getByRole("navigation", { name: "Navegação móvel" });
    const services = menu.getByRole("link", { name: "Serviços" });
    await services.focus();
    assert(await services.evaluate(element => document.activeElement === element),
      "Mobile link did not receive keyboard focus");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() =>
      document.querySelector('button[aria-controls="eut-mobile-menu"]')?.getAttribute("aria-expanded") === "false");
    assert.equal(await menu.count(), 0, "Escape did not unmount the mobile menu");
    assert(await trigger.evaluate(element => document.activeElement === element),
      "Escape did not restore focus to the menu trigger");
    console.log("PASS Chromium 390px: Escape closes menu and restores keyboard focus");
  } finally { await context.close(); }
}

async function desktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
  try {
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
    const trigger = page.locator('button[aria-controls="eut-mobile-menu"]');
    await trigger.waitFor({ state: "attached" });
    assert(await trigger.isHidden(), "Mobile menu trigger must be hidden at 1440px");
    assert(await page.getByRole("navigation", { name: "Navegação principal" }).isVisible(),
      "Desktop navigation must be visible at 1440px");
    console.log("PASS Chromium 1440px: desktop navigation visible and mobile toggle hidden");
  } finally { await context.close(); }
}

(async () => {
  await ready();
  const browser = await chromium.launch({ headless: true });
  try {
    await mobile(browser);
    await desktop(browser);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
