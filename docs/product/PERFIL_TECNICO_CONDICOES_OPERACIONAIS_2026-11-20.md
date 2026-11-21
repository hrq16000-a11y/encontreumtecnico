# Encontre um Técnico — contrato operacional estruturado (micro-rodada)

A PR #368 entregou o editor. A gravação no Supabase oficial aguarda a instalação do contrato. A candidata da #383 exige conta operacional de todo autor da edição e impede o titular de editar uma ficha suspensa ou rejeitada. O administrador operacional pode editá-la com justificativa auditada.
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

**Contenção e reversão futuras, somente com autorização separada:** falha antes do `COMMIT` exige verificar o rollback transacional; após o `COMMIT`, impedir novas chamadas pelas três wrappers públicas somente por ação auditada e autorizada, preservando a tabela privada, as funções internas, os registros operacionais e o log para reconciliação. **Não remover tabelas ou executar `DROP ... CASCADE`, `DELETE`, `TRUNCATE`, alteração de status ou restauração de suspensos/rejeitados/Pioneiros**. Reverter o frontend, se necessário, é uma decisão independente.

## O que NÃO foi incluído

- Nenhum OTP, arquivo de identidade, CNH, ASO, documentação privada ou redes sociais.
- Nenhuma alteração de RLS de tabelas existentes, liberações de contato ou tarifação de
  R$ 9,99/R$ 29,99; os valores por km são **informativos** e não cobráveis pelo portal.
- Nenhuma mudança no ranqueamento, reputação, SLA contratual, funil financeiro ou estoque
  de documentos. Esses recursos precisam de contratos e consentimentos separados.

## Homologação autenticada isolada — baseline da PR #368 e correção da PR #383

Histórico: o workflow PostgreSQL isolado simula `auth.uid()` e papéis com variáveis de sessão; isoladamente isso **não** substitui o Auth real.
A #368 passou nos nove casos de Auth e PostgREST locais. No HEAD `803d741a9ba4c9948d34d53617a8401418796af3` da #383, a suíte autenticada voltou a passar nos nove casos. O workflow de PostgreSQL verificou também a proteção de fichas restritas e do administrador bloqueado. O CI da mesma revisão concluiu com sucesso. [Auth e PostgREST da #368](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44772676346) · [Auth e PostgREST da #383](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44848068140) · [PostgreSQL](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44848068109) · [CI](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44848068068)

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

Guardar em artefato privado do job **somente**: SHA e hash do SQL, nomes dos casos, código HTTP/SQLSTATE, versão anterior/nova, resultado de comparação de JSON, totais de logs por ação e contagem das duas fichas sintéticas suspensas. Nunca anexar tokens, senhas, contatos, nomes reais ou payloads privados. O gate do contrato **original** teve 9/9 cenários funcionais comprovados via sessões reais; qualquer revisão SQL posterior exige validação dirigida dos cenários alterados, mais checks do HEAD vigente e revisão do contrato `SECURITY DEFINER`/grants. O gate de **ativação oficial** permanece NO-GO até autorização específica. Em qualquer falha: **NO-GO**, corrigir exclusivamente teste/contrato na PR e repetir só os casos afetados. Nenhuma autorização de SQL oficial, merge ou deploy é implícita.

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

**Versões distintas do contrato (20/11/2026; não confundir):**

| Versão | Referência | Blob Git | SHA-256 do arquivo UTF-8, LF final | Decisão |
|---|---|---|---|---|
| Original, PR #368 integrada | HEAD `24b10f3ff89d426cd64105fa509ad0e48aa4d467`, merge `1c93fe779accbfe5240213810e01d3acbf707fd0` | `63d777c6058d6a5184917530fcc2b0ab330b8bbb` | `be6e5144bf4afd0c99884218c75fec93f87e8e66b63d629444f32df3e58d2d54` | **NÃO instalar**: falta bloqueio explícito ao titular rejeitado |
| **Candidata da PR #383** | HEAD `803d741a9ba4c9948d34d53617a8401418796af3` | `24374b7286461c5d11f041b8aeda77db7e661f1c` | **`d9327f7f55a04a9cdb4d609591a1906e8c211bfca0b24eaa68b9d74d4b38d827`** | Três workflows aprovados. A instalação oficial exige autorização específica. |

O blob intermediário `619604f4174a6c9768921f9d68e981d50bd7fa24` pertencia ao HEAD `592b4afbe009c85bb0d3d2fc5de7e6c9517f7869`. Foi substituído pela correção de conta administrativa bloqueada. A identificação vigente é a da tabela acima, calculada sobre os bytes do arquivo em Git. Antes de executar, reconferir HEAD, blob e SHA-256. Uma divergência exige nova reconciliação.

