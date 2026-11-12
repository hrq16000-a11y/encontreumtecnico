# P0 — Rascunhos duráveis de cadastro técnico (proposta isolada)

Data da verificação: **12/11/2026** · Issue **#89** · Backend oficial: **Supabase dedicado** · Código: GitHub/Vercel. Lovable **não** é fonte de migrações.

## Evidência agregada, sem dados pessoais

Consultas somente leitura no banco dedicado, sem abrir nomes, e-mails, telefones ou IDs:

- Oito contas com papel de técnico.
- Cinco técnicos com perfil; três contas técnicas confirmadas sem perfil, criadas entre dois e sete dias atrás.
- Nenhuma tabela/RPC própria para rascunhos de técnicos no Supabase dedicado.
- No recorte de logs de 24h, uma ocorrência `P0001` associada à RPC de publicação; **não é prova da causa das três contas sem perfil**.
- A publicação real `eut_publish_my_technician` exige papel técnico, confirmação de e-mail, município IBGE válido, serviços ativos e bloqueia contas/números restritos.
- A interface atual usa `sessionStorage` por conta e por aba, com TTL de **45 minutos**. Não pode ser chamada de recuperação durável.

## Proposta — SEM implantação em Supabase

`docs/sql/eut-technician-drafts-rls-staging-proposal-20261112.sql`:

- Tabela `public.eut_technician_drafts`, **uma linha por `auth.users.id`**, sem contaminar `technicians` nem perfis públicos.
- RLS obrigatória com `auth.uid() = owner_id` **e papel `tecnico`**. Papéis `cliente`, `anon` e outros técnicos não leem, gravam ou removem rascunhos.
- Payload JSON com **lista fechada de campos** (nome de exibição, UF, município, bairro, região, bio, categorias, serviços e ID IBGE), limite de **7.500 bytes**, etapas 1–3. **Proibidos** número de telefone, contato pago, e-mail, tokens OAuth, pagamentos, localização GPS e campos desconhecidos.
- Versão monotônica para proteger concorrência entre abas: tentativa de sobrescrever uma revisão ultrapassada gera erro, não apaga a versão mais recente.
- Validade renovada **pelo relógio do servidor**: 30 dias a partir do último salvamento. O usuário não pode falsificar `expires_at`. **A recuperação deve filtrar `expires_at > now()`**; a RLS permite ao titular ver o próprio rascunho vencido **para poder excluí-lo**, mas o gatilho impede atualizá-lo ou revalidá-lo. **É obrigatório homologar limpeza física periódica dos expirados** antes de produção.
- Nenhuma alteração na RPC de publicação; o rascunho **não ativa nem aprova** o perfil.
- SQL arquivado **somente em `docs/sql/`**, não em `supabase/migrations/`, e jamais executado contra produção nesta rodada.

## Fixtures em PostgreSQL isolado (sem acesso ao Supabase real)

- `docs/sql/tests/eut-technician-draft-ephemeral-schema-20261112.sql`
- `docs/sql/tests/eut-technician-draft-ephemeral-assertions-20261112.sql`
- `.github/workflows/eut-technician-draft-rls-staging.yml`

Cobrem: salvamento privado, recuperação pela mesma conta após reiniciar sessão, outro técnico sem acesso, cliente não autorizado, visitante anônimo, revisão obsoleta, campos proibidos, TTL de 30 dias, expiração e exclusão apenas do próprio rascunho. Banco fictício **PostgreSQL 17** no GitHub Actions, sem API key ou credenciais do Supabase. O teste também cobre a função privada de exclusão física em lote, acessível apenas por papel de manutenção autorizado.

## Paridade de esquema e retenção confirmadas (consulta read-only)

- Banco dedicado: **PostgreSQL 17.11**. Schema `public` utilizável por `authenticated` e `anon`; o schema `eut_moderation` não concede uso a esses papéis.
- A tabela real `public.user_roles` tem `id uuid` como chave, `(user_id, role)` exclusivo, referência a `auth.users` com exclusão em cascata e política RLS de leitura por titular/administrador. `public.has_role` já existe como `SECURITY DEFINER`. A fixture passou a refletir essas restrições.
- **`pg_cron` não está instalado**, e não existem funções/tabelas de rascunhos com os nomes propostos. Não ativar `cron.schedule` ou pressupor execução automática de limpeza.
- Arquivo adicional `docs/sql/eut-technician-draft-retention-staging-proposal-20261112.sql`: rotina `SECURITY INVOKER` no schema privado para remover **somente expirados**, em lote padrão de 500 (limite 1–1000), sem necessitar de privilégio de UPDATE. Exige papel exclusivo `eut_draft_maint` provisionado fora do repositório, com SELECT apenas de `owner_id`/`expires_at`, DELETE protegido por RLS de vencidos e EXECUTE somente da função. O papel não pode ler o JSON do rascunho.
- A rotina está **somente no GitHub**, sem agendamento. **Agendador escolhido para futura homologação: GitHub Actions, uma vez ao dia às 07h10 UTC (04h10 de Brasília), somente na branch protegida `main`, sem execução em PRs ou forks.** Primeiro validar por `workflow_dispatch` manual com aprovação do ambiente `eut-draft-maintenance`. A credencial é um segredo exclusivo desse ambiente, de papel PostgreSQL `eut_draft_maint` limitado; **não** usar usuário `postgres`, `service_role`, API publishable key ou senha no código/cliente/logs. Publicar métricas agregadas (quantidade removida, erro, duração), abortar em falhas de privilégio, lote limitado, timeout curto, e alertar se o job não rodar em 36 horas. Planejar rotação de segredo e rollback. Não há workflow agendado/segredo criado nesta PR. O lote só roda após as migrations e o perfil de manutenção passarem em staging completo.
- Esses testes reproduzem partes verificadas do esquema, mas **não são um clone integral do banco real**. Ainda falta homologar extensões, triggers, grants completos, comportamento da API e sessão de QA em um staging controlado.

