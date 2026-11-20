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
3. **Homologação real isolada**: executar os 9 cenários acima num Auth/PostgREST
   local efêmero com JWTs legítimos e sem chaves de produção. Não criar branch Supabase
   paga sem aprovação do proprietário. Sem ambiente isolado, permanece **NO-GO**.
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
