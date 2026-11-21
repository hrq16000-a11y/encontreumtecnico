# Encontre um Técnico — contrato operacional estruturado (micro-rodada)

Status em 20/11/2026: **PR #368 integrada ao código**, porém o contrato SQL operacional **não está instalado no Supabase EUT oficial**. A **PR #383 (Draft, não integrada)** propõe a correção que também impede o titular de ficha **rejeitada** de editar por função privilegiada. **É proibido ativar o SQL anterior da `main`**; a ativação e a publicação funcional continuam pendentes.
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
**Homologação autenticada posteriormente comprovada:** em 20/11/2026 o job `authenticated-operations` da PR #368 passou **9/9 casos com sessões reais de GoTrue + PostgREST locais**, incluindo titular, administrador, terceiros, anônimo, suspensos, concorrência, auditoria e projeção pública. Evidência: [GitHub Actions — job 136414144510](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44772676346/job/136414144510). Não houve conexão ao Supabase oficial; o resultado não autoriza aplicação de SQL nem comprova uma edição real em produção. **Essa prova 9/9 corresponde ao blob original da PR #368; NÃO comprova, sozinha, o comportamento novo do status `rejeitado` adicionado na PR #383.** O HEAD `592b4afbe009c85bb0d3d2fc5de7e6c9517f7869` da #383 tem **4/4 checks verdes** (CI e gates isolados), mas a autorização de produção depende da validação da revisão exata e dos controles restantes.

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
| **Corrigida, PR #383 em Draft** | HEAD `592b4afbe009c85bb0d3d2fc5de7e6c9517f7869` | `619604f4174a6c9768921f9d68e981d50bd7fa24` | **`0842a15e1bd5d14c75d2241e23bc76007c29e1ef4f03cd98edf66163388a34c7`** | **Candidata**, condicionada a gates, revisão e autorização separada |

O digest anterior `7c9196c88ac2367b4c51d6ec5e88c3c7eff31154233b5eae518e3ec537ea12bc` é **referência histórica incorreta**, nunca critério válido de implantação. As leituras GitHub Contents e Raw da PR #383 produziram o mesmo conteúdo e hash; o SQL da PR #383 **não foi copiado ou modificado nesta PR #398**. Validar novamente a versão congelada com `sha256sum` antes de qualquer operação futura; divergência ou HEAD distinto significa **NO-GO até nova reconciliação**.

A correção está **somente na PR #383**: `eut_profile_ops.private_save` recusa edição do titular quando a ficha está `suspenso` **ou** `rejeitado`, preservando edição por administrador legítimo com motivo auditado. O controle não muda o status de nenhuma ficha. A proposta auxiliar de preflight de políticas da #383 **não é uma migração a instalar**. As regras e os testes de policy, função privilegiada, grants e rollback detalhados ficam na [PR #383](https://github.com/hrq16000-a11y/encontreumtecnico/pull/383); **não duplicar SQL ou implementações na #398**.

**Preflight de metadados no Supabase EUT oficial (somente leitura, 20/11/2026):**

- Funções existentes: `public.has_role(_user_id uuid, _role app_role)` e `public.eut_account_operational()` (ambas `SECURITY DEFINER`, execução por `authenticated`, sem execução por `anon`); `public.eut_public_eligible_technician_ids(_ids uuid[])` (`SECURITY INVOKER`, execução por `anon` e `authenticated`). Tipos `app_role` (`admin`, `tecnico`, `cliente`) e `approval_status` (`pendente`, `aprovado`, `rejeitado`, `suspenso`) conferidos.
- `public.technicians` tem `id uuid`, `user_id uuid`, `status approval_status`, `coverage_city_ids integer[]`. `public.eut_admin_management_log` possui os campos de auditoria usados no SQL e permite `target_type='technician'`. As duas tabelas estão com RLS habilitada (respectivamente 9 e 1 políticas no instante da inspeção). Não foram lidas fichas ou contatos privados.
- **Ausentes:** schema `eut_profile_ops`, tabela `eut_profile_ops.technician_operations` e wrappers `public.eut_technician_operations_get`, `public.eut_technician_operations_save`, `public.eut_public_technician_operations`. Esta ausência é esperada antes da ativação e impede funcionamento operacional real no momento.
- Pendências **antes de qualquer GO:** confirmar o conjunto de schemas expostos na Data API (o schema privado não pode ficar exposto); revisar owner e privilégios efetivos das funções `SECURITY DEFINER`, grants, dependências e a FK `ON DELETE CASCADE`; registrar novamente metadados e SHA no instante da operação para detectar mudanças concorrentes. Não alterar configurações nem políticas nesta etapa documental.

