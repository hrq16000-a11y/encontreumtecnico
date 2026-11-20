# Encontre um Técnico — contrato operacional estruturado (micro-rodada)

Status em 20/11/2026: **PR #368 integrada ao código**, mas o contrato SQL operacional **não está instalado no Supabase EUT oficial**; sua ativação e publicação funcional permanecem pendentes.
Base de desenvolvimento original: `main` após a PR #360 (`eed3ce74`). Integração da #368: `1c93fe779accbfe5240213810e01d3acbf707fd0`.

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

## Homologação autenticada isolada — preparo do gate

Histórico: o workflow PostgreSQL isolado simula `auth.uid()` e papéis com variáveis de sessão; isoladamente isso **não** substitui o Auth real.
**Homologação autenticada posteriormente comprovada:** em 20/11/2026 o job `authenticated-operations` da PR #368 passou **9/9 casos com sessões reais de GoTrue + PostgREST locais**, incluindo titular, administrador, terceiros, anônimo, suspensos, concorrência, auditoria e projeção pública. Evidência: [GitHub Actions — job 136414144510](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44772676346/job/136414144510). Não houve conexão ao Supabase oficial; o resultado não autoriza aplicação de SQL nem comprova uma edição real em produção.

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
inventa um token legítimo: `auth.uid()` ainda é simulado pelo banco. **Não marcar
o gate Auth+PostgREST 9/9 como concluído por causa dessa aprovação isolada.**

### Procedimento de ativação auditada — preparação documental; NO-GO para executar

**Escopo congelado e integridade (20/11/2026):**

- PR #368 já integrada: commit de merge `1c93fe779accbfe5240213810e01d3acbf707fd0`; HEAD testado `24b10f3ff89d426cd64105fa509ad0e48aa4d467`.
- Arquivo imutável desta aprovação: `docs/sql/eut-technician-operations-contract-proposal-20261120.sql`; blob Git SHA-1 `63d777c6058d6a5184917530fcc2b0ab330b8bbb`.
- **SHA-256 do conteúdo bruto UTF-8, incluindo LF final:** `be6e5144bf4afd0c99884218c75fec93f87e8e66b63d629444f32df3e58d2d54`. Conferido por dois caminhos equivalentes (Contents API e arquivo raw GitHub); idêntico na PR #368, no merge e na `main` consultada em 20/11/2026.
- SHA-256 **obsoleto e incorreto** na versão anterior deste documento: `7c9196c88ac2367b4c51d6ec5e88c3c7eff31154233b5eae518e3ec537ea12bc`. Apenas a referência documental é corrigida; **o SQL não foi editado**.
- O operador deve verificar o arquivo obtido da revisão congelada com `sha256sum` antes de qualquer implantação futura. **Abortar** se o conteúdo ou o hash divergir, inclusive se surgir outra revisão do SQL.

**Preflight de metadados no Supabase EUT oficial (somente leitura, 20/11/2026):**

- Funções existentes: `public.has_role(_user_id uuid, _role app_role)` e `public.eut_account_operational()` (ambas `SECURITY DEFINER`, execução por `authenticated`, sem execução por `anon`); `public.eut_public_eligible_technician_ids(_ids uuid[])` (`SECURITY INVOKER`, execução por `anon` e `authenticated`). Tipos `app_role` (`admin`, `tecnico`, `cliente`) e `approval_status` (`pendente`, `aprovado`, `rejeitado`, `suspenso`) conferidos.
- `public.technicians` tem `id uuid`, `user_id uuid`, `status approval_status`, `coverage_city_ids integer[]`. `public.eut_admin_management_log` possui os campos de auditoria usados no SQL e permite `target_type='technician'`. As duas tabelas estão com RLS habilitada (respectivamente 9 e 1 políticas no instante da inspeção). Não foram lidas fichas ou contatos privados.
- **Ausentes:** schema `eut_profile_ops`, tabela `eut_profile_ops.technician_operations` e wrappers `public.eut_technician_operations_get`, `public.eut_technician_operations_save`, `public.eut_public_technician_operations`. Esta ausência é esperada antes da ativação e impede funcionamento operacional real no momento.
- Pendências **antes de qualquer GO:** confirmar o conjunto de schemas expostos na Data API (o schema privado não pode ficar exposto); revisar owner e privilégios efetivos das funções `SECURITY DEFINER`, grants, dependências e a FK `ON DELETE CASCADE`; registrar novamente metadados e SHA no instante da operação para detectar mudanças concorrentes. Não alterar configurações nem políticas nesta etapa documental.

