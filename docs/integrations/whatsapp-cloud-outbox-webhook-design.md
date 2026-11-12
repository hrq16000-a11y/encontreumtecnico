# Arquitetura proposta — WhatsApp Business Cloud API: fila durável + webhook

**Situação em 11/11/2026:** somente projeto e funções isoladas, **sem endpoint, worker, banco, migração, env vars, envios ou automações ativos**. A entrega voluntária atual (pedido salvo primeiro → botão de WhatsApp com mensagem pronta → visitante envia manualmente) continua intacta.

## 1. Objetivo e fronteiras
- Uma solicitação de cliente permanece no banco atual com suas autorizações.
- Somente quando houver **consentimento explícito adicional** para notificações via WhatsApp Business, o servidor poderá registrar uma intenção de aviso ao **operador** do portal. Não é autorização de acesso ao telefone dos técnicos.
- O aviso contém apenas ID do pedido, serviço, cidade informada e urgência. Nome, e-mail e descrição completa permanecem no painel com autenticação e RLS; não são enviados automaticamente na notificação.
- Não há garantia de entrega: HTTP 200/ID `wamid` da Meta significa aceitação inicial, e status `delivered` somente depois do webhook autenticado.

## 2. Modelo de dados PROPOSTO, não executado

```sql
-- PROPOSTA PARA REVISÃO: NÃO EXECUTAR SEM APROVAÇÃO, BACKUP E GATES.
-- Relacionar a coluna lead_id ao id real de public.contact_messages após confirmar esquema.
create table private.whatsapp_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  notification_type text not null default 'operator_new_lead',
  consent_version text not null,
  consent_at timestamptz not null,
  recipient_reference text not null,
  status text not null check (status in (
    'queued','claimed','accepted_by_meta','sent','delivered','read','failed','uncertain'
  )),
  idempotency_key text not null unique,
  claim_token uuid,
  claim_expires_at timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  meta_message_id text unique,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, notification_type)
);
create table private.whatsapp_webhook_events (
  event_id text primary key,
  message_id text,
  event_status text,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
-- Nenhuma GRANT para anon/authenticated; somente identidade autorizada do servidor.
```

O texto é um **desenho**, não uma migração. Antes de implementar, conferir o tipo da PK real, extensão `private` e como garantir uma transação atômica com o cadastro de leads, sem uso de `SUPABASE_SERVICE_ROLE_KEY` no front-end nem quebrar RLS.

## 3. Fluxo planejado, preservando o funil
1. O cliente preenche o funil, aceita a política e escolhe voluntariamente a opção separada "Receber atendimento pelo WhatsApp Business". Sem esta escolha, o pedido ainda é registrado e consultável no portal, sem notificação automática.
2. O backend grava **solicitação + consentimento versionado + intenção única de notificação** na mesma transação (RPC segura revisada). O `idempotency_key` é derivado do ID real e tipo de aviso, não de IP, telefone ou navegador.
3. Worker interno autenticado reivindica lotes por `FOR UPDATE SKIP LOCKED`, com lease e token, limite de tentativas, intervalos, cotas por WABA e auditoria. Worker NÃO é disparado pela navegação do usuário nem por endpoint público.
4. Verifica flag, segredo, modelo em `pt_BR` aprovado pela Meta, destinatário de operador consentido, categoria e cidade; então chama a Cloud API. Usa somente variáveis server-only, sem `VITE_` ou `PUBLIC_`.
5. Registra `wamid` como **aceito pela Meta**, sem marcar como entregue. Se houver timeout depois do envio, estado `uncertain`, nunca repetir cegamente; reconciliar por ID/evento/status ou revisão manual.
6. Recebe webhook assinado, persiste ID de evento único (at-least-once), verifica pertencimento ao WABA/telefone ID e atualiza status de forma monotônica. Não confundir respostas de clientes com notificações enviadas.

## 4. Webhook oficial — apenas contrato, SEM rota criada
**GET /api/integrations/meta/whatsapp/webhook (futuro):** receber `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`. Comparar token por tempo constante com o segredo server-side e retornar apenas o desafio numérico quando válido; rejeitar os demais. Nunca registrar o token nos logs.

**POST (futuro):** limitar tamanho e formato da requisição, ler corpo HTTP **bruto** antes do parser e conferir assinatura `X-Hub-Signature-256: sha256=<hex>` usando HMAC-SHA256 do **app secret**. Rejeitar mensagens sem assinatura válida antes de qualquer alteração. Só depois decodificar JSON e conferir tipo de evento, WABA/phone ID e IDs esperados. Aplicar rate-limit, auditoria mínima e deduplicação de entrega. Responder em tempo hábil e processar em fila segura.

O arquivo `src/lib/whatsapp-webhook-design.server.ts` contém apenas funções testáveis de handshake, assinatura e ordenação de status. **Nenhuma rota as importa.**

## 5. Estados, observabilidade e falhas
- `queued → claimed → accepted_by_meta → sent → delivered → read` (status de rede conforme os webhooks reais).
- `failed` e `uncertain` exigem diagnóstico; eventos antigos não devem rebaixar o estado atual.
- Repetir somente antes de certeza de aceitação e com controles de idempotência do negócio; eventos de assinatura inválida não entram na fila.
- Guardar eventos e metadados mínimos; retenção limitada e alinhada à política de privacidade/LGPD. Não colocar nome, documento, telefone ou token em logs e analytics. Não transmitir dados a outros portais do ecossistema.
- Monitorar falhas, custo por categoria de conversa, qualidade de modelo, limites da Meta e consentimentos revogados.

## 6. Gates obrigatórios antes de ativar em OUTRA rodada
- Conta Business, WABA, número remetente e destinatário **separados**, credenciais verificadas, token de longa duração e template aprovado; termos e custos validados.
- Autorização explícita do proprietário para alteração de banco, secrets, webhook, fila e **ativação**.
- Revisão de proteção de dados e opção granular de opt-in/revogação, versões e armazenamento de consentimento.
- Testes HMAC negativos/positivos, replay, status fora de ordem, concorrência/at-most-once por ID, timeouts de rede, reconciliação e limites.
- Homologação com identidades autorizadas e número de teste Meta; nunca gravar leads fictícios no ambiente de produção.
- Fluxo de entrega manual já publicado permanece como fallback obrigatório.

**Referências técnicas:** [Meta WhatsApp Business Platform — Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/), [Webhook messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview), [Coleção oficial Meta no Postman](https://www.postman.com/meta/whatsapp-business-platform/).

**Não executar DDL acima automaticamente.** O SQL é um protótipo de desenho para futura revisão; seguir as regras de governança de `AGENTS.md` e respeitar o Supabase externo existente.
