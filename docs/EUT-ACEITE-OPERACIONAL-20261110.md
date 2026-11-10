# EUT — aceite operacional do primeiro técnico e do primeiro cliente

Data: 10/11/2026. Projeto de destino: `hrq16000-a11y/encontreumtecnico` + Vercel `encontreumtecnico.vercel.app` + Supabase `pqtzhctvjbfcunmrvxne`.

## O que a automação já consegue testar sem criar pessoas fictícias

O workflow `.github/workflows/eut-auth-preflight.yml` verifica na execução aprovada: cadastro por e-mail e provedor Google habilitados; início de OAuth para Vercel e domínio previsto; rotas públicas; categorias e serviços públicos retornam na API; busca de técnicos aprovados responde; tabelas privadas e RPCs de pedidos não aceitam acesso anônimo. Não cria usuário, pedido, cobrança ou liberação de telefone.

> Um redirecionamento inicial para Google **não confirma** que a volta autenticada, a confirmação de e-mail, o painel e a recuperação do WordPress funcionam. Uma resposta HTTP 200 de página privada também não é teste de acesso com sessão.

## Homologação futura com pessoas reais, sem interromper o portal antigo

**Conta 1 — técnico voluntário**

1. Acessar `https://encontreumtecnico.vercel.app/entrar` e entrar com conta Google real ou e-mail confirmado.
2. Verificar retorno ao portal sem erro, escolha correta do papel `tecnico` e, se existia WordPress com o mesmo e-mail, apenas associação após prova de identidade confirmada. Nunca reivindicar perfil por um ID digitado isoladamente.
3. Abrir `/area-tecnico`; cadastrar nome público, UF, município, categorias e serviços reais; salvar e verificar que o RPC publicou apenas o perfil próprio.
4. Testar o formulário de telefone privado com um número **próprio e consentido** de 10 dígitos (DDD + 8) ou 11 dígitos (DDD + 9), com e sem `+55`. O número deve ser normalizado para E.164 no backend, mas **não** aparecer no HTML público, no catálogo, na busca, em metadados ou JSON-LD. Não é necessário habilitar a autorização de venda de contato para o teste de pedidos.
5. Conferir que o perfil aparece em `/tecnicos` com cidade, categoria e serviços corretos.

**Conta 2 — cliente voluntário**

1. Entrar com outra identidade Google/e-mail real, escolher papel `cliente`.
2. Abrir o perfil do técnico, clicar `Descrever problema para este técnico`, preencher resumo, descrição, categoria, cidade/bairro e continuar após login. O UUID do técnico deve ser preservado na mesma aba.
3. Salvar sem marcar autorização: pedido fica visível só no painel do cliente, **não** no painel do técnico.
4. Em um segundo pedido, marcar consentimento explícito e compartilhar. Conferir que o técnico escolhido vê somente categoria, descrição e localização declarada, sem contato privado. O limite é de até três novos compartilhamentos por cliente em 24h.
5. No painel do técnico, registrar **uma** resposta sem telefone/e-mail/link/endereço; no painel do cliente, clicar `Atualizar respostas` e verificar conteúdo correspondente ao pedido correto.
6. Cancelar pedido compartilhado e comprovar que o conteúdo deixa de aparecer para o técnico. Confirmar que não houve dispatch para outros técnicos e que o histórico do cliente foi preservado.
7. Tentar enviar mensagem contendo um formato explícito de contato; a validação do backend deve recusá-la antes da exposição.

**Critérios finais de aceite:** duas contas reais confirmadas e papéis corretos; registro de técnico aprovado, categoria e município; pedido privado; pedido consentido para um único técnico; resposta visível apenas às partes; cancelamento restringindo o acesso; nenhum vazamento de números. Recolher evidências sem printar dados pessoais ou tokens nos logs.

## Gate comercial separado: acesso remunerado a contatos

- **Bloqueado até integrar provedor financeiro real.** Nem testes de cadastro nem troca de DNS exigem transação fictícia. Se a compra de contato for indispensável para inaugurar o modelo comercial, o cutover funcional continua **NO-GO** até homologar o PSP e o desbloqueio pós-pagamento; nunca apresentar compra ativa sem poder concluí-la.
- Necessário selecionar PSP e cadastrar na Vercel produção credenciais **server-only** do beneficiário, sem `NEXT_PUBLIC_`; definir dados fiscais e responsáveis pelo atendimento/reembolso.
- Criação de checkout só a partir do pré-pedido existente com preço e validade no servidor; webhook assinado e **consulta transacional ao PSP** antes de conceder `eut_contact_entitlements`.
- Validar valor, moeda, identificador, idempotência, status, cancelamento/estorno, limite diário e consentimento atual do técnico. Testar em ambiente de homologação do PSP antes da produção.
- O checkout atual deve continuar mostrando `payment_available=false` e nunca liberar números sem `paid` verificado.

## Bloqueios não alterados nesta rodada

O domínio `encontreumtecnico.com` permanece na hospedagem WordPress até cutover autorizado. Dados e imagens do legado precisam continuar preservados. Não executar ações de DNS, upgrade de plano, cadastro artificial, publicação de contatos ou pagamento manual para forçar um teste.

Registro de acompanhamento: issue #54.
