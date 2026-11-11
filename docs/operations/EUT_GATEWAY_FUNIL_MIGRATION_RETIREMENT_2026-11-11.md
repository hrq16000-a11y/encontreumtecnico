# Encontre um Técnico — decisão comercial, financeira e aposentadoria da migração
Data: 2026-11-11
Status: funil guiado em PR #131; checkout real pendente; projeto auxiliar preservado sob verificação.

## Funil único
O botão flutuante "Preciso de ajuda" substitui formulários genéricos de contato. Há duas modalidades:
- **Contato direto:** escolha do técnico; R$ 9,99 das 9h às 17h59 ou R$ 29,99 fora desse período (America/Sao_Paulo), um contato por aquisição e máximo de dois contatos distintos ao dia. Antes da ativação do gateway, registrar apenas interesse NÃO PAGO; não criar entitlement.
- **Gestão assistida:** triagem com serviço, urgência, problema e cidade sugerida; sem taxa antecipada. Não garante disponibilidade nem execução gratuita.
Ambas usam a inbox privada já existente; nunca exibem telefone privado nem enviam mensagens diretamente a técnicos.
Localização por IP é apenas aproximação de cidade/UF, sem inventar bairro ou pedir GPS ocultamente. Dados declarados manualmente prevalecem.

## Provedor de pagamento: recomendação técnica
Asaas Checkout hospedado, Pix/cartão e webhooks (ver docs.asaas.com/docs/checkout-asaas).
Não ativar checkout real sem:
1. Conta Asaas, credenciais Sandbox e produção; secrets somente na Vercel.
2. Pedido autenticado de cliente e técnico elegível, preço/horário/limite calculados no servidor.
3. Criação server-side do checkout, ID de transação persistido e confirmação assíncrona por webhook verificado.
4. Idempotência por ID do evento, validação de valor, moeda, pedido, identidade, status real pago e proteção contra replay.
5. Liberação exclusivamente via entitlement confirmada no banco e autenticação; nenhuma confirmação por retorno visual do navegador.
6. Testes de Pix/cartão, erro, expiração, duplicidade, concorrência 2/dia, reembolso, cancelamento, suspensão e telefone indisponível.
7. Política de preços e reembolsos consistente antes de retirar "checkout ainda indisponível".
Referências: https://docs.asaas.com/docs/checkout-asaas ; https://central.ajuda.asaas.com/hc/pt-br/articles/55668763565979-O-que-%C3%A9-e-como-funciona-o-Webhook-do-Asaas .

## Projeto Vercel auxiliar
Oficial: msolus/encontreumtecnico, responsável pelos domínios.
Auxiliar: msolus/encontreumtecnico-migracao, repositório legado hrq16000-a11y/Projeto-Encontre-um.
O projeto auxiliar tem uma variável BLOB_READ_WRITE_TOKEN, e seus previews recentes são inventários de mídia. Antes de desativar/deletar: inventariar objetos, backups, referências, imagens/avatares do banco novo, hashes e URLs; confirmar não existir dependência em runtime. Não remover Blob nem repositório com base apenas em DNS migrado.
Não copiar runtime ou dados do projeto velho sobre a versão oficial.

## Skills de processo adotadas, sem instalação de plugins externos
- engineering:system-design / engineering:architecture: estados e ADR, separação interesse, compra e direito de acesso.
- engineering:code-review / engineering:testing-strategy: revisão de RLS, sessão, funções de cobrança, testes de concorrência e não regressão.
- design:accessibility-review / design:ux-copy: funil de três etapas, labels, foco/teclado, linguagem de pagamento não ativo.
- engineering:deploy-checklist / marketing:seo-audit: releases controlados, secrets privados, robots/canonical e 404 verdadeiros.
- engineering:incident-response / data:validate-data: reconciliação de webhooks, pedidos, reembolsos e tentativas duplicadas.
Não afirmar que essas skills estão instaladas: somente seus critérios são incorporados.
