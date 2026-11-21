/* QA of the #438 combined Home locally in Chromium, not a production deployment.
 * Tests are synthetic. An allowlist blocks ALL remote network and ALL mutations.
 * No Supabase records, submissions, auth, contacts, real lookups or live traffic.
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:4173";
const OUT = process.env.EUT_HOME_QA_DIR || path.resolve("artifacts/home-438");
const CATEGORIES = [
  { slug: "computadores", label: "Computadores e notebooks", description: "Categoria de teste" },
  { slug: "redes", label: "Redes e conectividade", description: "Categoria de teste" },
  { slug: "cftv", label: "CFTV", description: "Categoria de teste" },
];
const CITIES = [
  { id: 4106902, name: "Curitiba", uf: "PR", latitude: -25.43, longitude: -49.27 },
  { id: 4125506, name: "São José dos Pinhais", uf: "PR", latitude: -25.53, longitude: -49.21 },
  { id: 5002704, name: "Campo Grande", uf: "MS", latitude: -20.45, longitude: -54.62 },
  { id: 2701506, name: "Campo Grande", uf: "AL", latitude: -9.95, longitude: -36.79 },
];
const expectedParams = {
  especialidade: "computadores", cidade: "Curitiba", uf: "PR",
  bairro: "", regiao: "", prioridade: "regiao",
};
fs.mkdirSync(OUT, { recursive: true });
async function exercise(browser, width, height) {
  const folder = path.join(OUT, String(width));
  fs.mkdirSync(folder, { recursive: true });
  const context = await browser.newContext({
    locale: "pt-BR", viewport: { width, height }, reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const reads = new Set(), denied = [];
  let stage = "initial", sent = 0;
  await context.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method().toUpperCase();
    const pathname = url.pathname;
    // Every mutation, even to localhost, fails closed. No writes are allowed.
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      sent++;
      denied.push(method + " " + url.origin + pathname);
      return route.abort("blockedbyclient");
    }
    if (url.hostname === "pqtzhctvjbfcunmrvxne.supabase.co") {
      if (method === "GET" && pathname.endsWith("/rest/v1/eut_service_categories")) {
        reads.add("categories");
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(CATEGORIES), headers: { "access-control-allow-origin": "*" } });
      }
      if (method === "GET" && pathname.endsWith("/rest/v1/eut_ibge_municipalities")) {
        reads.add("municipalities");
        const uf = (url.searchParams.get("uf") || "").replace(/^eq\./, "");
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(CITIES.filter(city => city.uf === uf)),
          headers: { "access-control-allow-origin": "*" } });
      }
      denied.push("unmocked " + method + " " + pathname);
      return route.abort("blockedbyclient");
    }
    if (url.origin !== BASE) {
      // No external fonts/analytics or advertising traffic. Only local app
      // and synthetic public catalog fixtures are accessible.
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  async function snap(name) {
    await page.screenshot({
      path: path.join(folder, name + ".png"), animations: "disabled",
      fullPage: false,
    });
  }
  function save(name, data) {
    fs.writeFileSync(path.join(folder, name + ".json"), JSON.stringify(data, null, 2) + "\n");
  }
  async function assertLayout() {
    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const form = document.querySelector("main form");
      const specialty = document.getElementById("busca-especialidade");
      const city = document.getElementById("busca-cidade");
      const uf = document.getElementById("busca-uf");
      const ibge = document.getElementById("busca-cidade-ibge");
      const submit = form?.querySelector('button[type="submit"]');
      const targets = Object.fromEntries([["specialty", specialty],["city", city],
        ["uf", uf],["ibge", ibge],["submit", submit]].map(([k, el]) => {
        const box = el?.getBoundingClientRect();
        return [k, box && { width: box.width, height: box.height,
          left: box.left, right: box.right }];
      }));
      return { width: root.clientWidth, docWidth: root.scrollWidth, targets };
    });
    assert.equal(metrics.width, width, "Wrong CSS viewport");
    assert(metrics.docWidth <= width + 2, "Horizontal scroll overflow");
    for (const [name, target] of Object.entries(metrics.targets)) {
      assert(target && target.width >= 44 && target.height >= 44,
        name + " touch target below 44px");
      assert(target.left >= -1 && target.right <= width + 1,
        name + " clipped horizontally at " + width + "px");
    }
    return metrics;
  }
  try {
    stage = "load";
    const res = await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(res?.status(), 200, "Local Home did not return HTTP 200");
    const specialty = page.locator("#busca-especialidade");
    const uf = page.locator("#busca-uf");
    const city = page.locator("#busca-cidade");
    const ibge = page.locator("#busca-cidade-ibge");
    const submit = page.locator('main form button[type="submit"]');
    await specialty.waitFor({ state: "visible", timeout: 30000 });
    await page.locator('#busca-especialidade option[value="computadores"]')
      .waitFor({ state: "attached", timeout: 30000 });
    assert.equal(await specialty.inputValue(), "Todas");
    const layoutInitial = await assertLayout();
    await snap("01-home-vazia");

    stage = "unconfirmed";
    await uf.selectOption("PR");
    await city.fill("Curitiba");
    await page.locator('#busca-cidade-ibge option[value="4106902"]')
      .waitFor({ state: "attached", timeout: 30000 });
    await specialty.selectOption("computadores");
    await submit.click();
    assert.equal(new URL(page.url()).pathname, "/", "Unconfirmed city navigated");
    await page.getByRole("alert").filter({ hasText: "Confirme o município" })
      .waitFor({ state: "visible" });
    await snap("02-cidade-nao-confirmada");

    stage = "confirmed";
    await ibge.selectOption("4106902");
    await page.getByText(/Município confirmado: Curitiba\/PR/).waitFor({state:"visible"});
    assert.equal(await specialty.inputValue(), "computadores");
    await page.waitForFunction(() => {
      try {
        return JSON.parse(sessionStorage.getItem("eut-ui-text-v1:home"))?.values?.cityid === "4106902";
      } catch { return false; }
    });
    await snap("03-categoria-e-ibge-confirmados");

    // Changing category must not erase the official municipality identifier.
    await specialty.selectOption("redes");
    await specialty.selectOption("computadores");
    const saved = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("eut-ui-text-v1:home") || "null")?.values);
    assert.equal(saved?.cityid, "4106902", "Category change dropped cityid");
    assert.equal(saved?.uf, "PR");
    assert.equal(saved?.specialty, "computadores");

    stage = "restore";
    await page.reload({ waitUntil: "domcontentloaded" });
    await specialty.waitFor({ state: "visible" });
    await page.locator('#busca-especialidade option[value="computadores"]')
      .waitFor({ state: "attached", timeout: 30000 });
    await page.locator('#busca-cidade-ibge option[value="4106902"]')
      .waitFor({ state: "attached", timeout: 30000 });
    await page.waitForFunction(() =>
      document.querySelector("#busca-especialidade")?.value === "computadores" &&
      document.querySelector("#busca-uf")?.value === "PR" &&
      document.querySelector("#busca-cidade")?.value === "Curitiba" &&
      document.querySelector("#busca-cidade-ibge")?.value === "4106902");
    const layoutRestored = await assertLayout();
    await snap("04-rascunho-restaurado");

    stage = "navigation";
    await submit.click();
    await page.waitForURL(url =>
      url.pathname.replace(/\/$/, "") === "/tecnicos", {timeout:20000});
    const next = new URL(page.url());
    for (const [key, value] of Object.entries(expectedParams)) {
      assert.equal(next.searchParams.get(key), value, "Lost query filter " + key);
    }
    for (const forbidden of ["telefone", "email", "latitude", "longitude", "cityid"]) {
      assert(!next.searchParams.has(forbidden), "Private or internal key in URL " + forbidden);
    }
    await snap("05-busca-filtrada");
    assert.equal(sent, 0, "A real or local mutation was attempted");
    assert(reads.has("categories") && reads.has("municipalities"),
      "Synthetic active catalog/IBGE fixtures were not both read");
    assert(!denied.some(t => t.startsWith("unmocked")),
      "Unexpected Supabase network read attempted");
    const result={viewport:width,height,status:"PASS",mode:"local-source-438",
      filters:Object.fromEntries(next.searchParams.entries()),blockedMutations:sent,
      syntheticReads:[...reads].sort(),initialLayout:layoutInitial,restoredLayout:layoutRestored};
    save("result",result);
    console.log("PASS HOME438 "+width+"px "+JSON.stringify(result));
  } catch (error) {
    try { await snap("FAIL-"+stage); } catch {}
    save("failure",{viewport:width,height,stage,error:String(error),
      sent,denied,reads:[...reads]});
    throw error;
  } finally { await context.close(); }
}
async function main(){
  const browser=await chromium.launch({headless:true});
  const fails=[];
  try {
    for(const [width,height] of [[390,844],[1440,900]]) {
      try { await exercise(browser,width,height); }
      catch(e){ fails.push(width+": "+String(e)); console.error("FAIL HOME438 "+width+"px "+String(e)); }
    }
  } finally {await browser.close();}
  if(fails.length){ console.error("FAILURES "+fails.join(" | ")); process.exitCode=1; }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
