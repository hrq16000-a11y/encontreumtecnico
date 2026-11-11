/* Public, read-only Chromium smoke for the currently published Encontre um Técnico.
 * It does not authenticate, submit leads, acquire contacts or modify private data.
 * Mobile uses Chromium device emulation (NOT native Safari or a physical phone).
 */
const assert = require("node:assert/strict");
const { chromium, devices } = require("playwright");

const BASE = process.env.EUT_BASE_URL || "https://www.encontreumtecnico.com.br";
const route = (path) => new URL(path, BASE).toString();

async function visit(page, path) {
  const response = await page.goto(route(path), { waitUntil: "domcontentloaded", timeout: 60000 });
  assert(response, "No HTTP response for " + path);
  assert(response.status() >= 200 && response.status() < 400,
    path + " returned HTTP " + response.status());
  await page.locator("body").waitFor({ state: "visible", timeout: 20000 });
  // Diagnostic for SSR hydration races: wait for the client runtime to settle
  // before entering any user text. If this resolves losses, hydration is implicated.
  await page.waitForTimeout(1200);
}

async function eventuallyValue(field, expected, label) {
  // SSR may initially render an empty input before React rehydrates it.
  // Count an actual regression only if it remains wrong after hydration.
  for (let retry = 0; retry < 35; retry++) {
    if (await field.inputValue() === expected) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.equal(await field.inputValue(), expected, label);
}

async function preserveHome2(page, context) {
  await visit(page, "/home2");
  const field = page.locator('input[placeholder="Em qual cidade?"]');
  await field.waitFor({ state: "visible", timeout: 20000 });
  await field.fill("São José dos Pinhais");
  console.log("DIAG Home2 draft after input:", await page.evaluate(() =>
    sessionStorage.getItem("eut-ui-text-v1:home2")));
  const background = await context.newPage();
  await background.bringToFront();
  await page.waitForTimeout(850); // Exceeds existing filter debounce interval.
  await page.bringToFront();
  assert.equal(await field.inputValue(), "São José dos Pinhais", "Home2 loses city on tab switch");
  await background.close();
  await visit(page, "/como-funciona");
  await page.goBack({ waitUntil: "domcontentloaded" });
  await eventuallyValue(field, "São José dos Pinhais", "Home2 loses city on browser back");
  await page.reload({ waitUntil: "domcontentloaded" });
  await eventuallyValue(field, "São José dos Pinhais", "Home2 loses city on reload");
}

async function preserveGallery(page) {
  await visit(page, "/lp2/galeria");
  const query = page.locator('input[placeholder="Ex.: notebook, redes"]');
  const city = page.locator('input[placeholder="Município (ex.: Curitiba)"]');
  await query.waitFor({ state: "visible", timeout: 20000 });
  await query.fill("impressora e notebook");
  await city.fill("Pinhais");
  console.log("DIAG LP2 draft after input:", await page.evaluate(() =>
    sessionStorage.getItem("eut-ui-text-v1:lp2-gallery")));
  await visit(page, "/como-funciona");
  await page.goBack({ waitUntil: "domcontentloaded" });
  await eventuallyValue(query, "impressora e notebook", "LP2 loses incomplete specialty");
  await eventuallyValue(city, "Pinhais", "LP2 loses incomplete city");
  await page.reload({ waitUntil: "domcontentloaded" });
  await eventuallyValue(city, "Pinhais", "LP2 loses city after reload");
}

async function preserveSearch(page) {
  await visit(page, "/tecnicos");
  const field = page.locator("#filtro-bairro");
  await field.waitFor({ state: "visible", timeout: 30000 });
  await field.fill("Boqueirão");
  console.log("DIAG /tecnicos pending after input:", await page.evaluate(() =>
    sessionStorage.getItem("eut-filter-pending-v1:filtro-bairro")));
  await visit(page, "/como-funciona");
  await page.goBack({ waitUntil: "domcontentloaded" });
  await field.waitFor({ state: "visible", timeout: 20000 });
  await eventuallyValue(field, "Boqueirão", "Search loses pending neighborhood on history");
}

async function preserveAssistance(page) {
  await visit(page, "/contato");
  await page.getByRole("button", { name: /Iniciar atendimento guiado/i }).click();
  await page.getByRole("button", { name: /Quero ajuda da equipe/i }).click();
  const problem = page.getByLabel("Qual problema está acontecendo?");
  await problem.waitFor({ state: "visible", timeout: 12000 });
  await page.getByLabel("Tipo de serviço").selectOption({ label: "Redes e Wi-Fi" });
  await problem.fill("O notebook não conecta à rede Wi-Fi há dois dias");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Iniciar atendimento guiado/i }).click();
  const recovered = page.getByLabel("Qual problema está acontecendo?");
  await recovered.waitFor({ state: "visible", timeout: 12000 });
  assert.equal(await recovered.inputValue(), "O notebook não conecta à rede Wi-Fi há dois dias",
    "Assistance funnel loses incomplete description");
  // Intentionally never send the request or check consent: no production writes.
}

