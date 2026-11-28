# Mercado Pago — Central Financeira EUT (20/11/2026)

## Estado e limites honestos desta PR

**Implementação preparatória e isolada; ainda NÃO permite cobrar nem liberar contatos.**
Há código de transporte para Checkout Pro / Preferences API e validação de notificações,
mas nenhuma rota pública de checkout/webhook está conectada. A tabela privada e as RPCs
de preços estão apenas no arquivo SQL de revisão. Não houve SQL, contas, dados, chaves,
Vercel, DNS, estornos, compras ou publicação alterados.

### Entrega verificável

- Módulo `/admin/pagamentos` na navegação mobile/desktop, protegido pelo gate
  administrativo existente. Se o proprietário ainda não possui as RPCs, mostra erro
  explícito e **não** simula sucesso.
- Campos: habilitação comercial (padrão desligada), preço normal/final em centavos,
  início/fim do período, limite diário (1 ou 2), versão e justificativa obrigatória.
- SQL `docs/sql/eut-mp-owner-settings-20261120.sql` oferece tabela privada, RLS,
  grants mínimos, prova de proprietário/sessão, auditoria permanente, bloqueio de
  concorrência e releitura de persistência. Não aplicar automaticamente.
- Cliente server-only para criar preferência MP sem informações do técnico ou telefone;
  modo teste/live separados e operação desativada até flags e credenciais exclusivas
  do servidor. A Preferences API não substitui a aquisição transacional do banco.
- Helpers para validar endereço do checkout, `x-signature` HMAC e conferir uma
  resposta `GET /v1/payments/{id}` com valor, moeda, vendedor, referência, ambiente,
  status aprovado, ausência de reembolso e data de aprovação.
- Testes unitários sem rede e sem valores secretos. **Sem teste financeiro real.**

## Dependências para conclusão antes de produção

1. **Homologar SQL isoladamente:** preflight da base EUT, bootstrap do proprietário,
   grants, RLS, concorrência, auditoria e rollback, usando contas sintéticas.
   Obter autorização específica antes de aplicar SQL oficial.
2. **Vincular cotação e pré-pedido às configurações:** os contratos vigentes
   `eut_contact_access_quote` e `eut_prepare_contact_purchase` ainda fixam 999/2999
   centavos e a tabela atual tem `CHECK` desses dois valores. A alteração comercial
   da nova Central **não** muda os valores cobrados até atualizar esse contrato.
3. **Checkout transacional:** adicionar aquisição bloqueada por cliente/dia e
   técnico, idempotência forte (a Preferences API não prova idempotência transacional
   somente por header), recuperar tentativas desconhecidas pelo PSP e persistir
   preferência/checkout no banco sem privilégios diretos ao navegador.
4. **Webhooks e reconciliação:** rota HTTPS registrada na aplicação MP, assinatura
   conferida, consulta server-to-server do pagamento, associação da aquisição e
   `eut_contact_entitlements` concedido em uma **única transação**. Nunca liberar por
   query string/redirecionamento. Tratar pagamentos posteriores ao vencimento,
   reenvios, corridas, dupla cobrança, rejeição, estorno, chargeback e revogação
   de novos acessos após reembolso.
5. **Painel operacional de pedidos:** filtros, valores, status, auditoria,
   conciliação, estorno explícito com justificativa e confirmação financeira no MP.
   Uma ação de reembolso nunca pode ser apenas uma mudança de status local.
6. **Credenciar o titular:** criar/autorizar aplicação na conta real Mercado Pago
   (OAuth/painel do titular), conferir CNPJ/CPF/beneficiário/conta, e configurar
   segredos em Vercel Preview/Production, jamais no código ou no painel editável.
7. **Homologar ponta a ponta:** em contas de testes autorizadas, conferir aprovado,
   pendente, rejeitado, cancelado, webhook falso/repetido, duas abas, limites,
   contato inexistente/suspenso, sem exposição em SSR/logs; 390 e 1440 px.
   Gate e liberação controlada com rollback sem alterar Pioneiros e suspensos.

## Configuração secreta prevista (NUNCA armazenar no SQL editável)

| Variável server-only | Finalidade |
| --- | --- |
| `MP_CHECKOUT_MODE` | `sandbox` ou `production` |
| `MP_GATEWAY_CHECKOUT_ENABLED` | Gate externo, padrão desligado |
| `MP_ACCESS_TOKEN_TEST` / `MP_ACCESS_TOKEN_LIVE` | Credencial por ambiente |
| `MP_COLLECTOR_ID_TEST` / `MP_COLLECTOR_ID_LIVE` | Beneficiário esperado |
| `MP_WEBHOOK_SECRET_TEST` / `MP_WEBHOOK_SECRET_LIVE` | Assinatura HMAC das notificações, para a futura rota |
| `MP_SANDBOX_HOST` | Preview exata autorizada (sem wildcard) |

Segredos não podem aparecer em HTML, React, logs, GitHub Actions, `.env` público
ou campos da Central. A flag comercial é necessária, **mas nunca suficiente**, para
autorizar cobrança — o gate do backend também exige checkout homologado.

## Testes direcionados

```sh
bunx vitest run src/lib/mercado-pago-settings.test.ts src/lib/mercado-pago-security.test.ts
bun run build
bunx tsc --noEmit
```

## Fontes oficiais consultadas (20/11/2026)

- Checkout Pro / Preferences API: https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/overview
- Criação de preferência: https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/create-preference/post
- Webhooks com `x-signature`: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications
- Segurança de RLS e uso server-only: https://supabase.com/docs/guides/database/postgres/row-level-security