**Ordem de execução autorizável futuramente (cada etapa exige evidência própria):**

1. **Congelamento e reconciliação:** verificar HEAD vigente da #383, blob e **SHA-256 corrigido `0842a15e…`**, projeto Supabase EUT correto, estado de integração da #383 e compatibilidade com a `main`. O SQL original da #368 não pode ser selecionado. Se #383 mudar, recalcular hash e validar apenas os cenários afetados. Priorizar o checklist mais completo já mantido na #383, não reproduzi-lo aqui.
2. **Preflight somente leitura e segurança:** confirmar novamente no instante da operação os schemas expostos na Data API (o privado não pode ser exposto), funções e tipos existentes, permissões efetivas, `SECURITY DEFINER`, `search_path`, auditoria, elegibilidade pública e políticas UPDATE existentes que protegem **suspensos e rejeitados**. Conferir proprietário/admin, ausência de privilégios diretos sobre dados operacionais e preservação de Pioneiros e contatos privados. Divergência de política ou objeto parcial implica **NO-GO**.
3. **Provas proporcionais:** reutilizar os **9/9** Auth+PostgREST reais em ambiente isolado da versão #368 como baseline, e os **4/4** checks verdes conhecidos do HEAD #383. Confirmar o gate específico do comportamento novo `rejeitado` com o SQL exato aprovado; não afirmar que a prova 9/9 original cobriu esse ajuste. Não acessar, criar ou editar fichas, clientes, leads, contatos ou senhas no banco oficial para homologar.
4. **Autorização e execução separadas:** somente após GO técnico/documental, pedir autorização **específica e explícita** do proprietário para aplicar uma única vez o SQL corrigido identificado por SHA-256 no projeto EUT oficial. Um eventual merge da #383, da #398 ou um gate verde **não constitui autorização de SQL**, deploy ou OTP. Se autorização existir no futuro, seguir a execução transacional aprovada; em falha incerta, inspecionar o catálogo antes de repetir.
5. **Pós-checks e liberação independente:** verificar wrappers e permissões `anon`/`authenticated`, projeção sem contatos ou documentos, negação a titulares suspensos/rejeitados, auditoria de admin com motivo, integridade das políticas existentes e da tabela privada. O editor público/técnico só pode ser declarado funcional após demonstração real autorizada e validação visual 390/1440. Deployment da interface exige GO e rollback próprios; não alterar a política Vercel.
6. **Contenção/rollback NÃO destrutivo:** se transação falhar antes do `COMMIT`, confirmar rollback. Depois do commit, priorizar bloqueio de execução das wrappers públicas por procedimento separado e auditado, preservando schema, tabela, funções internas, perfis operacionais e log. Não usar `DROP TABLE ... CASCADE`, `DELETE`, `TRUNCATE`, moderação automática, redefinição de contatos ou restauração de suspensos/rejeitados/Pioneiros. Frontend e banco têm decisões de reversão independentes.
7. **Governança do documento:** a PR #398 é apenas registro de hash/preflight e **depende da correção #383**. Como ambas editam este documento em branches diferentes, reconciliar os trechos sobrepostos antes de qualquer merge futuro, sem apagar o checklist de segurança mais detalhado da #383. **Manter #398 em Draft** nesta etapa.

**Resultado desta revisão documental:** o hash do SQL corrigido da PR #383 foi confirmado; a versão anterior da #368 ficou marcada **NÃO instalar**. Há 9/9 cenários Auth reais locais aprovados na versão base e 4/4 checks verdes no HEAD corrigido da #383, **sem extrapolar uma prova para a outra**. As últimas leituras do Supabase EUT oficial confirmaram dependências presentes e RPCs operacionais ausentes; revalidar no momento de eventual autorização. Revisões de permissões e Data API, homologação visual e autorização formal permanecem pendentes. **NO-GO para execução agora.** Nenhum SQL de alteração, RLS, OTP, merge ou deployment foi efetuado nesta micro-rodada.
