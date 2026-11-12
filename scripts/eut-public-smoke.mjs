#!/usr/bin/env node
// Read-only HTTP smoke: official hosts, real statuses, SSR OG metadata and social JPG.
// Never authenticates, alters DNS, deploys, or accesses private data.
const allowed = new Set([
  "https://encontreumtecnico.vercel.app",
  "https://www.encontreumtecnico.com.br",
  "https://encontreumtecnico.com",
  "https://www.encontreumtecnico.com.br",
  "https://encontreumtecnico.com.br",
]);
const rawOrigin = process.env.EUT_SMOKE_ORIGIN || "https://www.encontreumtecnico.com.br";
const origin = new URL(rawOrigin).origin;
if (!allowed.has(origin) || rawOrigin !== origin) {
  throw new Error("EUT_SMOKE_ORIGIN deve ser a origem oficial sem caminho ou credenciais.");
}
const socialImage = "https://www.encontreumtecnico.com.br/social-preview.jpg";
const routes = [
  ["/", 200], ["/entrar", 200], ["/tecnicos", 200],
  ["/area-tecnico", 200], ["/area-cliente", 200],
  ["/reivindicar-cadastro", 200], ["/sitemap.xml", 200],
  ["/faq", 200], ["/servicos", 200],
  ["/social-preview.jpg", 200],
  ["/rota-inexistente-eut-cutover-check-404", 404],
  ["/tecnicos/00000000-0000-0000-0000-000000000000", 404],
];
const findings = [];
function hasSocialMetadata(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  return ["og:image", "twitter:image"].every((key) => tags.some((tag) =>
    (tag.includes('property="' + key + '"') || tag.includes('name="' + key + '"')) &&
    tag.includes('content="' + socialImage + '"'),
  ));
}
async function probe(path, expected) {
  let url = new URL(path, origin);
  try {
    // Vercel's default alias redirects to the official www host. Accept ONLY
    // redirects between exact allowlisted hosts, preserving the requested path.
    for (let redirects = 0; redirects < 4; redirects++) {
      const response = await fetch(url, {
        method: "GET", redirect: "manual", cache: "no-store",
        signal: AbortSignal.timeout(14000),
        headers: { "User-Agent": "EUT-Readiness-Probe/1.0", Accept: "*/*" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { path, status: response.status, expected, ok: false, reason: "redirect sem destino" };
        const next = new URL(location, url);
        if (!allowed.has(next.origin) || next.pathname !== new URL(path, origin).pathname) {
          return { path, status: response.status, expected, ok: false, reason: "redirect inesperado ou externo" };
        }
        url = next;
        continue;
      }
      const type = response.headers.get("content-type") || "";
      const formatOk = path === "/sitemap.xml" ? /xml|text\/plain/i.test(type)
        : path.endsWith(".jpg") ? /image\/jpeg/i.test(type)
        : expected !== 200 || /text\/html/i.test(type);
      // Validate the HTML received by a link-sharing bot, without executing JS.
      const socialOk = response.status !== 200 || path === "/sitemap.xml" || path.endsWith(".jpg")
        || hasSocialMetadata(await response.text());
      const ok = response.status === expected && formatOk && socialOk;
      return { path, status: response.status, expected, ok,
        reason: ok ? "OK" : !formatOk ? "MIME incorreto" :
          !socialOk ? "og:image / twitter:image ausente do HTML SSR" : "status inesperado" };
    }
    return { path, status: null, expected, ok: false, reason: "excesso de redirects" };
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
console.log("GATE HTTP+SOCIAL " + passed + "/" + findings.length +
  ". Nao prova Google OAuth, atendimento real, RLS ou paridade WordPress.");
if (process.env.GITHUB_STEP_SUMMARY) {
  const fs = await import("node:fs/promises");
  const lines = [
    "## EUT — HTTP e imagem social SSR (somente leitura)",
    "Origem: " + origin,
    "| Pagina | HTTP | Esperado | Resultado |",
    "| --- | --- | --- | --- |",
    ...findings.map(f => "| " + f.path + " | " + (f.status ?? "falha de rede") +
      " | " + f.expected + " | " + (f.ok ? "OK" : "FALHOU: " + f.reason) + " |"),
    "",
    "Nao autoriza DNS: requer OAuth, primeiro tecnico/cliente, backup e rollback.",
  ];
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}
if (passed !== findings.length) process.exitCode = 1;
