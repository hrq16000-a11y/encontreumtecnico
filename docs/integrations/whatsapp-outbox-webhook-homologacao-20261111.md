# Homologação futura — fila persistente e webhook oficial do WhatsApp Business

**11/11/2026 — Plano apenas, não implementação.** A integração Cloud API está isolada, desativada e sem uso no funil público. Este documento complementa `whatsapp-cloud-outbox-webhook-design.md`. Não criar tabelas, secrets, endpoints ou envios durante a rodada editorial.

## Decisões obrigatórias antes da implementação
- Confirmar titularidade e controle da WABA, número remetente separado do destinatário do operador, token server-only de menor privilégio, modelo de notificação aprovado e custos/limites da Meta.
- O consentimento de receber atendimento **no WhatsApp Business** precisa ser explícito, versionado, revogável e separado da autorização de contato geral. O usuário pode continuar exclusivamente pelo portal.
- O lead deve estar persistido antes de entrar na outbox. `lead_id` referencia registro existente; `UNIQUE(lead_id, notification_type)` protege contra cliques ou chamadas repetidas.
- Escrita do lead, consentimento e intenção de notificação devem ocorrer em uma **transação** validada. Só um worker autorizado pode acessar a outbox. Nada no navegador, áreas públicas, Search Console, payload de analytics ou logs.
- A entrega de mensagem à Meta não comprova entrega ao WhatsApp. `accepted_by_meta`, `sent`, `delivered`, `read`, `failed` e `uncertain` precisam ser auditáveis. Erros de rede sem resposta não permitem reenvio cego.

## Matriz mínima de homologação antes de liberar envios

| Gate | Ensaio de validação | Critério para aprovação |
| --- | --- | --- |
| Consentimento | Simular sem opção marcada; depois marcar e revogar | Sem opt-in não se cria intenção de envio; revogação impede novas notificações |
| Persistência | Simular INSERT inválido e timeout na gravação | Sem registro confirmado não existe envio nem registro de notificação |
| Concorrência | Dois workers tentam reivindicar o mesmo lead | Apenas uma reivindicação atômica, lease registrado, sem duplicidade |
| Repetição | Repetir a mesma solicitação com idempotency_key | Uma intenção por lead e tipo, sem mensagem repetida |
| Falha ambígua | Meta aceita, mas resposta é perdida | Marcar `uncertain`, reconciliar por evento/id, nunca reenviar cegamente |
| Criptografia | Assinatura HMAC válida, inválida e corpo alterado | Só aceita hash de bytes brutos e App Secret server-only |
| Handshake | Challenge GET com token correto/incorreto | Somente token válido recebe challenge; não registrar tokens |
| Replay | O mesmo evento chega três vezes, fora de ordem | Um processamento lógico; `delivered` não volta para `sent` |
| Origem | Evento de WABA ou número não autorizado | Ignorar/rejeitar sem alterar status de pedido |
| Proteção de dados | Conferir payload, RLS, logs e retenção | Nada de telefone privado dos técnicos nem nome/e-mail do cliente no aviso mínimo |
| Falha de credencial | Ausência de token, template, número ou flag desativada | Nenhuma requisição à Meta |
| Operação | Cobranças, limites, alertas e rollback | Bloqueio operacional testado e retorno ao fluxo manual garantido |

## Sequência de liberação **em outras micro-rodadas**
1. Revisar o modelo de consentimento e o esquema com o responsável; autorizar separadamente qualquer migração, com backups e rollback documentado.
2. Implementar outbox transacional isolada e testes de concorrência, **sem worker/envio**.
3. Implantar webhook com assinatura, desafio, filtragem de WABA e idempotência, sem acionar mensageria.
4. Homologar com a Meta e identidade de teste autorizada; rever taxas, templates e opt-out.
5. Somente após aprovação explícita, ativar por feature flag, inicialmente com poucos eventos QA e monitoramento; manter `contact_messages` e fluxo manual como fallback.

## Restrições e evidências
- Preservar `src/components/assistance-funnel.tsx`, `src/lib/whatsapp-cloud-adapter.server.ts`, RLS, DNS, AdSense, pagamentos, WordPress, Lovable e produção.
- Nenhum `SUPABASE_SERVICE_ROLE_KEY` pode aparecer no front-end. Não criar `supabase/migrations` ou `drizzle` nesta micro-rodada.
- Guardar logs e recibos de homologação sem dados pessoais em documentos de QA, inclusive o comportamento de webhook HMAC e respostas da Meta.
- A função de webhook preparada em `src/lib/whatsapp-webhook-design.server.ts` permanece sem rota ativa.
- Esta rodada não possui credenciais de WhatsApp, consentimento para enviar mensagens automaticamente nem autorização para alterar banco.

## SEO e desempenho mobile dos guias — verificação complementar
- Sem nova biblioteca de UI ou scripts de FAQ; use `details/summary` HTML nativo e âncoras navegáveis pelo teclado.
- Capa principal com `width`/`height`, carregamento eager e prioridade alta; capas inferiores carregadas sob demanda.
- Metadados Article, canonical público, noindex das rotas privadas, sitemap dos seis guias, links internos e 404 real.
- Critérios de campo para auditoria futura: LCP até 2,5 s, INP inferior a 200 ms e CLS abaixo de 0,1 (percentil 75 quando houver amostra de usuários). **Não declarar esses valores aprovados sem relatório Lighthouse/CrUX comparável**.
- Registrar desempenho mobile em rede simulada e dispositivo real antes/depois, com URL, horário, equipamento, condições de rede, LCP/INP/CLS e scripts de terceiros. A aprovação estática de CI não substitui testes de navegador.