**Ordem de execução autorizável futuramente (cada transição exige evidência):**

1. **Congelamento:** registrar responsável, horário, commit, blob e SHA-256 acima, projeto EUT selecionado, diff do SQL e os metadados de função/RLS/grants. Verificar que não há objetos operacionais parciais ou conflito com funções preexistentes. Não usar segredos em logs; não acessar bancos de outros projetos.
2. **Reutilizar provas:** usar os resultados já verdes da PR #368 (workflow local PostgreSQL + **9/9 GoTrue/PostgREST reais em ambiente descartável**, job acima). Repetir os casos afetados somente se SQL, autenticação, grants, RLS relacionados ou fixtures tiverem mudado; não fabricar cadastros, leads ou contatos na produção.
3. **Gate de segurança:** revisão explícita de `SECURITY DEFINER`, `search_path`, USAGE no schema privado, revogação de acesso direto a `technician_operations`, EXECUTE individual nas três wrappers, elegibilidade canônica para anônimos, proteção dos dois suspensos e auditoria de titular/admin. O SQL proposto não altera RLS/status/preços existentes.
4. **GO administrativo separado:** obter autorização **específica para aplicar exatamente este SQL no Supabase EUT oficial**, indicando hash, projeto e procedimento de interrupção. A PR #368 já foi mesclada; esta preparação **não autoriza SQL, novo merge, deployment ou OTP**. Sem autorização ou com hash divergente, **NO-GO**.
5. **Aplicação única, somente após GO:** executar o arquivo congelado uma vez, pelo mecanismo aprovado e com proteção de erro; o próprio arquivo contém `BEGIN`/`COMMIT`. Não repetir às cegas se a sessão falhar: primeiro verificar catálogo/transação. Não executar mudanças de schema, grants ou settings não previstas no arquivo revisado.
6. **Pós-checks sem expor dados:** verificar existência e assinatura das três wrappers, permissões de `anon`/`authenticated`, schema privado não exposto, RLS/políticas existentes iguais ao baseline, auditoria preservada, ausência de telefones/documentos na projeção, elegibilidade nula de suspensos e controle de versão. A verificação funcional com técnico real depende de sessão legítima e consentimento específico; **não** criar usuários, fichas ou solicitações artificiais no banco oficial.
7. **Liberar UI em decisão independente:** a existência das RPCs não equivale a publicação da interface. Só considerar release controlado com gates do código, homologação visual 390/1440, SHA de produção e rollback conferidos. Não alterar a política permanente de deploy do Vercel.
8. **Interrupção/reversão não destrutiva:** se falharem privilégios, privacidade, autorização ou auditoria, interromper publicação e bloquear a exposição pelas wrappers mediante operação **separadamente autorizada e auditada**, sem apagar `technician_operations` nem o log. Preservar os dados para reconciliação. Nunca usar `DROP TABLE ... CASCADE`, desfazer alterações de técnicos/suspensos ou alterar preços/contatos para contornar erros.

**Resultado desta revisão documental:** integridade do arquivo e QA Auth isolado **comprovados**; requisitos de esquema e dados canônicos **presentes**; RPCs **ausentes**; autorização de SQL e homologação visual/ativação oficial **pendentes**. **NO-GO para execução agora.** Nenhum SQL de alteração, RLS, OTP, merge ou deployment foi efetuado nesta micro-rodada.
