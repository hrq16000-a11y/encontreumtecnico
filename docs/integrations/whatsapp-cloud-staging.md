# WhatsApp Business Cloud API — preparação isolada (11/11/2026)

**Estado:** NÃO ATIVADO. Não há webhook, credenciais, fila de envio, processo automático ou alteração no funil publicado.

## Finalidade
Enviar **para o operador autorizado do portal** um aviso de nova solicitação, referenciando o ID persistido no banco, categoria, cidade informada e urgência. O atendimento completo permanece no banco com RLS. Não expor números de técnicos, não vender contatos e não confundir esse aviso com WhatsApp do técnico.

## Regras de segurança antes da próxima liberação
1. Conta Meta Business e WhatsApp Business Account (WABA) sob gestão do proprietário, número **remetente empresarial** verificado, `PHONE_NUMBER_ID`, token de acesso de longa duração/permissões restritas `whatsapp_business_messaging`.
2. Destinatário do operador deve ter opt-in válido e verificável; configurar em segredo na Vercel o E.164 **5541997452053** (não confundir com o número de envio da Cloud API).
3. Criar e aprovar na Meta o modelo de idioma `pt_BR`, nome ilustrativo `alerta_novo_lead_portal`. Os parâmetros nessa ordem são **ID do pedido**, **especialidade**, **cidade** e **urgência**. Não há garantia de aceitação do modelo sem revisão da Meta.
4. Implementar persistência durável **outbox** vinculada à gravação do pedido, reivindicação atômica única, prevenção de duplicatas, reconciliação após erro de rede e auditoria de eventos. Sem essa fila, não habilitar envio automático; exceção na resposta da Meta não garante que a mensagem não foi enviada.
5. Adicionar opção explícita de consentimento informando o compartilhamento pelo WhatsApp Business com o operador. Preservar a possibilidade de solicitar atendimento apenas pelo portal. A autorização geral de contato já existente **não** liga automaticamente a integração.
6. Criar endpoint privado de webhook Meta com verificação de assinatura **X-Hub-Signature-256**, desafio de validação, registro de WAMID/status, retenção mínima, regras de acesso e testes de replay. O HTTP 200 de envio significa aceitação do processamento, **não entrega**.
7. Restringir rate limit/abuso, tratar custos e limites de mensagens, adicionar alertas para falhas sem expor o token; homologar em sandbox / número de teste Meta antes de publicar.
8. Somente em uma futura PR aprovada, conectar o adaptador `src/lib/whatsapp-cloud-adapter.server.ts` a uma fila de trabalho no servidor; jamais chamar do navegador. Exigir autorização explícita antes de mudar a flag.

## Chaves futuras (nenhuma configurada por esta PR)

```text
EUT_WHATSAPP_CLOUD_SEND_ENABLED=false
EUT_WHATSAPP_CLOUD_PHONE_NUMBER_ID=<id fornecido pela Meta>
EUT_WHATSAPP_CLOUD_ACCESS_TOKEN=<segredo exclusivo do servidor>
EUT_WHATSAPP_CLOUD_RECIPIENT_E164=<numero consentido do operador>
EUT_WHATSAPP_CLOUD_APPROVED_TEMPLATE=<nome aprovado pela Meta>
EUT_WHATSAPP_CLOUD_API_VERSION=<versao suportada pela Meta>
```

Nunca guardar segredos no Git, componente cliente, `VITE_*` ou `PUBLIC_*`. Não criar envio usando API não oficial de WhatsApp.

## Operação existente preservada
O funil `AssistanceFunnel` continua inserindo em `contact_messages` antes de oferecer o link `api.whatsapp.com` preenchido ao visitante; só há envio quando ele confirma no aplicativo. Nenhuma cobrança é disparada nem contato privado de técnico é revelado.

## Validação desta micro-rodada
`bunx vitest run src/lib/whatsapp-cloud-adapter.test.ts` simula autorização e chamada Meta com `fetch` falso (sem tráfego), valida flag desligada, dados mínimos, opt-in, deduplicação e resposta de aceite. Build/TypeScript/SEO são executados no workflow já existente.