async function anonymousPrivatePanels(page) {
  // Real Chromium against production, without an auth token. Read only.
  // Never click buttons that could create, approve, block, pay or edit anything.
  const checks = [
    { path: "/area-cliente", marker: "Entre com uma conta de cliente", forbidden: "Registrar minha necessidade" },
    { path: "/area-tecnico", marker: "Entre para acessar seu painel", forbidden: "Cadastro guiado" },
    { path: "/admin/tecnicos", marker: "Entre com uma conta de administrador", forbidden: "Gestão administrativa de técnicos" },
  ];
  for (const check of checks) {
    await visit(page, check.path);
    await page.waitForFunction((text) => document.body.innerText.includes(text), check.marker, { timeout: 20000 });
    const body = await page.locator("body").innerText();
    assert(!body.includes(check.forbidden), check.path + " shows authenticated editor to a visitor");
    assert((await page.locator('input[type="password"]').count()) === 0,
      check.path + " unexpectedly requests password in a private panel");
  }
}


async function publicMobileNeighborhoods(page) {
  // Real Chromium rendering with a mobile context, but not a physical Android
  // or iPhone. Only public URLs; never authenticate or submit a form.
  for (const width of [320, 375, 390, 768]) {
    await page.setViewportSize({ width, height: 812 });
    for (const path of ["/", "/tecnicos", "/lp2/galeria"]) {
      await visit(page, path);
      const size = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      console.log("MOBILE_WIDTH", JSON.stringify({ width, path, ...size }));
      assert(size.content <= size.viewport + 4,
        path + " has horizontal overflow at " + width + "px: " +
        size.content + " > " + size.viewport);
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await visit(page, "/tecnicos");
  const state = page.locator("#filtro-uf");
  const city = page.locator("#filtro-cidade");
  const neighborhood = page.locator("#filtro-bairro");
  for (const [field, name] of [
    [state, "UF"], [city, "Município"], [neighborhood, "Bairro"],
  ]) {
    const box = await field.boundingBox();
    assert(box && box.width >= 44, name + " is not touchable/visible");
    console.log("MOBILE_TOUCH_TARGET", JSON.stringify({
      name, width: box.width, height: box.height,
      // A pre-release smoke against production measures touch height.
      // The PR's source gate verifies the 44px correction before deploy.
      needsHeightFix: box.height < 44,
    }));
  }
  await state.selectOption("PR");
  await city.fill("São José dos Pinhais");
  const suggestions = page.locator("#eut-bairro-diretorio");
  await suggestions.waitFor({ state: "attached", timeout: 20000 });
  const labels = await suggestions.locator("option").allTextContents();
  assert(labels.includes("Itália"), "Official SJP neighborhood suggestions missing");
  assert(!labels.includes("Jardim Itália"),
    "The public catalog should not invent the owner's neighborhood label");
  await neighborhood.fill("Jardim Itália");
  await page.waitForTimeout(700);
  assert.equal(await neighborhood.inputValue(), "Jardim Itália",
    "Free-form neighborhood overwritten after client search debounce");
  console.log("PASS mobile public filters: IBGE municipality, manual bairro and no overflow");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const desktop = await browser.newContext({ locale: "pt-BR", viewport: { width: 1365, height: 900 } });
    for (const [name, action] of [
      ["desktop: Home2 tabs/back/reload", preserveHome2],
      ["desktop: LP2 gallery/back/reload", preserveGallery],
      ["desktop: /tecnicos pending search", preserveSearch],
      ["desktop: assistance draft/reload", preserveAssistance],
      ["desktop: anonymous private panel boundaries", anonymousPrivatePanels],
    ]) {
      const page = await desktop.newPage();
      page.setDefaultTimeout(20000);
      try { await action(page, desktop); console.log("PASS " + name); }
      catch (error) { failures.push(name + ": " + error.message); console.error("FAIL " + name + ": " + error.message); }
      finally { await page.close(); }
    }
    await desktop.close();
    const mobile = await browser.newContext({ ...devices["iPhone 13"], locale: "pt-BR" });
    const page = await mobile.newPage();
    page.setDefaultTimeout(20000);
    try { await preserveHome2(page, mobile); console.log("PASS mobile Chromium emulation: Home2 tabs/back/reload"); }
    catch (error) { failures.push("mobile Chromium Home2: " + error.message); console.error("FAIL mobile Home2: " + error.message); }
    try { await publicMobileNeighborhoods(page); console.log("PASS mobile Chromium: neighborhood, widths and filters"); }
    catch (error) { failures.push("mobile Chromium public geography: " + error.message); console.error("FAIL mobile geography: " + error.message); }
    finally { await mobile.close(); }
  } finally { await browser.close(); }
  if (failures.length) {
    console.error("\nBrowser checks not homologated:\n" + failures.map(f => " - " + f).join("\n"));
    process.exitCode = 1;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
