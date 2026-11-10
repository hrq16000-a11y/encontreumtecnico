# Checkout de contato — implantação controlada

## Estado verificado em 09/11/2026

O portal **NÃO cobra e NÃO libera contatos**. O Supabase já possui três componentes separados:

1. `eut_contact_access_quote(uuid)`: preço informativo para cliente confirmado, horário `America/Sao_Paulo`, `payment_available=false`.
2. `eut_prepare_contact_purchase(uuid)`: pré-pedido de **15 minutos** sem transação, após validar contato autorizado, perfil público, preço e limites (1 contato por aquisição, até 2 diferentes por dia).
3. `eut_reveal_paid_technician_contact(uuid)`: só devolve o telefone com identidade de cliente confirmada, compra correspondente já gravada no livro de direitos `eut_contact_entitlements` e consentimento atual do prestador.

A tabela `eut_contact_purchase_intents` tem RLS e nenhum privilégio de leitura/escrita direta para `anon` ou `authenticated`. A função de pré-pedido exige papel `cliente`, e-mail confirmado e bloqueio transacional por cliente e dia para reduzir disputas concorrentes. Nenhum registro `prepared` é prova de pagamento; **não** gravar `eut_contact_entitlements` na ação do cliente.

## Condições do serviço

- R$ 9,99 de 09:00 até antes de 18:00; R$ 29,99 das 18:00 até antes de 09:00, horário local de São Paulo. Essa tabela de preços deve ser reapresentada no checkout **antes de confirmar a compra**, não somente na cotação.
- Um contato distinto por pagamento; máximo de dois contatos distintos por dia civil do cliente.
- O técnico cadastra o próprio WhatsApp em uma tabela privada e decide se autoriza acesso após compra; o número não integra perfis públicos, SSR ou JSON-LD.
- A contratação e o orçamento do trabalho são negociados diretamente entre cliente e profissional. A compra da conveniência não garante atendimento.
- Não tentar cobrar quando não existe contato publicável/autorizado. Se o contato desaparecer após a cobrança, aplicar a política de atendimento e eventual reembolso.

## Gate ainda BLOQUEADO: adquirência

Não foram encontradas variáveis específicas de PSP no projeto Vercel; portanto, **não habilitar botão de pagamento, QR PIX, cartão, webhook ou atualização de `state='paid'`**.

Ao conectar um provedor aprovado pelo operador (uma opção é Mercado Pago), implementar em **server-only**:

1. Credenciais exclusivamente em variáveis protegidas da Vercel, jamais no bundle web, Git, `NEXT_PUBLIC_` ou query string.
2. Criar checkout na API do PSP apenas para pré-pedido válido, com idempotency key vinculada ao ID, preço fixado no servidor, produto corretamente descrito, valor total e identificação fiscal do operador.
3. Validar assinatura do webhook e **consultar o pagamento no PSP** antes de liberar qualquer contato; conferir moeda, valor, ambiente, beneficiário, pedido, ausência de reembolso e status `approved`.
4. Registrar idempotentemente o pagamento no backend confiável, sob transação/bloqueio de cliente e dia; garantir índices `unique(payment_reference)`, `unique(client_id,access_date,daily_slot)` e `unique(client_id,access_date,technician_id)`.
5. Registrar eventos de disputa, cancelamento, estorno e reembolso; verificar condições do CDC e disponibilidade real do número.
6. Testar com **contas reais autorizadas de teste** e fluxo de webhook verificado antes de promover a produção. Não fabricar transações no banco.

Referência oficial, se o operador optar pelo Mercado Pago: https://www.mercadopago.com.br/developers/pt/guides/notifications/webhooks

## Segurança e rollout

- Requer revisão dos alertas `SECURITY DEFINER` do Supabase. O endpoint público de presença é limitado a IDs de perfis já públicos, mas a função privilegiada anônima deve ser revisada separadamente; não relaxar RLS.
- Ainda faltam os dados fiscais corretos do fornecedor do serviço e a homologação real do primeiro login WordPress→Supabase.
- Não alterar DNS até que autenticação, imagens, categoria/SEO, checkout e atendimento estejam comprovados de ponta a ponta.
