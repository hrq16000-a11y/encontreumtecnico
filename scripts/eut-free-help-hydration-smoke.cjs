/* Local-only Chromium smoke for the contextual Home help CTA.
 * No form submission, hosted Supabase access, real leads or payments.
 * Run against an isolated Vite instance, after installing Playwright.
 */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = new URL(process.env.EUT_BASE_URL || "http://127.0.0.1:5173");
assert(["127.0.0.1", "localhost"].includes(base.hostname), "Smoke requires a local server");

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    let externalRequests = 0;
    await context.route("**/*", (request) => {
      const url = request.request().url();
      if (url.startsWith(base.origin + "/") || url.startsWith("data:") || url.startsWith("blob:")) {
        return request.continue();
      }
      externalRequests++;
      return request.abort("blockedbyclient");
    });
    const page = await context.newPage();
    await page.goto(base.origin + "/", { waitUntil: "domcontentloaded", timeout: 30000 });

    // DOMContentLoaded proves only that SSR HTML exists. CookieNotice is a
    // client-side useEffect marker in a fresh, isolated browser context.
    const cookie = page.getByRole("dialog", { name: "Aviso de cookies" });
    await cookie.waitFor({ state: "visible", timeout: 20000 });
    await page.waitForLoadState("load");
    assert.equal(await page.evaluate(() => document.readyState), "complete");
    await cookie.getByRole("button", { name: "Rejeitar" }).click();
    await cookie.waitFor({ state: "hidden" });

    const opener = page.getByRole("button", { name: "Pedir ajuda ao portal", exact: true });
    await opener.scrollIntoViewIfNeeded();
    await opener.focus();
    await opener.click();

    // Another dialog (cookie consent) must never satisfy the help assertion.
    const dialog = page.locator("#eut-free-help-dialog[role='dialog']");
    await dialog.waitFor({ state: "visible", timeout: 10000 });
    assert.equal(await dialog.count(), 1, "Expected exactly one help dialog");
    const close = dialog.getByRole("button", { name: "Fechar atendimento", exact: true });
    await page.waitForFunction(() =>
      document.activeElement === document.querySelector("#eut-free-help-dialog button[aria-label='Fechar atendimento']"),
    );
    assert(await close.evaluate((button) => document.activeElement === button), "Initial focus missed close button");
    assert.equal(await dialog.locator("a[href^='tel:'], a[href^='mailto:'], a[href*='wa.me']").count(), 0,
      "Help dialog exposes a direct private contact link");

    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: 5000 });
    assert(await opener.evaluate((button) => document.activeElement === button), "Escape did not restore CTA focus");
    console.log(JSON.stringify({
      status: "PASS", viewport: 390, hydration: "CookieNotice useEffect mounted",
      readyState: "complete", specificDialog: true, closeFocused: true,
      escapeClosed: true, focusRestored: true, privateLinks: 0, externalRequestsBlocked: externalRequests,
    }));
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("EUT_HOME_HELP_HYDRATION_FAIL", error.stack || error);
  process.exitCode = 1;
});
