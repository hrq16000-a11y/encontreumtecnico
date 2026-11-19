# Protocolo de saneamento GitHub — execução conservadora

Complementa `AGENTS.md` e os contratos específicos deste repositório; em conflito, prevalece a regra mais restritiva. Não é autorização automática para merge, exclusão, deploy ou alteração de dados.

## Micro-rodada (somente uma frente por execução)
1. Consultar estado atual de `main`, PRs abertas, HEAD/base SHA, revisões, checks obrigatórios e workflows já em andamento. Registrar data/hora e links verificáveis. Conferir outras execuções antes de iniciar trabalho.
2. Escolher **uma** pendência comprovada; não repetir CI aprovado, não reiniciar workflows manualmente, não afrouxar thresholds, snapshots, segurança ou proteção de branch.
3. Corrigir apenas causa demonstrada em branch/PR isolada, quando houver permissão e escopo. Não editar código por suposição; distinguir falha herdada da `main` de regressão exclusiva da PR.
4. Antes de integrar: revalidar HEAD esperado, SHA atual da `main`, mergeabilidade, revisões exigidas, gates integrais e homologação funcional pertinente. Se qualquer requisito faltar, registrar bloqueio e **não** integrar.
5. Antes de excluir **cada** branch: provar ausência de commits exclusivos (comparação com `main` e branches/PRs relevantes), proteção, PR aberta, workflows pendentes e dependências operacionais; conferir SHA imediatamente antes da operação. Branches de backup, sincronização e histórico não são descartáveis pelo nome. Se houver dúvida, preservar.
6. Publicação é operação separada e requer autorização, SHA validado, ambiente correto, rollback e confirmação no domínio. CI verde ou deployment READY isoladamente não provam publicação funcional.

## Evidência e reporte
- Registrar por projeto: PR/branch, HEAD e base SHAs, URLs dos runs, status dos gates, ação **executada** versus apenas **verificada**, contagem antes/depois, bloqueio concreto e próximo passo.
- Contagens globais só com paginação completa e escopo autenticado. Não deduzir merge a partir de redução da fila; confirmar evento e merge SHA.
- Se não houver avanço ou decisão necessária, evitar relatório repetitivo. Não afirmar conclusão sem prova.
- Preservar `main`, commits exclusivos, dados, RLS, contatos privados, DNS, produção e histórico. Não usar Lovable nem Max mode neste fluxo.
- Nunca executar exclusões ou merges arriscados por lote; confirmação individual e autorização apropriada são obrigatórias.

## Limites deste documento
Este protocolo é **documentação**, não um workflow automático. Não cria permissões, gates, automações, deployments ou agendamentos. As políticas existentes de cada projeto permanecem vigentes.
