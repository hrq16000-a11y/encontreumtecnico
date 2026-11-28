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
        await page.waitForLoadState("networkidle", { timeout: 60000 });
        // Vite dev SSR sends HTML before the client route is hydrated.
        await page.waitForTimeout(1200);
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
        // Same support intent resumes the second step; different intent must not inherit it.
        await trigger.click();
        const resumedUF = dialog.getByRole("combobox", { name: "Estado (UF)" });
        await resumedUF.waitFor({ state: "visible", timeout: 30000 });
        assert.equal(await resumedUF.getAttribute("data-choice-value"), "PR");
        await dialog.getByRole("button", { name: "Voltar ao problema" }).click();
        const resumedIssue = dialog.getByRole("textbox", { name: /Qual problema/ });
        assert.equal(await resumedIssue.inputValue(), "Equipamento de teste não liga há dois dias");
        assert.equal(await dialog.getByRole("combobox", { name: "Tipo de serviço" }).getAttribute("data-choice-value"), "CFTV e segurança");
        await dialog.getByRole("button", { name: "Fechar atendimento" }).click();
        await dialog.waitFor({ state: "hidden" });
        const privacy = page.getByRole("button", { name: "Pedir ajuda com dados", exact: true });
        await privacy.scrollIntoViewIfNeeded();
        await privacy.click();
        const privacyIssue = dialog.getByRole("textbox", { name: /Qual problema/ });
        await privacyIssue.waitFor({ state: "visible" });
        assert((await privacyIssue.inputValue()).includes("privacidade ou meus dados pessoais"));
        assert(!(await privacyIssue.inputValue()).includes("Equipamento de teste"));
        assert.equal(await dialog.getByRole("combobox", { name: "Tipo de serviço" }).getAttribute("data-choice-value"), "Outro serviço");
        await page.screenshot({ path: "artifacts/eut-r18/" + width + "-privacy-intent.png" });
        await dialog.getByRole("button", { name: "Fechar atendimento" }).click();
        await dialog.waitFor({ state: "hidden" });
        assert.equal(page.url(), origin);
        assert(await privacy.evaluate(el => document.activeElement === el), "privacy CTA focus not returned");
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 4), "horizontal overflow");
        console.log("R18 candidate PASS", width, "context, scoped draft resume, privacy separation, keyboard, UF, Escape, focus, scroll, reduced motion; no submission");
        // R8: the service-page action is in the hero; the contextual draft
        // is shared by the guide/FAQ but isolated from another category.
        const serviceRoute = base + "/servicos/cftv";
        const serviceResponse = await page.goto(serviceRoute, { waitUntil: "domcontentloaded", timeout: 60000 });
        assert(serviceResponse && serviceResponse.ok(), "CFTV service candidate not available");
        await page.waitForLoadState("networkidle", { timeout: 60000 });
        await page.waitForTimeout(1200);
        const categoryHero = page.locator("main header").filter({ has: page.getByRole("heading", { name: "Como você quer continuar?" }) });
        const categoryTrigger = categoryHero.getByRole("button", { name: "Descrever meu problema →", exact: true });
        await categoryTrigger.waitFor({ state: "visible", timeout: 30000 });
        const directory = categoryHero.getByRole("link", { name: "Buscar todos os profissionais desta categoria →", exact: true });
        assert.equal(new URL(await directory.getAttribute("href"), base).searchParams.get("especialidade"), "cftv");
        assert(await categoryTrigger.evaluate(el => el.getBoundingClientRect().height >= 44), "service CTA touch target");
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 4), "service page horizontal overflow");
        await page.screenshot({ path: "artifacts/eut-r18/" + width + "-r8-service-hero.png" });
        await categoryTrigger.click();
        const selected = dialog.getByRole("combobox", { name: "Tipo de serviço" });
        await selected.waitFor({ state: "visible" });
        assert.equal(await selected.getAttribute("data-choice-value"), "CFTV e segurança");
        assert.equal(page.url(), serviceRoute);
        const issue = dialog.getByRole("textbox", { name: /Qual problema/ });
        assert.equal(await issue.inputValue(), "");
        await issue.fill("Câmera de teste não mostra imagem no aplicativo");
        await dialog.getByRole("button", { name: "Continuar", exact: true }).click();
        await dialog.getByRole("checkbox").waitFor({ state: "visible" });
        assert.equal(await dialog.getByRole("checkbox").isChecked(), false);
        await dialog.getByRole("button", { name: "Fechar atendimento" }).click();
        await dialog.waitFor({ state: "hidden" });
        assert(await categoryTrigger.evaluate(el => document.activeElement === el), "service CTA focus not returned");
        const networks = base + "/servicos/redes";
        const networksResponse = await page.goto(networks, { waitUntil: "domcontentloaded", timeout: 60000 });
        assert(networksResponse && networksResponse.ok(), "network service candidate not available");
        await page.waitForLoadState("networkidle", { timeout: 60000 });
        await page.waitForTimeout(1200);
        await page.locator("main header").getByRole("button", { name: "Descrever meu problema →", exact: true }).click();
        await selected.waitFor({ state: "visible" });
        assert.equal(await selected.getAttribute("data-choice-value"), "Redes e Wi-Fi");
        assert.equal(await issue.inputValue(), "");
        await dialog.getByRole("button", { name: "Fechar atendimento" }).click();
        await dialog.waitFor({ state: "hidden" });
        await page.goto(serviceRoute, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForLoadState("networkidle", { timeout: 60000 });
        await page.waitForTimeout(1200);
        // Re-open the contextual CTA inside the editorial body, not the hero.
        await page.getByRole("navigation", { name: "Assuntos desta especialidade" }).getByRole("button", { name: "Descrever meu problema →" }).click();
        await dialog.getByRole("checkbox").waitFor({ state: "visible" });
        assert.equal(await dialog.getByRole("checkbox").isChecked(), false);
        await dialog.getByRole("button", { name: "Voltar ao problema" }).click();
        assert.equal(await selected.getAttribute("data-choice-value"), "CFTV e segurança");
        assert.equal(await issue.inputValue(), "Câmera de teste não mostra imagem no aplicativo");
        await page.screenshot({ path: "artifacts/eut-r18/" + width + "-r8-service-resume.png" });
        await dialog.getByRole("button", { name: "Fechar atendimento" }).click();
        await dialog.waitFor({ state: "hidden" });
        console.log("R8 candidate PASS", width, "hero, filtered directory, category defaults, isolated drafts, guide resume, unchecked consent, focus and reduced motion; no submission");
      } catch (error) {
        console.error("R18 candidate failed at width", width, "URL", page.url());
        await page.screenshot({ path: "artifacts/eut-r18/" + width + "-failure.png" }).catch(() => {});
        throw error;
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
