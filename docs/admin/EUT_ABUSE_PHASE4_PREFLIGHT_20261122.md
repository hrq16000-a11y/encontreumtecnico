# EUT — Fase 4: gate de segurança e antiabuso (22/11/2026)

**Status: micro-PR Draft, NO-GO para proteção operacional nova e coleta A/B/C.**
Este documento não autoriza aplicar SQL, merge, deploy nem alterar pagamentos, RLS,
contatos privados, dados existentes ou banimentos.

## Inspeção de evidência real

- A main possui \`eut_account_operational()\`, políticas/trigger de bloqueio de contas
  e telefones e ações administrativas auditadas. Reutilizar; **não duplicar**.
- Supabase dedicado: nenhuma tabela/função de defesa progressiva por operação
  identificada na verificação read-only de 22/11/2026.
- PR #447 permanece Draft; suas tabelas A/B/C e \`cron.job\` não existiam na consulta.
- Projeto Vercel \`msolus/encontreumtecnico\`: a conta conectada não conseguiu ler
  o firewall ativo (404/access denied), portanto **nenhum WAF/edge guard confirmado**.
  Solicitar ao responsável restabelecer o acesso e levantar regra exata/versão.
- As RPCs críticas em produção (\`eut_admin_unified_contact\`,
  \`eut_share_direct_request\`, \`choose_account_type\`,
  \`eut_accept_member_invitation\`, \`eut_publish_my_technician\`)
  estão sob propriedade postgres e SECURITY DEFINER. O SQL novo **não substitui** as
  validações já instaladas.

## Escopo deste código

\`src/lib/abuse-policy.ts\`: política determinística para **falhas confirmadas**,
por conta e ação protegida. Até 4 falhas sem penalidade; 5 sinalizam alerta;
10 em janela coerente com reincidência causam 2h; 13 evoluem a 5h;
reincidência demonstrada, 24h. A janela curta é 15min e a longa é 7 dias.
O retorno do cooldown sempre informa segundos restantes; liberação após expirar
não exige remover/modificar conta. Falsos positivos permitem revisão manual.
A camada não classifica IP, VPN, proxy, ISP, browser ou operadora como fraude.

\`docs/sql/eut-abuse-progressive-phase4-20261122.sql\`: proposta de tabelas
privadas e RPCs restritas, atualização serializada com
\`pg_advisory_xact_lock\` e \`FOR UPDATE\`, leitura administrativa paginada,
liberação por motivo obrigatório e trilha antes/depois.
**Não está em \`supabase/migrations\` e não foi executado**.

\`src/components/admin-abuse-controls.tsx\` dentro de
\`/admin/contas\`: módulo administrativo sob o gate do painel e RPCs com
\`auth.uid()\`, \`has_role(...,'admin')\`, e-mail confirmado e revisão otimista.
Flag \`VITE_EUT_ABUSE_ADMIN_ENABLED\` **OFF** por padrão: sem snapshot/controles
falsos. Se, futuramente, a configuração manual habilitar a UI, operações
só são válidas após sucesso + releitura confirmada no Supabase.
Ação de "liberação" não mexe em banimentos permanentes nem telefones suspensos.

## Pré-requisitos antes de habilitar a PR #447

1. Autorizar migração privada após backup compatível, revisão DBA e auditoria
   de grants/RLS. A criação de SQL de Fase 4 **não implanta defesa**.
2. Integrar guarda de operação **dentro da mesma transação** dos RPCs
   oficiais, sem quebrar requisitos comerciais e de conta. Registrar falha
   verificada em operação confiável separada, nunca pelo navegador; erro que
   lança exceção SQL pode desfazer gravação de contador.
3. Validar concorrência em dois clientes/instâncias, idempotência, expiração,
   relógio, conflito otimista, acesso sem papel e admin não confirmado. Provar
   negative tests 42501 e nenhuma liberação de telefone privado.
4. Conceder acesso mínimo aos novos RPCs; não abrir tabelas privadas na Data API.
   Nunca enviar \`service_role\` ao navegador, GitHub Actions ou logs.
5. Conferir proteção de login/recuperação pelo próprio Supabase Auth e WAF
   Vercel por rota, sem punição coletiva por IP compartilhado. Firewall atual
   **não pôde ser inspecionado** na conexão disponível.
6. Validar retenção e expurgo reais da PR #447, fonte de IP confiável,
   consentimento/revogação, política de privacidade, auditoria de acesso,
   resposta 429/backoff proporcional e retorno normal após cooldown.
7. Só após evidências operacionais, autorização de ativação/rollback
   **em etapa separada**, sem habilitar coleta silenciosamente.

**Decisão atual: NO-GO** para \`VITE_EUT_VISITOR_ANALYTICS_ENABLED\`,
\`VITE_EUT_VISITOR_ACCESS_ENABLED\`, \`VITE_EUT_LEGAL_RECEIPT_ENABLED\`,
\`EUT_VISITOR_ACCESS_ENABLED\` e quaisquer flags novas de segurança até
instalação + testes + aprovação. Este contrato não habilita nenhuma delas.