A função `eut_profile_ops.private_save` exige que a conta do autor esteja operacional. O titular de uma ficha suspensa ou rejeitada fica impedido de editar. Um administrador operacional precisa informar o motivo da edição. O status da ficha é preservado. O arquivo auxiliar de preflight serve para verificar as políticas existentes. A implementação e os testes permanecem na [PR #383](https://github.com/hrq16000-a11y/encontreumtecnico/pull/383).

**Preflight de metadados no Supabase EUT oficial (somente leitura, 20/11/2026):**

- Funções existentes: `public.has_role(_user_id uuid, _role app_role)` e `public.eut_account_operational()` (ambas `SECURITY DEFINER`, execução por `authenticated`, sem execução por `anon`); `public.eut_public_eligible_technician_ids(_ids uuid[])` (`SECURITY INVOKER`, execução por `anon` e `authenticated`). Tipos `app_role` (`admin`, `tecnico`, `cliente`) e `approval_status` (`pendente`, `aprovado`, `rejeitado`, `suspenso`) conferidos.
- `public.technicians` tem `id uuid`, `user_id uuid`, `status approval_status`, `coverage_city_ids integer[]`. `public.eut_admin_management_log` possui os campos de auditoria usados no SQL e permite `target_type='technician'`. As duas tabelas estão com RLS habilitada (respectivamente 9 e 1 políticas no instante da inspeção). Não foram lidas fichas ou contatos privados.
- **Ausentes:** schema `eut_profile_ops`, tabela `eut_profile_ops.technician_operations` e wrappers `public.eut_technician_operations_get`, `public.eut_technician_operations_save`, `public.eut_public_technician_operations`. Esta ausência é esperada antes da ativação e impede funcionamento operacional real no momento.
- No painel autenticado do projeto, o seletor **Exposed schemas** apresentava dois itens marcados entre oito disponíveis, `graphql_public` e `public`. A lista exclui `eut_profile_ops`. A leitura do catálogo confirmou três dependências presentes, duas políticas UPDATE do cadastro, as restrições do titular, a moderação administrativa e RLS ativa em técnicos e auditoria. Revalidar exposição, proprietário, privilégios e dependências no instante da instalação. [Configuração do projeto](https://supabase.com/dashboard/project/pqtzhctvjbfcunmrvxne/integrations/data_api/settings)

**Ordem de execução autorizável futuramente (cada etapa exige evidência própria):**

1. Conferir o HEAD, o blob e o SHA-256 da linha candidata com o SQL exato da #383 e a base de integração. Uma mudança no SQL exige validar os cenários afetados antes da execução.
2. **Preflight somente leitura e segurança:** confirmar novamente no instante da operação os schemas expostos na Data API (o privado não pode ser exposto), funções e tipos existentes, permissões efetivas, `SECURITY DEFINER`, `search_path`, auditoria, elegibilidade pública e políticas UPDATE existentes que protegem **suspensos e rejeitados**. Conferir proprietário/admin, ausência de privilégios diretos sobre dados operacionais e preservação de Pioneiros e contatos privados. Divergência de política ou objeto parcial implica **NO-GO**.
3. Reutilizar os três workflows aprovados no HEAD da tabela. Auth e PostgREST testaram nove cenários com sessões isoladas. O job de PostgreSQL cobriu também o administrador bloqueado e a edição de ficha restrita. Reservar a homologação da interface para uma sessão legítima autorizada.
4. **Autorização e execução separadas:** somente após GO técnico/documental, pedir autorização **específica e explícita** do proprietário para aplicar uma única vez o SQL corrigido identificado por SHA-256 no projeto EUT oficial. Um eventual merge da #383, da #398 ou um gate verde **não constitui autorização de SQL**, deploy ou OTP. Se autorização existir no futuro, seguir a execução transacional aprovada; em falha incerta, inspecionar o catálogo antes de repetir.
5. **Pós-checks e liberação independente:** verificar wrappers e permissões `anon`/`authenticated`, projeção sem contatos ou documentos, negação a titulares suspensos/rejeitados, auditoria de admin com motivo, integridade das políticas existentes e da tabela privada. O editor público/técnico só pode ser declarado funcional após demonstração real autorizada e validação visual 390/1440. Deployment da interface exige GO e rollback próprios; não alterar a política Vercel.
6. **Contenção/rollback NÃO destrutivo:** se transação falhar antes do `COMMIT`, confirmar rollback. Depois do commit, priorizar bloqueio de execução das wrappers públicas por procedimento separado e auditado, preservando schema, tabela, funções internas, perfis operacionais e log. Não usar `DROP TABLE ... CASCADE`, `DELETE`, `TRUNCATE`, moderação automática, redefinição de contatos ou restauração de suspensos/rejeitados/Pioneiros. Frontend e banco têm decisões de reversão independentes.
7. **Governança do documento:** a PR #398 é apenas registro de hash/preflight e **depende da correção #383**. Como ambas editam este documento em branches diferentes, reconciliar os trechos sobrepostos antes de qualquer merge futuro, sem apagar o checklist de segurança mais detalhado da #383. **Manter #398 em Draft** nesta etapa.

**Decisão de ativação.** A configuração de schemas e o preflight estrutural passaram. O contrato está apto a ser submetido à autorização específica do proprietário, com nova conferência imediatamente antes da instalação. Até essa decisão, a persistência operacional em produção continua pendente.
