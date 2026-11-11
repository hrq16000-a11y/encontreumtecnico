# Mercado Pago / Encontre um Técnico — integração segura (11/11/2026)

## Estado da micro-rodada
**Preparação em branch isolada. NÃO OPERACIONAL nem publicada.** Nenhuma aplicação foi criada na conta Mercado Pago; isso depende de OAuth do titular. Nenhuma credencial, SQL, Webhook, compra, cobrança real, DNS, Vercel, Lovable ou fluxo público foi alterado.

Solução escolhida: **Checkout Pro, Orders API**. O portal cobra pelo *acesso ao contato*, não pelo serviço executado pelo técnico. Sem split, sem mensalidade e sem taxa do técnico. Contato não é publicado nem inserido em URL/metadata de pagamento.

### Dados sugeridos para cadastrar a aplicação no Mercado Pago
- Nome: **Encontre um Técnico — Acesso a Contatos**
- Site: **https://www.encontreumtecnico.com**
- País e moeda: **Brasil / BRL**
- Produto: **Checkout Pro — Orders API** para site próprio (não Shopify, WooCommerce ou WordPress)
- Cobrança: compra avulsa, Pix e cartão conforme meios habilitados pelo Mercado Pago.
- O usuário dono da conta deve autorizar a conexão; **nunca enviar Access Token, Client Secret ou assinatura de Webhook em chat, código-fonte ou issue**.

### Como criar a aplicação pelo Codex (preferido)
1. Execute no ambiente Codex os comandos oficiais (confirmados em 11/11/2026):
   - `codex plugin marketplace add mercadopago/mercadopago-codex-marketplace`
   - `codex plugin add mercadopago@mercadopago-codex-marketplace`
2. Execute `/mp-connect` e autorize sua conta do Mercado Pago no navegador.
3. Com o MCP autenticado, solicite `create_application` com os dados acima e em seguida consulte `get_credentials` **sem copiar o retorno para conversas ou arquivos**. Se preferir, crie pelo painel https://www.mercadopago.com.br/developers/panel/app.
4. Selecione **Teste** no Painel da aplicação. Guarde o Access Token do ambiente de teste em segredo no backend / Vercel Preview (não no frontend).

## Código preparado nesta branch
- `src/lib/mercado-pago-pricing.ts`: preço fixado no servidor, 09h–17h59 R$ 9,99; fora do intervalo R$ 29,99, no fuso IANA do local de atendimento.
- `src/lib/mercado-pago-orders.server.ts`: adaptador de criação de ordens de sandbox com identificador externo, UUID idempotente, resposta conferida e URL HTTPS Mercado Pago. Não cria rotas, UI, nem concede acesso.
- `src/lib/mercado-pago-orders.test.ts`: casos unitários de preço, fuso, sandbox desligado, valor, referência e URL maliciosa.

**Não há endpoint ativo**; o adaptador só pode realizar uma solicitação de teste quando uma futura chamada server-side for implementada E quando todas estas variáveis estiverem presentes no ambiente de TESTE:

```env
MP_CHECKOUT_MODE=sandbox
MP_SANDBOX_ORDERS_ENABLED=true
MP_ACCESS_TOKEN_TEST=<token somente de teste guardado no servidor>
```

O prefixo APP_USR, sozinho, NÃO garante que uma credencial é de teste. Confirmar ambiente **Teste** no painel antes de armazenar. Não ativar essas flags em produção.

## Dependências de segurança para a próxima micro-rodada
Antes de criar endpoint público, implementar atomicamente no banco oficial EUT, respeitando a governança de migrações do AGENTS.md:

1. Criar uma aquisição pendente vinculada ao `auth.uid()` cliente, técnico aprovado, válido e não banido, contato privado existente e consentimento/termos aplicáveis.
2. Validar limite de aquisições no servidor **com bloqueio transacional** (padrão 1, teto 2 por dia por cliente conforme política), inclusive requisições simultâneas e contas suspensas; prevenir duplicatas de compra do mesmo contato.
3. Resolver fuso por local de atendimento registrado e validado no servidor; fixar cotação, momento, valor, regra e `idempotencyKey` na aquisição; o navegador nunca escolhe preço, fuso ou conta do técnico.
4. Criar Order com referência à aquisição já persistida. Na perda de resposta, reutilizar a **mesma** chave de idempotência; gravar order_id e estado quando conhecido. Não inferir sucesso por redirecionamento.
5. Expor Webhook HTTPS em rota específica: validar `x-signature` e request id usando segredo do ambiente; consultar a order na API do Mercado Pago; comparar ID, external_reference, valor, moeda, vendedor, status e ambiente; processar reenvios uma só vez. Não liberar em pendente, rejeitado ou cancelado.
6. Conceder acesso no backend via RPC restrita e transação idempotente, apenas quando pagamento confirmado. O telefone continua mascarado nas APIs e telas públicas. RLS e logs privados preservados.
7. Prever estorno/contestação/chargeback, suporte, auditoria e conciliação. Dados financeiros devem ficar privados; retorno HTML do navegador nunca faz a liberação.
8. Testes E2E com compradores de teste e cartões de teste: aprovado, pendente, rejeitado, repetido, webhook falsificado, troca de usuário/aba, banido, corrida de limite diário e falha de rede. Garantir que contato não é liberado em falhas.
9. Só após gates, revisão da LGPD/consentimento de divulgação do contato e autorização expressa do responsável, ativar em produção. Não instalar SDK de cartão desnecessário; Orders Checkout Pro usa redirecionamento.

### Observação de UX e comercial
Não utilizar o link de pagamento estático de R$ 9,99 como prova para liberar o contato: não identifica de modo confiável cliente/técnico/aquisição. Enquanto o fluxo novo não estiver homologado, **preservar o funil atual** e mostrar alternativa de suporte quando o checkout falhar. Disponibilidade de Pix, cartão, tarifas e prazo de recebimento devem ser conferidos na conta Mercado Pago do titular.

### Fontes oficiais
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-application
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-order
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/mcp-server/connection