## Integração de formulário preparada, porém desligada

- `src/lib/staged-technician-durable-draft.ts` implementa adaptador PostgREST tipado para `eut_technician_drafts`: carregar apenas rascunhos não vencidos do titular, gravar com revisão esperada e tratar conflitos sem sobrescrever dados, limpar apenas depois de confirmação de publicação para a mesma conta.
- O adaptador **não é importado por `src/routes/area-tecnico.tsx`**, e todos os métodos recusam chamadas sem confirmação explícita de backend homologado. O formulário continua usando `sessionStorage` de 45 minutos. Nenhum navegador atual chama a tabela inexistente.
- `src/lib/staged-technician-durable-draft.test.ts` testa ambiente desativado, allowlist de campos, rejeição de contatos/tokens, ID de dono, expiração, conflito de versão e limpeza pós-publicação. O job de CI `adapter-not-activated` executa esses testes, build e TypeScript sem Supabase real.
- O rollout futuro só pode ativar o adaptador após existir a tabela, RLS correta, manutenção agendada e teste autenticado real de publicação/galeria. A homologação deverá evitar dois salvamentos concorrentes, permitir reabrir o mesmo rascunho no celular e não transmitir dados privados para SSR.

## Revisão documental: paridade de 60 migrations — bloqueio explícito

Fonte primária consultada: `docs/audits/EUT_SUPABASE_MIGRATIONS_METADATA_2026-11-12.md` na `main`, Git blob `a8658442aeefcf3716447417d206a52f1ee23289` (sem executar nenhum arquivo de SQL).

| Classe de evidência | Versões | Valor probatório |
|---|---:|---|
| G — arquivos versionados históricos no Git | 4 | Prova do arquivo versionado, não do estado final |
| C — contratos SQL candidatos | 16 | Documentação candidata, não SQL aplicado autenticado |
| D — relatos em PRs/issues sem corpo SQL | 17 | Prova do relato, não do DDL |
| N — nenhuma referência específica encontrada | 23 | Lacuna documental aberta |
| Digest que autentique os bytes efetivamente aplicados | **0/60** | **Paridade com produção não demonstrada** |

A versão `20261110221912` merece tratamento separado: seu script Git usa `pg_get_functiondef(...)` e substituição/execução dinâmica da definição preexistente. Assim, o blob histórico **não fornece uma definição autocontida do resultado**. Não reconstruir funções desse script por suposição e não reaplicar.

**Gate documental antes de qualquer staging pago:** obter autorização e fonte primária dos metadados/digests do banco e de migrations que efetivamente produziram o esquema; sem difundir dados pessoais nem chaves. Após criar ambiente isolado autorizado, comparar assinaturas de funções, triggers, grants, índices, tabelas e políticas RLS de modo automatizado, identificando divergências sem reexecutar o legado. Qualquer migração **nova** de rascunhos será proposta separadamente, testada com fixtures e só homologada quando a paridade do staging estiver demonstrada. Este inventário não autoriza merge, SQL ou publicação.

**Pré-requisitos de manutenção:** a API GitHub conectada não permite ler os endpoints de environments e secrets, portanto **a existência do ambiente `eut-draft-maintenance`, revisores obrigatórios, branch restrictions e segredo restrito não foi comprovada**. Falha de consulta não prova ausência: obter verificação pelo administrador via configuração GitHub autorizada antes do primeiro `workflow_dispatch`. O CI cobre apenas propriedades estáticas do YAML (sem cron, papel restrito e TLS `verify-full`). A URL de conexão não pode rebaixar `sslmode`, e a sessão de manutenção deve confirmar TLS ativo antes de qualquer DELETE. O workflow segue fora de `main` e não foi executado.

## Próxima micro-rodada exigida ANTES da integração no frontend

