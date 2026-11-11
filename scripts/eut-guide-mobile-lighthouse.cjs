#!/usr/bin/env node
/** Baseline real Chrome mobile Lighthouse against LIVE public guides.
 * Pure measurement: never submits requests, changes data or triggers a deployment.
 * Lab metrics (incl. TBT) are NOT field INP/CrUX.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const origin = "https://www.encontreumtecnico.com.br";
const slugs = [
  "computador-lento-o-que-verificar",
  "instalacao-cameras-seguranca-como-planejar",
  "wifi-caindo-sinal-fraco-como-identificar",
  "impressora-offline-fila-travada-o-que-fazer",
  "backup-arquivos-antes-manutencao-computador",
  "ar-condicionado-nao-gela-verificacoes-seguras",
];
const out = path.join(process.cwd(), "artifacts", "eut-mobile-lighthouse");
fs.mkdirSync(out, { recursive: true });

const rows = [];
for (const slug of slugs) {
  const url = origin + "/guias/" + slug;
  const output = path.join(out, slug + ".json");
  console.log("\nRunning mobile Lighthouse: " + url);
  try {
    execFileSync("lighthouse", [
      url, "--output=json", "--output-path=" + output,
      "--only-categories=performance,accessibility,best-practices,seo",
      "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage --disable-gpu",
      "--form-factor=mobile", "--throttling-method=simulate", "--quiet",
      "--max-wait-for-load=55000",
    ], { timeout: 120000, stdio: ["ignore", "pipe", "pipe"] });
    const report = JSON.parse(fs.readFileSync(output, "utf8"));
    const audits = report.audits || {};
    const metric = (key) => audits[key]?.numericValue ?? null;
    const score = (key) => report.categories?.[key]?.score ?? null;
    const row = {
      slug,
      requestedUrl: url,
      finalUrl: report.finalUrl,
      fetchTime: report.fetchTime,
      lighthouseVersion: report.lighthouseVersion,
      performance: score("performance"),
      accessibility: score("accessibility"),
      seo: score("seo"),
      bestPractices: score("best-practices"),
      lcpMs: metric("largest-contentful-paint"),
      cls: metric("cumulative-layout-shift"),
      fcpMs: metric("first-contentful-paint"),
      tbtMs: metric("total-blocking-time"),
      speedIndexMs: metric("speed-index"),
      lcpElement: (audits["largest-contentful-paint-element"]?.details?.items || [])
        .slice(0, 1).map(x => x.node?.snippet || "").join("").slice(0, 350),
      problems: Object.entries(audits)
        .filter(([,a]) => a && a.score !== null && a.score < 0.9 && a.details?.type === "opportunity")
        .map(([id,a]) => ({id, title:a.title, savingsMs:a.details?.overallSavingsMs ?? null}))
        .sort((a,b) => (b.savingsMs || 0) - (a.savingsMs || 0))
        .slice(0, 8),
    };
    rows.push(row);
    console.log("MOBILE_RESULT " + JSON.stringify(row));
  } catch (error) {
    const row = {slug, error: String(error), stderr: String(error.stderr || "").slice(0, 1600)};
    rows.push(row);
    console.error("MOBILE_ERROR " + JSON.stringify(row));
  }
}
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify({
  mode: "Lighthouse mobile simulated throttling, lab (not CrUX)",
  collectedAt: new Date().toISOString(),
  origin,
  results: rows,
}, null, 2));
console.log("\nCompleted " + rows.filter(r => !r.error).length + " / " + slugs.length + " Lighthouse mobile runs.");
if (rows.some(r => r.error)) process.exitCode = 1;
