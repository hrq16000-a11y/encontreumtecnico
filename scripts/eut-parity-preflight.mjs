import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (file) => readFileSync(file, "utf8");
const vercel = JSON.parse(read("vercel.json"));
assert.equal(vercel.git?.deploymentEnabled, false,
  "Deploy automático deve estar DESATIVADO; publicação somente manual e homologada.");

const paths = [
  ["src/routes/entrar.tsx", [
    "eut_my_legacy_account", "eut_confirm_my_legacy_account",
    "signInWithGoogle",
  ]],
  ["src/routes/reivindicar-cadastro.tsx", [
    "normalizeWpPostId", "legacy_profile_claims", "eligibleToClaim",
  ]],
  ["src/routes/tecnicos.index.tsx", [
    "canShowLegacyArchive(search)", "listApprovedTechnicians",
    "SponsoredPublicSlot", "uf:", "bairro:",
  ]],
  ["src/components/legacy-public-archive.tsx", [
    "legacy_public_archive", "wp_post_id", "Contato indisponível",
    "/reivindicar-cadastro?wp=",
  ]],
  ["src/lib/legacy-archive-filters.ts", [
    "!search.servico?.trim()", "!search.uf?.trim()",
    "!search.bairro?.trim()", "!search.cidade?.trim()",
  ]],
  ["src/lib/legacy-avatar-urls.ts", [
    "transferredAvatars", "wp-candidate-530.webp",
  ]],
  ["src/routes/sitemap[.]xml.ts", [
    "https://www.encontreumtecnico.com", "/tecnicos",
  ]],
];
for (const [path, evidence] of paths) {
  const code = read(path);
  for (const token of evidence) {
    assert.ok(code.includes(token), `Paridade regressiva: ${path} sem ${token}`);
  }
}

const sql = read("docs/sql/eut-wordpress-parity-readonly.sql");
for (const marker of [
  "wp_contas_importadas", "wp_tecnicos_aguardando_titular",
  "wp_clientes_aguardando_titular", "media_placeholder_ignorado",
  "media_hash_verificado", "demos_excluidas", "acervo_com_contato_habilitado_ALERTA",
  "rotas_legadas_em_validacao", "tecnicos_ativos",
]) {
  assert.ok(sql.includes(marker), `Faltando indicador de paridade: ${marker}`);
}
assert.equal(/\b(?:INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|CREATE\s+(?:TABLE|FUNCTION)|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE\s+TABLE)\b/i.test(sql),
  false, "Relatório de paridade deve ser SOMENTE LEITURA.");

const docs = read("docs/migration/WORDPRESS-PARIDADE-E-RELEASE.md");
for (const criterion of [
  "913", "655", "434", "316", "114", "404", "508",
  "GitHub Actions", "HTTP 402", "rollback",
]) {
  assert.ok(docs.includes(criterion), `Plano de continuidade faltando: ${criterion}`);
}
console.log("GIT-FIRST/PARIDADE: PASS — política sem deploy automático, fluxos preservados, filtros legados seguros.");
console.log("ATENÇÃO: PASS de código NÃO equivale a E2E com técnicos/clientes ou cutover aprovado.");
