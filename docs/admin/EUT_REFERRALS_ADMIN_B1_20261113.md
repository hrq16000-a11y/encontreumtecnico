# B1 — Indicações no ADM: visão segura, sem pontuação inventada

Status: **prévia de código na branch de monetização; NÃO publicada**. Issue #262.

## Contratos disponíveis no código
- \`eut_my_referral_dashboard\`: leitura apenas da conta técnica autenticada (código, \`invited_accounts\`, \`invited_public_profiles\`, \`profile_published\`, \`online_recent\`). **Não** serve para percorrer os dados de outros técnicos a partir do ADM.
- \`eut_accept_technician_invite\`: ação de associação consentida do próprio técnico, **não** leitura administrativa.
- \`eut_public_referral_highlights(uuid[])\`: SQL versionado em \`docs/sql/eut-public-referral-highlights-20261110.sql\`; sinal público restrito a IDs de técnicos aprovados que atingiram ao menos dois perfis indicados publicados, aceitando no máximo 200 IDs; não retorna relações entre pessoas, telefone, email ou valores. Sua disponibilidade no banco hospedado **não foi homologada nesta rodada**.
- \`listApprovedTechnicians\`: Server Function já usada na busca pública; retorna no máximo 200 registros de técnicos públicos elegíveis (antes de filtros de elegibilidade) e mapeia \`referral_highlight\`. Em erro do RPC público, a função devolve \`false\`, portanto **ausência de destaque não é prova de ausência de indicações**.
- **Não foi encontrado no repositório um RPC administrativo existente e autorizado** que produza o relatório completo de indicações, pontos ou comissões. Não foi consultado nem alterado o Supabase hospedado.

## Implementação B1 (sem nova função SQL)
- \`AdminReferralOverview\` aparece na **Visão geral do ADM autenticado**, dentro do gate de papel \`admin\`.
- Botão inicia leitura **somente sob demanda** de dados já públicos, usando \`listApprovedTechnicians\` sem parâmetros de localização. Mostra apenas nomes e municípios públicos **efetivamente sinalizados** no recorte, como links de perfis já aprovados; projetor \`approvedPublicReferralSpotlights\` elimina qualquer campo não listado, mesmo se a origem tiver mais propriedades.
- A UI jamais apresenta contagem global, pontuação, comissão ou saldo financeiro. Recorte até 200 perfis; exibe no máximo 20 linhas e informa truncamento. Estados \`idle/loading/ready/error\`; erro ≠ zero, ausência de destaque ≠ zero de indicações.
- Nenhuma query direta de \`eut_technician_referrals\`, nenhuma chamada a \`auth.users\`, nenhuma consulta de contatos privados, nenhuma mutação.

## Contrato futuro para pontuação real (B2, ainda NÃO autorizado)
É necessário **inspecionar e confirmar schema e políticas reais** e então providenciar, por autorização separada, **RPC administrativo de leitura agregada/auditada**, com validação do papel \`admin\` no banco, limitação de linhas/paginação, e campos mínimos como:
- identificador público do técnico indicador e nome/município declarados;
- número confirmado de contas convidadas e número de perfis indicados publicados;
- elegibilidade/destaque, data de corte, status de bloqueio e origem auditável (sem dados de convidados na projeção);
- pontos **somente** quando houver uma regra oficial, ledger auditável e dados reais;
- valores/comissões **somente** quando houver evento de aquisição de contato pago, confirmado e conciliado, regra financeira aprovada e estornos.

NENHUM nome de RPC futuro deve ser tratado como existente ou chamado pelo frontend. Não usar o painel público para tentar inferir quem indicou quem.

## Aceite desta etapa
Branch isolada e diff conferido; testes mínimos de projeção pública sem PII. **Sem afirmar Vitest/CI ou QA visual até sua execução real**. Não mesclar nem publicar antes da homologação necessária. Preservar PRs Draft #255/#256/#259, main, pagamentos, RLS/SQL/DNS/Supabase e redesign de \`/tecnicos\`.
