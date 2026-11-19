"use strict";

const QA_LABEL = "qa:approved";
const MERGE_LABEL = "queue:automerge";
const DASHBOARD_ISSUE = 306;
const ACCEPTED = new Set(["success", "neutral", "skipped"]);

function hasLabel(pr, name) {
  return (pr.labels || []).some((label) => label.name?.toLowerCase() === name);
}

function classify(pr, checks = [], combinedStatus = { total_count: 0 }) {
  if (pr.draft) return "Draft — aguardando revisão";
  if (pr.base.ref !== "main") return "Base não é main";
  if (pr.head.repo?.full_name !== pr.base.repo?.full_name) return "Fork externo — integração manual";
  if (!hasLabel(pr, QA_LABEL)) return "QA ainda não confirmado";
  if (!hasLabel(pr, MERGE_LABEL)) return "Aguardando autorização de auto-merge";
  if (pr.mergeable !== true) return pr.mergeable === false ? "Conflito ou merge impedido" : "GitHub ainda calcula mergeabilidade";

  const ci = checks.filter((check) => /^ci$/i.test(check.name));
  if (ci.length === 0) return "CI obrigatório não encontrado no HEAD";
  if (!ci.some((check) => check.status === "completed" && check.conclusion === "success")) {
    return "CI obrigatório pendente ou reprovado";
  }
  if (checks.some((check) => check.status !== "completed" || !ACCEPTED.has(check.conclusion))) {
    return "Existe check pendente ou reprovado";
  }
  if (combinedStatus.total_count > 0 && combinedStatus.state !== "success") {
    return "Status legado pendente ou reprovado";
  }
  return "PR pronta para integração segura";
}

async function run({ github, context, core }) {
  const { owner, repo } = context.repo;
  const info = (msg) => core.info(msg);

  for (const [name, color, description] of [
    [QA_LABEL, "1d76db", "QA funcional deste HEAD confirmado manualmente"],
    [MERGE_LABEL, "2da44e", "Autorizar integração automática após gates verdes e QA"],
  ]) {
    try {
      await github.rest.issues.createLabel({ owner, repo, name, color, description });
    } catch (error) {
      if (error.status !== 422) throw error;
    }
  }

  // Novo commit invalida a homologação anterior; nunca reutilizar QA de outro SHA.
  if (context.eventName === "pull_request_target" && context.payload.action === "synchronize") {
    const issue_number = context.payload.pull_request.number;
    try {
      await github.rest.issues.removeLabel({ owner, repo, issue_number, name: QA_LABEL });
      info(`QA revogado na PR #${issue_number} após novo commit.`);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }

  const prs = await github.paginate(github.rest.pulls.list, { owner, repo, state: "open", per_page: 100 });
  prs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const lines = [];
  let merged = 0;

  for (const pr of prs) {
    const { data: fresh } = await github.rest.pulls.get({ owner, repo, pull_number: pr.number });
    let reason = classify(fresh);

    if (reason === "CI obrigatório não encontrado no HEAD" || reason === "PR pronta para integração segura") {
      // As duas labels e a mergeabilidade já passaram antes de buscar checks.
      const checks = await github.paginate(github.rest.checks.listForRef, {
        owner, repo, ref: fresh.head.sha, per_page: 100,
      });
      const { data: combined } = await github.rest.repos.getCombinedStatusForRef({
        owner, repo, ref: fresh.head.sha,
      });
      reason = classify(fresh, checks, combined);
    }

    if (reason === "PR pronta para integração segura" && merged === 0) {
      try {
        // O SHA impede merge de commits novos ainda não homologados.
        const { data } = await github.rest.pulls.merge({
          owner, repo, pull_number: fresh.number, sha: fresh.head.sha, merge_method: "merge",
        });
        if (!data.merged) throw new Error(data.message || "GitHub não confirmou merge");
        reason = `✅ Integrada: ${data.sha.slice(0, 12)}`;
        merged += 1;
        // Merges por GITHUB_TOKEN não disparam push workflows: executar o CI da main explicitamente.
        try {
          await github.rest.actions.createWorkflowDispatch({
            owner, repo, workflow_id: "ci.yml", ref: "main",
          });
        } catch (error) {
          reason += " ⚠️ CI da main não foi disparado; verificar manualmente";
          core.warning(`Pós-merge #${fresh.number}: ${error.message}`);
        }
      } catch (error) {
        reason = `⚠️ Merge ou validação da main impedida (${error.status || "erro"}) — conferir execução`;
        core.warning(`PR #${fresh.number}: ${error.message}`);
      }
    } else if (reason === "PR pronta para integração segura") {
      reason = "Pronta; próxima execução (um merge por rodada)";
    }

    const idle = (Date.now() - new Date(fresh.updated_at).getTime()) / 3600000;
    const stale = idle >= 24 ? " ⏰ +24h" : "";
    lines.push(`- [#${fresh.number}](${fresh.html_url}) \`${fresh.head.sha.slice(0, 10)}\` — ${reason}${stale}`);
    info(`#${fresh.number}: ${reason}`);
  }

  const body = [
    "# Fila de integração — Encontre um Técnico",
    "",
    `**PRs abertas na varredura:** ${prs.length}. **Merges nesta execução:** ${merged}.`,
    "",
    ...(lines.length ? lines : ["✅ Nenhuma PR aberta."]),
    "",
    "## Política de segurança",
    "- Automerge exige **`qa:approved` + `queue:automerge`**, PR fora de Draft, CI no HEAD verde, todos os checks concluídos e sem impedimento de merge.",
    "- Novo commit remove `qa:approved`. O GitHub verifica o SHA novamente no merge. Apenas **uma PR** é integrada por execução.",
    "- Bloqueios permanecem visíveis aqui. Verificação automática a cada 30 minutos, além dos eventos das PRs; agendas GitHub podem atrasar.",
    "- Vercel permanece em **publicação controlada**, sem deploy automático. Lovable exige reconciliação separada; este workflow não altera o vínculo.",
    "",
    "_Gerado pelo workflow `EUT PR queue guardian`._",
  ].join("\n");

  const { data: issue } = await github.rest.issues.get({ owner, repo, issue_number: DASHBOARD_ISSUE });
  if (issue.body !== body) {
    await github.rest.issues.update({ owner, repo, issue_number: DASHBOARD_ISSUE, body });
  }
  await core.summary.addHeading("Fila GitHub").addRaw(body).write();
}

module.exports = { run, classify, QA_LABEL, MERGE_LABEL };
