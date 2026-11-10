# Central administrativa de contatos — Encontre um Técnico

## Acesso e autorização
O painel aparece em `/admin#admin-contatos` para uma conta com papel `admin` autenticada.
A identidade do administrador é validada em cada chamada no banco pelo par `auth.uid()` + `public.user_roles`.
O front-end não consulta tabelas privadas diretamente.

## Recursos
- Indicadores: aprovados, suspensos, sem contato, telefones restritos, contas restritas, mensagens abertas.
- Listagem paginada: nome, cidade, e-mail, telefone com DDD, situação, contato mascarado, autorização de liberação.
- Consulta do número inteiro: apenas sob justificativa, com auditoria da operação.
- Restrição de telefone: impedimento de recadastro com o número, suspensão do perfil já associado e revogação da autorização de divulgação.
- Restrição de conta: bloqueio da identidade e do telefone conhecido, com salvaguarda para contas administrativas.
- Desbloqueios de número e conta separados, sem republicação automática.
- Suspensão comum sem bloqueio permanente e retorno à fila de revisão.
- Mensagens: consulta de suporte, resposta registrada como status, arquivamento e reabertura.
- Auditoria: ator autenticado, ação, alvo, justificativa e data; sem telefone completo no histórico.

## Governança
1. Nunca versionar números reais, e-mails ou identidades dos restringidos em código ou documentos.
2. Manter o schema `eut_moderation` privado, com tabelas protegidas por RLS e sem grants de leitura aos clientes.
3. Usar RPCs privilegiadas apenas mediante checagem explícita de `auth.uid()` e papel `admin`.
4. O perfil e a autorização de contato não são restaurados automaticamente por um desbloqueio.
5. As restrições podem ser revertidas mediante autorização do proprietário, com rastreabilidade.
6. Número, foto ou nome no WhatsApp não comprovam, isoladamente, autoria de mensagens ou má conduta.

## Alteração operacional de 10/11/2026
A pedido expresso do proprietário, o número terminando em **1526** e a conta associada foram
desbloqueados e o perfil restaurado a **aprovado**, com a autorização de contato que
existia antes da restrição. O outro número, final **9135**, permanece restringido.
**Números completos e IDs pessoais não devem constar neste repositório.**

## Limites e publicação
- Os números históricos do WordPress dependem de reconciliação/validação de titularidade.
- O painel não promete impedir recadastro com outra identidade ou telefone.
- As funções SQL já foram aplicadas ao banco EUT. A UI exige build, TypeScript e revisão de PR antes da publicação.
- Não alterar DNS, regras de pagamento nem segredos.
