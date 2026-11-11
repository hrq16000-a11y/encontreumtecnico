# Encontre um Técnico — Homologação funcional segura (11/11/2026)

**Referência:** PR #147, snapshot integrado das PRs #133 (Google/contas), #139 (pré-cadastro), #142 (convites) e #145 (sessão).

**Escopo:** esta micro-rodada testa, sem publicar e sem criar contas de verdade:
- UI de cadastro técnico/cliente: aceite dos termos, e-mail + senha, intenção (apenas UX), retorno neutro quando a confirmação de e-mail é necessária, erro do provedor sem diagnóstico privado.
- UI de login e rotas de convites: conta deslogada, usuário sem convite, proprietário recusado, proprietário autorizado, confirmação obrigatória, aceite permitido/negado, recarregamento dos papéis.
- SQL apenas em transação: UUID sem cadastro negado, técnico não identificado como proprietário, sessão válida vs. UUID de sessão inexistente, leitura de convite sem autorização, titular Google verificado reconhecido. O teste da PR #139 continua cobrindo telefone completo bloqueado com e sem 55, outro DDD e DDD isolado.
- Build/TypeScript, sem publicar Vercel e sem depender de Lovable.

## Evidências iniciais (consultas somente leitura ao Supabase EUT)
- 8 contas Auth existentes: 7 técnicos, 1 administrador, **0 clientes** por `user_roles`.
- 0 contas atualmente restritas por UUID, 1 número completo restrito.
- Nenhuma função ativa `before_user_created_guard`; convite e novas políticas de sessão não instalados no banco.
- SQL das três PRs foi compilado em **uma mesma transação** com `docs/sql/eut-functional-auth-smoke-20261111.sql` e smoke da PR #139. Resultado aprovado; `ROLLBACK` confirmou zero artefatos residuais.
- Identificada lacuna na PR #145: `subject_operational(uuid)` não exigia existência do UUID em `auth.users`. **Correção aplicada apenas na branch de homologação funcional**, adicionando `EXISTS`. Após E2E, portar o ajuste para a PR original antes do merge.

## Limites e bloqueios objetivos de publicação
1. **Teste E2E real pendente:** falta um ambiente isolado com contas de QA técnico/cliente (nenhuma conta cliente com papel no banco consultado), e caixas de e-mail controladas, sem usar usuários reais da produção.
2. **Google OAuth real pendente:** desktop popup/COOP, mobile redirect e callbacks `www`/sem `www` não são comprovados por mocks ou scripts estáticos. Não realizar login em conta de terceiros.
3. **Convites e privilégios pendentes:** executar no ambiente isolado com destinatário de e-mail verificado, papel owner, recusa de outros admins, expiração, revogação, tentativas simultâneas e trilha de auditoria. A PR #142 não está instalada.
4. **Banimento e sessão pendentes:** testar usuário sintético de QA, banimento/desbanimento e revogação por API suportada, mantendo perfis legítimos operacionais. No banco oficial não existem contas banidas por UUID; **não banir contas reais para testar**.
5. **Auth Hook pendente:** executar por serviço real `supabase_auth_admin` em sandbox; a conexão SQL de auditoria não consegue assumir esse papel. Conferir hooks existentes e ensaiar rollback.
6. **Segredos e implantação:** não usar chave `service_role` no navegador, não modificar `supabase/migrations` do Lovable, DNS, WordPress original, demos ou registros reais. Nenhuma função/hook/política deve ser ativado antes de testes ponta a ponta.

## Decisão
- **Gates simulados verdes** significam que os componentes lidam corretamente com respostas controladas; não demonstram funcionamento do Google, emissão real de e-mails ou persistência/transações simultâneas na produção.
- **Não publicar** até o fechamento dos bloqueios 1–5 e a homologação de deploy. A próxima ação deve priorizar E2E isolado, jamais criar contas de teste na produção apenas para obter check verde.
