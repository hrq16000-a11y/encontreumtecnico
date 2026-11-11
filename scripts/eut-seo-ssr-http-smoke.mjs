#!/usr/bin/env node
// Manual, opt-in HTTP smoke AFTER a protected preview exists. No deploy or mutations.
// Environment: EUT_SEO_SMOKE_ORIGIN=https://encontreumtecnico-...vercel.app
// EUT_SEO_CITY_PATH=/cidades/pr/jardim-alegre
// EUT_SEO_CATEGORY_PATH=/categorias/...
// EUT_SEO_PROFILE_PATH=/tecnicos/...
const provided = process.env.EUT_SEO_SMOKE_ORIGIN;
const city = process.env.EUT_SEO_CITY_PATH;
const category = process.env.EUT_SEO_CATEGORY_PATH;
const profile = process.env.EUT_SEO_PROFILE_PATH;
if (!provided || !city || !category || !profile) {
  throw new Error("Defina origem do preview e paths REAIS de cidade, categoria e perfil (nada é consultado automaticamente).");
}
const origin = new URL(provided);
if (
  origin.protocol !== "https:" ||
  origin.username || origin.password || origin.search || origin.hash ||
  origin.pathname !== "/" || provided !== origin.origin && provided !== origin.origin + "/" ||
  !(
    ["www.encontreumtecnico.com.br", "encontreumtecnico.vercel.app"].includes(origin.hostname) ||
    /^encontreumtecnico(?:-[a-z0-9-]+)?\.vercel\.app$/.test(origin.hostname)
  )
) {
  throw new Error("Origem de homologação fora da lista permitida.");
}
const cases = [
  [city, 200, "html", true],
  [category, 200, "html", true],
  [profile, 200, "html", true],
  ["/cidades/pr/cidade-ficticia-homologacao", 404, "html", false],
  ["/categorias/categoria-ficticia-homologacao", 404, "html", false],
  ["/sitemap.xml", 200, "index", false],
  ["/sitemaps/base.xml", 200, "xml", false],
  ["/sitemaps/cidades.xml", 200, "xml", false],
  ["/sitemaps/categorias.xml", 200, "xml", false],
  ["/sitemaps/tecnicos/1.xml", 200, "xml", false],
  ["/sitemaps/tecnicos/999999.xml", 404, "xml", false],
];
const validPath = /^\/[a-z0-9][a-z0-9/-]*$/;
for (const path of [city, category, profile]) {
  if (!validPath.test(path) || path.includes("//") || path.includes("..")) {
    throw new Error("Caminho não canônico na configuração do smoke: " + path);
  }
}
const expectedCanonical = "https://www.encontreumtecnico.com.br";
const errors = [];
for (const [path, expected, format, assertCanonical] of cases) {
  try {
    const response = await fetch(new URL(path, origin), {
      headers: { Accept: format === "html" ? "text/html" : "application/xml" },
      redirect: "manual", signal: AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    const problems = [];
    if (response.status !== expected) problems.push("HTTP " + response.status + ", esperado " + expected);
    if (response.status === 200) {
      if (format === "index") {
        if (!text.includes("<sitemapindex") || !text.includes(expectedCanonical + "/sitemaps/base.xml"))
          problems.push("índice ausente ou host incorreto");
      } else if (format === "xml" && !text.includes("<urlset")) problems.push("XML de URLs ausente");
      else if (format === "html") {
        if (!text.includes("<h1")) problems.push("HTML SSR sem H1");
        if (path !== profile && !text.includes('href="/tecnicos/')) problems.push("HTML SSR sem interlinks para técnico");
        if (assertCanonical) {
          const expectedUrl = expectedCanonical + path;
          const canonicalTag = text.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] ||
            text.match(/<link\b[^>]*href=["'][^"']+["'][^>]*rel=["']canonical["'][^>]*>/i)?.[0] || "";
          if (!canonicalTag.includes(expectedUrl)) problems.push("canonical ausente/incorreto");
          if (/name=["']robots["'][^>]*content=["']noindex/i.test(text)) problems.push("noindex indevido");
        }
      }
    }
    const pass = problems.length === 0;
    if (!pass) errors.push({ path, problems });
    console.log((pass ? "PASS " : "FAIL ") + path + " — HTTP " + response.status +
      (pass ? "" : " — " + problems.join("; ")));
  } catch (e) {
    errors.push({ path, problems: [e instanceof Error ? e.message : "falha de rede"] });
    console.log("FAIL " + path + " — sem resposta verificável");
  }
}
if (errors.length) {
  console.error("Homologação HTTP bloqueada em " + errors.length + " endpoints; nenhuma mudança foi feita.");
  process.exitCode = 1;
} else {
  console.log("HTTP/SSR/SEO aprovado nesta origem. Isso não equivale à aprovação de produção ou indexação pelo Google.");
}
