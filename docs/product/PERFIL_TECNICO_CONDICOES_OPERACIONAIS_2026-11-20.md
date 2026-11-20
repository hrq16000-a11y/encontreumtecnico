# Encontre um Técnico — contrato operacional estruturado (micro-rodada)

Status em 20/11/2026: **interface integrada (#368 e #386), contrato SQL ainda NÃO instalado no Supabase oficial**. A interface falha fechada até as RPCs existirem. Nenhuma migração deve ser inferida do merge ou do deployment.
Base de desenvolvimento: `main` após a PR #360 (`eed3ce74`).

## O que entra nesta rodada

| Campo | Tipo / limites | Onde é editado | O que o visitante recebe |
|---|---|---|---|
| Equipamentos | 8 códigos fechados (multímetro, notebook, ferramentas etc.) | Técnico/admin | Rótulos, sem serial/patrimônio |
| Locomoção / viagens | meio de transporte em lista fechada e `can_travel` | Técnico/admin | Meio de transporte e declaração de viagem |
| Disponibilidade | períodos: comercial, noite, madrugada, fim de semana, feriados | Técnico/admin | Períodos escolhidos, sem promessa de plantão |
| Tempo estimado | minutos entre 15 e 1.440 para comercial e outros períodos | Técnico/admin | Tempo **declarado**, sujeito a confirmação |
| Municípios sem/com taxa | códigos IBGE, subconjunto das 5 cidades já associadas à cobertura | Técnico/admin | Somente municípios conhecidos e nomes do catálogo |
| Quilometragem | km gratuitos, limite de faixa, centavos por km até/após limite | Técnico/admin | Valores declarados do deslocamento, distintos dos preços da plataforma |

Nenhum campo é obrigatório; valores ausentes são `null`/lista vazia. O editor não aceita telefones,
links, documentos, dados pessoais livres nem localizações exatas. A distância declarada não é GPS.
O controle de equipamentos é uma declaração do profissional, não verificação independente.

## Contrato e integrações

1. Persistência isolada: `eut_profile_ops.technician_operations` com FK para `public.technicians(id)`;
   não muda o cadastro canônico, as tabelas de compra, o preço de contato nem o status.
2. Edição própria e administrativa convergem para a mesma RPC, com autorização do servidor;
   o administrador deve informar motivo de 8 a 400 caracteres, com log antes/depois.
3. Salvamento usa versão `updated_at` e, após resposta positiva, **releitura** privada com
   comparação integral dos campos; não repete requisição automaticamente em incerteza.
4. Página pública consulta a RPC somente após a elegibilidade canônica do profissional.
   Uma projeção enumerada não contém nome, contatos, identidade, status ou endereço;
   também verifica códigos da cobertura. Se a RPC ainda não existe, a seção é omitida.
5. Painel técnico acrescenta aba “Atendimento e deslocamento” para cadastros aprovados.
   Painel administrativo oferece o mesmo editor a registros canônicos; não modifica fichas
   históricas não vinculadas a uma conta técnica. Fluxo do cliente continua consumindo o
   perfil público e não recebe contato pelo novo endpoint.

## Gates antes de qualquer implantação

- CI de typescript, build e testes do catálogo, perfil público e navegação.
- Workflow `eut-operations-profile-ephemeral.yml` com PostgreSQL local de dados fictícios,
  verificando dono, administrador, anônimo, auditoria, replay, cidades e dois suspensos.
- Revisão por responsável do Supabase de permissões, `SECURITY DEFINER`, `search_path`,
  preflight de funções/tipos existentes e plano de rollback; testes autenticados numa
  branch/ambiente de homologação com ficha técnica consentida.
- Com gates verdes, solicitação **específica** de autorização para SQL oficial, merge
  e eventual deploy; uma coisa não autoriza automaticamente a outra.

**Rollback proposto (somente após aprovação administrativa):** retirar as três wrappers
`public.eut_*technician_operations*` adicionadas, funções do schema interno e, se houver
necessidade comprovada, tabela operacional depois de preservar um backup dos dados novos.
Nunca apagar uma ficha existente ou modificar os dois suspensos como parte de rollback.

## O que NÃO foi incluído

- Nenhum OTP, arquivo de identidade, CNH, ASO, documentação privada ou redes sociais.
- Nenhuma alteração de RLS de tabelas existentes, liberações de contato ou tarifação de
  R$ 9,99/R$ 29,99; os valores por km são **informativos** e não cobráveis pelo portal.
- Nenhuma mudança no ranqueamento, reputação, SLA contratual, funil financeiro ou estoque
  de documentos. Esses recursos precisam de contratos e consentimentos separados.

## Homologação autenticada isolada — 9/9 comprovados no contrato canônico

**Concluído em ambiente descartável em 20/11/2026:** [GitHub Actions #44772676346](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44772676346), job `authenticated-operations` verde no HEAD `24b10f3ff89d426cd64105fa509ad0e48aa4d467`. O log apresenta **PASS 1 a PASS 9** e `PASS FINAL: 9/9` com usuários fictícios, sessões GoTrue reais e chamadas PostgREST locais em `127.0.0.1`. O workflow aplicou o contrato somente ao PostgreSQL local; nenhum usuário ou dado oficial foi acessado. O blob do contrato testado é **idêntico** ao da `main` atual: `63d777c6058d6a5184917530fcc2b0ab330b8bbb`.

A fixture PostgreSQL separada ainda simula `auth.uid()` via sessão e não substitui esse gate independente de Auth real. O sucesso isolado **não autoriza instalação SQL em produção**.

### Pré-condições obrigatórias (NO-GO caso alguma falte)

1. Supabase local descartável ou projeto de testes **isolado**: Auth, PostgREST e PostgreSQL ativos, sem apontamento para `pqtzhctvjbfcunmrvxne`, domínio oficial, bancos ou Storage reais. Nunca usar chaves, senhas ou exportações de produção.
2. Aplicar **somente nessa instância efêmera** as dependências necessárias da aplicação e a proposta `docs/sql/eut-technician-operations-contract-proposal-20261120.sql`. Utilizar o contrato real de `has_role` / `eut_account_operational` e a elegibilidade pública real; **não** considerar o mock `eut.fixture.role` suficiente para este gate.
3. Criar usuários fictícios no Auth local: **T** (titular da ficha técnica ativa), **A** (proprietário/admin), **X** (outra conta sem poder sobre T), e manter **anon** sem login. Criar apenas fichas sintéticas, incluindo duas suspensas, sem telefone real. Todos devem obter seus JWTs por login real no Auth local; chamadas de teste usam a chave pública local e o JWT de cada sessão.
4. Registrar a versão exata do commit da PR, hash do SQL aplicado localmente, URLs locais sanitizadas e horários dos testes. Não imprimir JWT, credencial ou dados de contato em logs; destruir o ambiente ao fim.

### Sequência funcional (HTTP RPC com JWT de sessão, sem `service_role` nos testes)

| Caso | Sessão / ação | Resultado obrigatório |
|---|---|---|
| 1. Técnico lê vazio | **T** chama `eut_technician_operations_get(T)` antes da primeira gravação | `ok=true`, `profile=null` |
| 2. Técnico grava | **T** envia 12 chaves permitidas para `eut_technician_operations_save`, com ferramentas, transporte, turnos, ETA, cidades IBGE e valores por km sintéticos | `ok=true`, `updated_at` retornado; auditoria `self_updated` |
| 3. Técnico relê | **T** chama GET novamente, preferencialmente após reconectar/renovar sessão | Perfil completo idêntico ao gravado e versão igual à resposta do SAVE |
| 4. Proprietário lê/grava | **A** chama GET de T, salva versão alterada com `_expected_updated_at` e justificativa de 8–400 caracteres, e relê | Mudanças persistidas, `admin_updated` auditado com antes/depois; ausência de justificativa é recusada |
| 5. Técnico relê após admin | **T** chama GET depois da edição de A | Enxerga a versão administrada; tentativa de salvar com versão antiga é recusada |
| 6. Negativas essenciais | **X** tenta GET/SAVE da ficha de T; **anon** tenta GET privado e SAVE; **T** tenta editar outra ficha | Todos recusados por autorização, sem nova linha ou log |
| 7. Suspensos e dados privados | Titular suspenso tenta SAVE; **anon** consulta projeção pública das duas fichas suspensas; consultar grants da tabela privada com papéis não privilegiados | SAVE suspenso negado; projeção pública `null`; sem `SELECT/INSERT/UPDATE/DELETE` diretos no schema interno |
| 8. Exposição pública | **anon** chama apenas `eut_public_technician_operations(T)` quando T satisfaz elegibilidade sintética | Recebe somente projeção permitida: nenhuma chave de telefone, endereço exato, e-mail, identidade, status ou auditoria |
| 9. Validação de integridade | **T** tenta telefone extra, código de cidade fora de sua cobertura, opções repetidas e dados fora dos limites | Todas rejeitadas sem gravação parcial; versão e auditoria inalteradas |

### Evidências e critério de aprovação

Guardar em artefato privado do job **somente**: SHA e hash do SQL, nomes dos casos, código HTTP/SQLSTATE, versão anterior/nova, resultado de comparação de JSON, totais de logs por ação e contagem das duas fichas sintéticas suspensas. Nunca anexar tokens, senhas, contatos, nomes reais ou payloads privados. O gate é **GO apenas com 9/9 cenários funcionais comprovados via sessões reais**, além dos checks do HEAD vigente e revisão do contrato `SECURITY DEFINER`/grants. Em qualquer falha: **NO-GO**, corrigir exclusivamente teste/contrato na PR e repetir só os casos afetados. Nenhuma autorização de SQL oficial, merge ou deploy é implícita.

### Reforço do gate de banco (sem sessão real Supabase Auth)

A fixture SQL passou a modelar `has_role` por uma tabela privada e protegida de papéis,
e `eut_account_operational` por bloqueios persistidos no servidor descartável.
O cliente **não** consegue se conceder admin com `eut.fixture.role`, `user_metadata` ou
`app_metadata`. O arquivo `eut-technician-operations-ephemeral-auth-session-20261120.sql`
exercita separadamente terceiro técnico, cliente com claims falsos, os dois titulares
suspensos e releitura após edição administrativa com conflito de versão. O teste não
inventa um token legítimo: `auth.uid()` ainda é simulado pelo banco. **O gate
real 9/9 é comprovado separadamente pelo run #44772676346, não por esta fixture.**

### Procedimento controlado de ativação — ainda sem autorização

1. **Congelar SHA e SQL**: revalidar o HEAD da PR e comparar SHA-256 do arquivo
   `docs/sql/eut-technician-operations-contract-proposal-20261120.sql` com
   `be6e5144bf4afd0c99884218c75fec93f87e8e66b63d629444f32df3e58d2d54`.
   Este digest corresponde ao blob Git `63d777c6058d6a5184917530fcc2b0ab330b8bbb`
   publicado na `main` (a versão com conflito HTTP `PT409`); o hash anterior
   antecedia essa correção e não deve liberar a aplicação oficial.
2. **Preflight somente leitura, quando especificamente autorizado**: confirmar as
   assinaturas de `public.has_role(uuid,app_role)`, `public.eut_account_operational()`,
   `public.eut_public_eligible_technician_ids(uuid[])`, as colunas canônicas e o
   tipo de auditoria; inspecionar permissões atuais sem expor registros privados.
3. **Homologação real isolada já aprovada**: reaproveitar o run #44772676346
   com GoTrue/PostgREST e 9/9 cenários, desde que o contrato SQL permaneça no
   blob canônico e suas dependências continuem compatíveis. Reexecutar somente
   cenários afetados por eventual correção do gate de ficha rejeitada. Não criar
   branch Supabase paga sem autorização.
4. **Revisão SQL**: confirmar schema `eut_profile_ops` fora dos schemas expostos na
   Data API, `SECURITY DEFINER` interno com `search_path=''`, revogação de acesso
   direto, função de elegibilidade pública, auditoria e invariantes de concorrência.
5. **Decisão específica do proprietário para o SQL oficial**. As PRs #368 e
   #386 já foram integradas, portanto não devem ser mescladas ou publicadas
   novamente. A PR #383 permanece independente, somente documental/de
   homologação; sua integração não aplica nem autoriza migração ou deployment.
6. **Se autorizado futuramente**, aplicar a proposta SQL uma única vez em
   transação, verificar grants/funções e salvamento/releitura com identidade
   autorizada, inspecionar logs de erros sem telefones, e só depois liberar a UI.
7. **Reversão segura**: desabilitar o acesso público pelas três wrappers RPC antes
   de reverter a UI. Manter a tabela de condições e sua auditoria para recuperação;
   não executar `DROP TABLE ... CASCADE` nem apagar novas fichas sem outro plano.

### Gate de policy vigente — suspensos E rejeitados, sem mudança SQL

Preflight oficial somente leitura (20/11/2026, Postgres 17.11):
- A policy permissiva `"Owner edits back to pending"` **já contém** no `USING`
  `status <> ALL (ARRAY['suspenso', 'rejeitado'])`; o `WITH CHECK` continua
  exigindo `status = 'pendente'` e `auth.uid() = user_id`.
- A policy distinta `"Admin moderates"` autoriza moderação autenticada pelo
  papel `admin`. Foram identificadas exatamente duas policies UPDATE.
- O rascunho anterior de `ALTER POLICY`, que bloqueava só `suspenso`, está
  **obsoleto e seria uma regressão** por retirar a trava contra `rejeitado`.
  Não executar esse `ALTER` no Supabase oficial. O arquivo
  `docs/sql/eut-technician-suspension-resubmission-guard-proposal-20261120.sql`
  agora é **somente uma asserção de preflight, sem DDL/DML**.
- A fixture PostgreSQL descartável verifica que titulares das duas fichas
  suspensas e de uma rejeitada não recuperam `pendente`; a edição válida do
  titular continua disponível; o administrador pode moderar conforme as roles.
- Consultas ao banco oficial encontraram 7 fichas na tabela `technicians`,
  nenhuma no estado `suspenso` nessa tabela na inspeção; isso **não** equivale
  a dizer que contatos ou bloqueios privados foram removidos. Nenhum desses
  registros foi alterado.

### Gate de funções privilegiadas e editor compartilhado

- A função `eut_publish_my_technician` trata `suspenso` e `rejeitado`
  como restritos. A RPC `eut_remove_my_technician_profile` também recusa
  mudança de ficha restrita; avatar e cobertura exigem perfil aprovado.
- A moderação administrativa e a função de contatos privados têm caminhos
  `SECURITY DEFINER`: policy RLS sozinha não é prova suficiente. Antes de
  liberar operações novas, testar os caminhos administrativos/negativos usando
  sessões reais e justificar qualquer retorno de status com auditoria.
- A PR #386 integrou a reconciliação **local** quando um município é retirado
  da cobertura, sem gravação automática, preservando transporte, equipamentos,
  horários, ETA e preços declarados. O mesmo editor atende o titular e o admin;
  no perfil público declarações vazias são omitidas.
- O Supabase oficial ainda **não possui** `eut_profile_ops` nem as três RPCs
  `eut_technician_operations_get`, `eut_technician_operations_save` e
  `eut_public_technician_operations`. Portanto gravação/leitura real desses
  novos campos **continua NO-GO**, mesmo que os testes estáticos passem.

### Pré-condições restantes para ativação (SEM autorização implícita)

1. Revalidar o arquivo canônico da #368, **sem modificar** seu blob Git
   `63d777c6058d6a5184917530fcc2b0ab330b8bbb` e digest SHA-256 registrado
   `be6e5144bf4afd0c99884218c75fec93f87e8e66b63d629444f32df3e58d2d54`.
2. Confirmar schema interno fora da Data API, RLS da tabela privada, grants
   restritos, elegibilidade pública, versão otimista e log de auditoria.
3. **Reaproveitar o gate Auth + PostgREST 9/9 já aprovado** no run #44772676346
   para o blob canônico inalterado; só repetir cenários afetados se o SQL ou
   suas dependências mudarem. A fixture adicional de suspensão/rejeição em
   PostgreSQL descartável deve passar no HEAD da PR #383.
4. Verificar as funções `SECURITY DEFINER` com identidade técnica suspensa,
   rejeitada, terceiro, admin legítimo e anônimo, inclusive moderação e
   contatos privados. Proteger os registros atualmente restritos.
5. Somente após essas provas, solicitar **autorização específica** para executar
   o contrato SQL operacional no Supabase oficial, uma única vez. SQL oficial,
   merge documental e deployment são decisões separadas; não repetir releases.

A presente PR #383 não executa SQL oficial nem altera a policy já mais segura.


## Checklist final de ativação do contrato #368 (somente preparo; NÃO EXECUTAR agora)

**Estado em 20/11/2026:** NO-GO para SQL oficial, merge de #383 e deploy.
A PR #383 reúne preflight, evidências e este checklist. O contrato da #368 está
na main como proposta, não como objetos implantados no Supabase. Os comandos
abaixo são exemplos de execução **futura e separadamente autorizada**;
nenhum comando de escrita desta seção deve ser executado sem autorização
específica sobre o projeto EUT `pqtzhctvjbfcunmrvxne`.

### A. Identidade, congelamento e pré-condições (ordem obrigatória)

- [x] Contrato Git: blob `63d777c6058d6a5184917530fcc2b0ab330b8bbb`
  do arquivo `docs/sql/eut-technician-operations-contract-proposal-20261120.sql`;
  SHA-256 registrado `be6e5144bf4afd0c99884218c75fec93f87e8e66b63d629444f32df3e58d2d54`.
  **Reconferir os dois hashes** contra o arquivo exato imediatamente antes de aplicar.
- [x] Provas isoladas reaproveitáveis: Auth real + PostgREST 9/9 no
  [run #44772676346](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44772676346);
  workflow PostgreSQL descartável da PR #383 verde. Não repetir provas inalteradas.
- [x] Preflight oficial SELECT: PostgreSQL 17.11, 7 fichas canônicas, 2 badges
  Pioneiros, RLS ativa em técnicos/contatos; acesso direto a contatos privados
  negado a `anon`/`authenticated`; 2 policies UPDATE canônicas. Nenhuma
  linha canônica estava `suspenso` na consulta; **isso não autoriza alterar
  cadastros privados bloqueados, históricos ou fichas suspensas em outras tabelas**.
- [x] Ausência dos novos objetos: schema `eut_profile_ops`, tabela
  `technician_operations` e as três wrappers `public.eut_*operations*`.
- [x] Dependências detectadas: `public.has_role(uuid,app_role)`,
  `public.eut_account_operational()`,
  `public.eut_public_eligible_technician_ids(uuid[])`; colunas
  `technicians.id/user_id/status/coverage_city_ids` e auditoria existentes.
- [ ] **GATE BLOQUEANTE — ficha rejeitada:** a função proposta
  `eut_profile_ops.private_save`, por ser `SECURITY DEFINER`, recusa
  explicitamente `suspenso` mas ainda não recusa `rejeitado` no caminho do
  titular. A policy RLS de `public.technicians` não substitui essa checagem.
  Antes de instalar, exigir decisão e correção revisada que também rejeite
  `rejeitado` para edição pelo titular, preserve edição administrativa
  motivada e revalide **apenas os cenários alterados** no QA isolado.
  Essa correção modifica o SQL canônico e **exige novo hash e revisão**;
  nunca aplicar silenciosamente a versão anterior.
- [ ] Confirmar no painel de Data API que **somente**
  `public`/`graphql_public` (ou a lista vigente aprovada) são expostos;
  `eut_profile_ops` não pode ser exposto. Verificar a configuração de
  exposição automática de novas tabelas/funções antes da criação.
- [ ] Reconferir com SELECT pré-execução que não surgiram schema/tabela/RPCs
  homônimos, alterações de grants/policies, mudanças em funções
  `SECURITY DEFINER`, gatilhos ou alterações na elegibilidade pública.
  Diferença = NO-GO, sem adaptar SQL às cegas.
- [ ] Confirmar conta/projeto corretos, operador com permissão mínima,
  autorização SQL **específica**, janela controlada, hash final congelado,
  baseline agregado/anônimo e capacidade de executar o rollback não destrutivo.
  Nenhuma chave de produção ou telefone deve ser anexada a logs.
- [ ] Manter estado atual de Pioneiros, preços de contato, contatos privados,
  bloqueios e suspensões. A ativação não pode criar, liberar ou reativar fichas.

**SELECT de pré-condições** — somente leitura, usar imediatamente antes da
autorização/aplicação, evitando divulgar linhas pessoais:

```sql
SELECT
  to_regnamespace('eut_profile_ops') IS NULL AS schema_ainda_ausente,
  to_regclass('eut_profile_ops.technician_operations') IS NULL AS tabela_ainda_ausente,
  to_regprocedure('public.eut_technician_operations_get(uuid)') IS NULL AS get_ainda_ausente,
  to_regprocedure('public.eut_technician_operations_save(uuid,jsonb,timestamptz,text)') IS NULL AS save_ainda_ausente,
  to_regprocedure('public.eut_public_technician_operations(uuid)') IS NULL AS public_ainda_ausente,
  to_regprocedure('public.has_role(uuid,public.app_role)') IS NOT NULL AS role_ok,
  to_regprocedure('public.eut_account_operational()') IS NOT NULL AS operacional_ok,
  to_regprocedure('public.eut_public_eligible_technician_ids(uuid[])') IS NOT NULL AS elegibilidade_ok,
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.technicians'::regclass) AS tecnicos_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.eut_technician_private_contacts'::regclass) AS contatos_rls,
  NOT has_table_privilege('anon','public.eut_technician_private_contacts','SELECT') AS anon_sem_contato,
  NOT has_table_privilege('authenticated','public.eut_technician_private_contacts','SELECT') AS auth_sem_contato;
SELECT policyname,cmd,permissive,roles,qual,with_check
FROM pg_catalog.pg_policies
WHERE schemaname='public' AND tablename='technicians' AND cmd='UPDATE'
ORDER BY policyname;
```

As primeiras cinco colunas devem ser `true` **antes** da implantação; os
três helpers e os dois RLS/negações de contato também devem estar `true`.
Conferir as duas policies pela expressão completa do preflight da #383,
inclusive proteção de `rejeitado`. Uma simples contagem de policies
não prova autorização segura.

### B. Ordem de execução FUTURA (somente após todos os gates)

1. Congelar a `main`/PR vigente, arquivo **revisado**, novos SHA e
   autorização formal do proprietário para o projeto correto. Não usar
   `release:`, Vercel, merge ou deploy para instalar o banco.
2. Reexecutar **apenas SELECTs de preflight** e a inspeção manual da Data API;
   confirmar que o SQL revisado ainda cria somente schema interno, tabela com
   RLS, funções privadas, wrappers explícitas e grants estritos.
3. Aplicar **uma única vez** o arquivo SQL operacional revisado e autorizado,
   exatamente na ordem transacional `BEGIN ... COMMIT` em que foi aprovado.
   Não reaplicar um arquivo que não é idempotente; não executar também o antigo
   `ALTER POLICY` da PR #383. Não interpolar credenciais, IDs reais ou
   payloads de usuários no script.
4. Registrar apenas resultado de execução, horário, identidade do projeto,
   hash efetivamente instalado e contagens agregadas de objetos.
   Falha antes de `COMMIT` => confirmar rollback integral, não repetir
   automaticamente nem fazer edição manual improvisada.
5. Fazer os pós-checks estruturais abaixo; só então homologar sessões reais
   autorizadas, com uma ficha de QA consentida, sem tocar em suspensos,
   rejeitados, Pioneiros, telefones nem pedidos pagos. **Nenhum teste de
   produção deve se apoiar no `service_role` para fingir um titular/admin.**
6. Habilitação pública somente depois de passagem de todos os critérios e
   decisão específica de release. A UI já integrada falha fechada enquanto
   as RPCs não existirem ou não forem acessíveis.

### C. Pós-checks estruturais e funcionais (não são aprovação automática)

**SELECT de metadados** a ser executado após a implantação autorizada:

```sql
SELECT
  to_regclass('eut_profile_ops.technician_operations') IS NOT NULL AS tabela_criada,
  (SELECT relrowsecurity FROM pg_class
   WHERE oid=to_regclass('eut_profile_ops.technician_operations')) AS rls_nova_tabela,
  NOT has_table_privilege('anon','eut_profile_ops.technician_operations','SELECT') AS anon_sem_select,
  NOT has_table_privilege('authenticated','eut_profile_ops.technician_operations','SELECT') AS auth_sem_select,
  NOT has_table_privilege('anon','eut_profile_ops.technician_operations','INSERT,UPDATE,DELETE') AS anon_sem_escrita,
  NOT has_table_privilege('authenticated','eut_profile_ops.technician_operations','INSERT,UPDATE,DELETE') AS auth_sem_escrita,
  to_regprocedure('public.eut_technician_operations_get(uuid)') IS NOT NULL AS get_existe,
  to_regprocedure('public.eut_technician_operations_save(uuid,jsonb,timestamptz,text)') IS NOT NULL AS save_existe,
  to_regprocedure('public.eut_public_technician_operations(uuid)') IS NOT NULL AS public_existe;
SELECT p.proname, p.prosecdef AS definer, p.proconfig AS configuracao,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_exec
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='public' AND p.proname IN (
  'eut_technician_operations_get','eut_technician_operations_save',
  'eut_public_technician_operations'))
 OR (n.nspname='eut_profile_ops' AND p.proname IN (
  'private_get','private_save','public_get','safe_projection'))
ORDER BY n.nspname,p.proname;
```

Esperado: tabela RLS `true`; nenhum acesso direto de
`anon`/`authenticated` à tabela; wrappers públicas
`SECURITY INVOKER`, GET/SAVE privados acessíveis **somente a autenticados**,
GET público acessível a `anon` e `authenticated`; funções internas
`SECURITY DEFINER` somente onde previsto, `search_path=''`, grants
explícitos. Conferir que o schema interno **não foi exposto à Data API**,
pois `has_schema_privilege` sozinho não mede exposição pela API.
Confirmar que o SELECT de policies canônicas **não sofreu alteração**.

**Provas funcionais mínimas por sessões autorizadas**: técnico lê vazio,
grava e relê os 12 campos; admin altera com justificativa e auditoria
antes/depois; edição com versão antiga produz conflito HTTP 409;
terceiro/anônimo não leem nem gravam ficha privada; suspenso e rejeitado
não editam; anônimo recebe `null` de ficha não elegível; projeção pública
contém só as 12 chaves permitidas e nenhum telefone/e-mail/status;
cidades fora da cobertura ou campos extras são recusados; taxas/km
não alteram preço de acesso ao contato. Não alterar cadastros reais
sem consentimento. Resultado ou evidência fora do esperado => NO-GO.

**Integridade final**: comparar contagens agregadas e hashes de configuração
com a linha de base; confirmar que nenhum cadastro, política, contato
privado, Pioneiro, suspenso, preço ou compra foi modificado pela ativação.

### D. Contenção e rollback NÃO destrutivos (somente quando autorizados)

- **Antes do COMMIT**, qualquer falha na transação do contrato deve provocar
  rollback da transação inteira. Confirmar ausência de novos objetos antes
  de tentar novamente. Não fazer `DROP` corretivo em produção.
- **Após COMMIT**, se algum pós-check falhar, primeiro interromper a liberação
  e negar execução pelas **três wrappers novas**; conservar a tabela,
  auditoria e fichas operacionais para correção/recuperação. A revogação de
  acesso é uma **operação de produção futura e separadamente autorizada**,
  não algo executado por este documento:

```sql
-- PLANO, NÃO EXECUTADO. Usar somente com autorização de contenção.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.eut_technician_operations_get(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.eut_technician_operations_save(uuid,jsonb,timestamptz,text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.eut_public_technician_operations(uuid)
  FROM PUBLIC, anon, authenticated;
COMMIT;
```

- Conferir após contenção que `has_function_privilege` é falso para
  `anon`/`authenticated` nas wrappers, que o editor falha fechado
  sem alterações repetidas, e que a busca pública e a gestão de técnicos
  continuam funcionais **sem a seção opcional**.
- Não apagar `eut_profile_ops.technician_operations`, auditoria,
  `public.technicians`, contas, perfis históricos ou objetos de Storage.
  Não usar `DROP ... CASCADE`, `DELETE`, `TRUNCATE`, mudança de
  status, restauração automática ou rollback de dados reais.
- Se houver necessidade posterior de reativar as wrappers, tratar como
  **nova autorização**, nova prova de grants, identidade e QA afetado.
  Rollback do banco e rollback do frontend são decisões separadas;
  não repetir Vercel deployment automaticamente.

### E. Decisão objetiva

**GO somente quando**: pendência de `rejeitado` resolvida e testada,
novo SQL/hash congelados, preflight oficial íntegro, schemas e grants
revisados, prova Auth isolada válida para a versão final,
pós-checks e recuperação definidos, e autorização **explícita**
para a aplicação oficial. **Até lá: NO-GO** e nenhuma mudança no Supabase
oficial além das consultas SELECT de metadados.