1. Checar permissões de schemas, gatilhos, reservas de nomes e papel técnico contra **staging que espelhe o banco oficial**, sem criar novo backend permanente.
2. Definir limpeza física auditável dos expirados e contrato de retenção/privacidade. Nenhuma limpeza real foi realizada.
3. Aplicar a migração pelo fluxo versionado e autorizado **somente após staging**, com reversão documentada; verificar grants da Data API e RLS em sessão autenticada e no papel anônimo.
4. Conectar o formulário ao armazenamento no Supabase somente **quando a tabela existir**. Enquanto isso, manter rascunho atual de 45 min como fallback; salvar automaticamente com debounce/na troca de etapa e validar a resposta do servidor. Nunca usar `service_role` no browser ou `localStorage` persistente para dados não enviados.
5. Carregar rascunho apenas da identidade confirmada, evitar respostas assíncronas de contas anteriores e tratar conflito de versão; limpar apenas após a RPC de publicação confirmar `state='publicado'`.
6. Testar conta de QA com autorização: digitar no celular, mudar de dispositivo/aba, recuperar cidade IBGE e `Jardim Itália`, perder rede, trocar de conta, publicar, encontrar perfil na galeria e confirmar que telefone privado não aparece em SSR/HTML/JSON-LD.
7. **Conta QA autenticada não foi disponibilizada nesta rodada**; não registrar sucesso de E2E sem evidência de sessão autorizada.

## Issue #210 — administração

A consulta read-only anterior identificou ausência de `eut_admin_technician_change`, `eut_admin_technician_archive` e tabela de arquivos reversíveis. O SQL da PR #212 está documentado e foi testado em PostgreSQL efêmero, mas **não instalado em produção**. Não conectar botões de edição/arquivamento antes da homologação completa da migração e permissões. O administrador pode usar as funções existentes para moderação e leitura auditada.

## Preservação

Sem SQL de escrita, alteração de perfis, usuários, convites, banimentos, telefone, dados de produção, WordPress, Lovable, DNS ou Vercel; sem consulta à fonte externa de técnicos. `main` e todas as PRs existentes preservadas. **Esta rodada não afirma resolver definitivamente a publicação de técnicos.**

## Checkpoint de execução — 12/11/2026 (PR #239)

- O Supabase dedicado confirmou **zero development branches** na conexão autorizada. Uma tentativa de criar uma branch isolada `qa-eut-drafts-isolado-20261112` foi **bloqueada pelo controle de cobrança**, que exige confirmação explícita do custo. **Nenhuma branch Supabase foi criada** e não houve acesso de escrita ao projeto real. O projeto PostgreSQL 17 descartável do GitHub Actions é teste de contrato, não réplica de Supabase.
- [ ] Antes de criar staging com cobrança: informar custo/hora da organização, obter autorização explícita, limitar duração e confirmar que as migrações existentes chegam à branch. Não copiar dados reais nem contatos sem justificativa/autorização.
- [ ] Confirmar política RLS `auth.uid()`, `public.user_roles`, `public.has_role`, triggers do projeto, grants da Data API e schema `eut_moderation` contra uma instância isolada autorizada. Validar migrações `docs/sql/eut-technician-drafts-rls-staging-proposal-20261112.sql` e `docs/sql/eut-technician-draft-retention-staging-proposal-20261112.sql` somente nesse ambiente.
- [ ] Validar manutenção com papel `eut_draft_maint` restrito, aprovado e criado por um DBA no staging. Papel sem acesso ao JSON, à autenticação ou a outros registros. Confirmar que `DELETE` só atinge vencidos.
- [ ] Preparar **GitHub Environment** `eut-draft-maintenance`, com revisores obrigatórios, acesso apenas a `main` e segredo `EUT_DRAFT_MAINT_DATABASE_URL` apontando para papel exclusivamente de manutenção. Não usar senha do administrador, `service_role` ou segredo do navegador.
- [ ] O arquivo `.github/workflows/eut-draft-maintenance-manual.yml` existe **somente na PR**. Possui `workflow_dispatch` manual, texto obrigatório de confirmação, verificação de branch/repositório, execução serializada e lote máximo 500; **não tem `schedule`**, não fica disponível em `main` até aprovação, e nenhuma credencial foi cadastrada.
- [ ] Após sucesso do disparo manual com sessão QA e RLS homologadas, aprovar em PR **separada** o disparo diário. A documentação propõe 07:10 UTC, mas isso **não é agenda ativa**.
- [ ] Restaurar rascunho remoto só do titular autenticado e quando houver sessão confirmada; fallback local se backend inacessível; divergência de versões deve solicitar escolha explícita, nunca sobrescrever. Esse comportamento já está especificado em `src/lib/technician-draft-recovery-decision.ts`, com testes, **não ligado ao formulário público**.
- [ ] Homologar cadastro/Google OAuth com conta de QA realmente autenticada e autorizada: troca de sessão, UF/cidade IBGE, Jardim Itália, celular 390px, publicação e visibilidade correta na galeria. **O navegador conectado nesta conversa não disponibilizou sessão.**
- [ ] A Issue #210 de administração permanece separada: RPCs de edição e arquivamento ainda ausentes do Supabase real. Não conectar seus botões ou publicar SQL sem staging e rollback.

**Critérios de publicação:** staging completo aprovado, manutenção operacional segura, frontend integrado com testes de recuperação e zero regressões, QA autenticado, HEAD com gates aprovados e release única. Até lá, produção e `main` preservadas.
