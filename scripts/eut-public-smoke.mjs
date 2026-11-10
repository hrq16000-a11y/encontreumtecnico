#!/usr/bin/env node
// HTTP SOMENTE LEITURA no host Vercel. Nao faz login, deploy ou DNS.
// EUT_SMOKE_ORIGIN permite apenas dominios oficiais sem caminhos adicionais.
const allowed = new Set([
  "https://encontreumtecnico.vercel.app",
  "https://www.encontreumtecnico.com",
  "https://encontreumtecnico.com",
]);
const rawOrigin = process.env.EUT_SMOKE_ORIGIN || "https://encontreumtecnico.vercel.app";
const origin = new URL(rawOrigin).origin;
if (!allowed.has(origin) || rawOrigin !== origin) {
  throw new Error("EUT_SMOKE_ORIGIN deve ser a origem oficial sem caminho/credenciais.");
}
const routes = [
  ["/", 200], ["/entrar", 200], ["/tecnicos", 200],
  ["/area-tecnico", 200], ["/area-cliente", 200],
  ["/reivindicar-cadastro", 200], ["/sitemap.xml", 200],
  ["/rota-inexistente-eut-cutover-check-404", 404],
];
const findings = [];
async function probe(path, expected) {
  let url = new URL(path, origin);
  let redirects = 0;
  try {
    for (;;) {
      const response = await fetch(url, {
        method: "GET", redirect: "manual", cache: "no-store",
        signal: AbortSignal.timeout(14000),
        headers: { "User-Agent": "EUT-Readiness-Probe/1.0", Accept: "*/*" },
      });
      if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get("location");
        if (!next || redirects++ >= 2)
          return { path, status: response.status, expected, ok: false, reason: "redirect indefinido" };
        const nextUrl = new URL(next, url);
        if (nextUrl.origin !== origin)
          return { path, status: response.status, expected, ok: false, reason: "redirect fora do portal" };
        url = nextUrl;
        continue;
      }
      const type = response.headers.get("content-type") || "";
      const formatOk = path !== "/sitemap.xml" || /xml|text\/plain/i.test(type);
      const ok = response.status === expected && formatOk;
      return { path, status: response.status, expected, ok,
        reason: ok ? "OK" : (!formatOk ? "sitemap nao retornou XML" : "status inesperado") };
    }
  } catch (err) {
    return { path, status: null, expected, ok: false,
      reason: err instanceof Error ? err.name : "erro de rede" };
  }
}
for (const [path, expected] of routes) {
  const item = await probe(path, expected);
  findings.push(item);
  console.log((item.ok ? "PASS " : "FAIL ") + item.path + ": " +
    (item.status ?? "indisponivel") + " (esperado " + expected + ") [" + item.reason + "]");
}
const passed = findings.filter(f => f.ok).length;
console.log("GATE HTTP " + passed + "/" + findings.length +
  ". Nao prova cadastro real, Google OAuth, RLS, imagem ou paridade WordPress.");
if (process.env.GITHUB_STEP_SUMMARY) {
  const fs = await import("node:fs/promises");
  const lines = [
    "## EUT — HTTP real (somente leitura)",
    "Origem: " + origin,
    "| Pagina | HTTP | Esperado | Resultado |",
    "| --- | --- | --- | --- |",
    ...findings.map(f => "| " + f.path + " | " + (f.status ?? "falha de rede") +
      " | " + f.expected + " | " + (f.ok ? "OK" : "FALHOU") + " |"),
    "",
    "Nao autoriza DNS: requer dois usuarios reais, pedido completo, backup e rollback.",
  ];
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}
if (passed !== findings.length) process.exitCode = 1;
