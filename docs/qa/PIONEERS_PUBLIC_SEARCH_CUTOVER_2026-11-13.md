# Pioneiros WordPress → busca pública (handoff isolado, sem cutover)

Revisão de 2026-11-13. Esta nota não autoriza deploy, SQL hospedado, migração,
ativação de pagamento ou exposição de contato. Branch de apresentação de nomes:
`fix/pioneer-readable-aliases-20261113` (base `dc75adf5`).

## Contratos reais conferidos

- Draft #256 (`9a3b6368`): R1 mantém o técnico em `public.technicians`, com
  `catalog_enabled`, `catalog_origin`, procedência e telefone em estrutura
  **privada**; R2 só admite Auth-less `pendente` habilitado se houver procedência,
  auditoria administrativa `catalog_created`, telefone privado com
  `allow_paid_contact=true`, e nenhuma desabilitação/bloqueio aplicável.
- Draft #255 (`61345ef1`): `listApprovedTechnicians` **e**
  `getApprovedTechnician` já selecionam `status IN ('aprovado','pendente')`;
  `readPublicEligibleRows` exige a RPC
  `eut_public_eligible_technician_ids`, sem fallback permissivo. Esta alteração
  ainda não está em produção. O SQL R2 deve passar pela homologação e liberação
  separada; seu comentário antigo dizendo que #255 só consulta `aprovado` está
  desatualizado em relação ao HEAD atual da #255.
- `LegacyPublicArchive` consulta uma **fotografia histórica separada**
  (`legacy_public_archive`) e continua com linguagem de pré-cadastro/reivindicação.
  Não usá-la como fonte de elegibilidade ou de contatos. Não apagar a trilha
  histórica enquanto a conciliação de origem/fotos estiver incompleta.
- `suggestLegacyDisplayName` muda apenas a apresentação de apelidos reconhecidos;
  o nome original continua preservado, e inferência nunca verifica identidade.

## Próximo patch coordenado (#255 + #256, checkout descartável)

1. Manter a seleção **somente de colunas públicas** (id, slug, nome, área
   declarada, categorias e avatar permitido). Nunca selecionar número,
   `catalog_private_contacts`, `catalog_provenance`, Auth, motivo de bloqueio ou
   fonte privada em HTTP/SSR/JSON-LD/analytics.
2. Aplicar `eut_public_eligible_technician_ids` em **toda** busca e lookup por
   slug. A única autorização de oferta é do banco; `pendente` sozinho nunca
   equivale a ativo. Não exigir titular com Auth nem reivindicação após a RPC
   admitir o registro importado auditado.
3. Para registros de origem WordPress, usar sugestão de nome apenas como rótulo
   visual, mantendo o apelido original de forma identificável. Não aplicá-la
   indiscriminadamente aos cadastros orgânicos novos. Testar unicidade de slug
   e estabilidade do link público, sem gerar novas identidades.
4. DDD permite, no máximo, texto de **região aproximada**. Sem município/UF
   verificados ou cobertura declarada, não inserir o técnico em busca por
   município IBGE, cidade exata, bairro, GPS ou categoria inventada.
5. Na busca sem município, a #255 usa `.limit(200)` e `hasMore=false`; isso
   impede alegar catálogo exaustivo para centenas de importados. Homologar
   paginação/varredura de **elegíveis** antes de divulgação de contagens.
6. Manter `catalog_enabled=false` após reimportação; preservar CRUD, auditoria,
   versionamento, bloqueios por conta/telefone e o cadastro Auth legítimo.
   Reivindicação é voluntária, apresentada somente na jornada de cadastro ou
   recuperação quando houver número correspondente; não é CTA padrão da oferta.

## Prova mínima exigida antes do cutover

| Fixture sintético | Busca pública | Perfil por slug | Telefone bruto |
| --- | --- | --- | --- |
| WordPress, Auth-less, auditado, contato válido, habilitado | visível | 200 | ausente |
| WordPress, sem telefone válido | ausente | 404 | ausente |
| WordPress, desabilitado, inclusive após reimportar | ausente | 404 | ausente |
| WordPress, telefone bloqueado | ausente | 404 | ausente |
| `pendente` sem procedência ou auditoria | ausente | 404 | ausente |
| Conta Auth bloqueada tentando INSERT | rejeitado na RLS | sem nova ficha | ausente |
| Cadastro orgânico Auth legítimo | comportamento anterior | comportamento anterior | ausente |
| Filtro municipal sem cobertura declarada | não atribuir cidade via DDD | sem município inventado | ausente |

Executar em Supabase **local descartável** com HTTP anônimo de PostgREST e SSR
do checkout integrado, além de Chromium 390px/1440px **quando houver executor
autorizado**. Não repetir gates verdes da #255/#256 sem alteração relevante.

## Validação desta rodada e limites

- `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler`
  em `src/lib/legacy-display-name.ts`: **passou** localmente.
- Teste nativo Node.js dos nove exemplos sintéticos presentes no arquivo
  `legacy-display-name.test.ts`: **9/9 passaram**. Não chamar isso de Vitest.
- Vitest completo: **não executado**. Instalação offline encontrou dependência
  ausente do cache (`@oxc-project/types@0.156.0`); sem baixar dependências.
- QA visual 390px/1440px: **não executado** nesta branch — sem checkout da
  aplicação e sem binário local Chromium. Não utilizar produção como substituto
  da homologação da branch.

Status: **preparado para checkout integrado e prova ponta a ponta; não ativado**.

## Reconciliação posterior — HEADs concorrentes e provas oficiais

Esta seção **não substitui** as limitações históricas da rodada anterior.

- #255 avançou de `61345ef1` para `b303bd3a` (fixture Auth-less) e
  `9aa43cc7` (correção da projeção do catálogo sintético). O run
  `43383243571` falhou porque uma whitelist de colunas de **technicians**
  também descartava `name` e `uf` de `eut_ibge_municipalities`, além dos
  campos de serviço/categoria. A falha foi reproduzida localmente por HTTP
  loopback (`REPRO_PR255_PROJECTION_BLOCKER_OK`). Após restringir a whitelist
  aos técnicos em cópia local, o teste de projeção voltou a exibir IBGE,
  categorias e 1/5 importados elegíveis sem contato privado
  (`LOCAL_PR255_FIXTURE_PATCH_OK`).
- A mesma causa já foi corrigida **na própria #255** pelo commit
  `9aa43cc7`, sem necessidade de novo patch ou interferência nesta branch.
  No run `43383721185` o Chromium de fato executou o app local #255
  contra API **sintética**: `PASS branch IBGE Chromium` em 390/1440, páginas
  50/5, filtro e privacidade; `PASS branch R1/R2 Auth-less Chromium` em
  390/1440, `visible=1`, `hidden=4`, `locationInvented=false`,
  `privateContacts=true`. O HEAD #255 passou 22/22 workflows.
- Na #256 HEAD `9a3b6368`, o run `43382226289` já aprovado provou,
  **separadamente e de verdade**, R1/R2 num Postgres + GoTrue + PostgREST
  local descartável: `LOCAL_WP_SEARCH_PROFILE_OK`,
  `LOCAL_WP_AUTHLESS_VISIBLE_OK`, `LOCAL_WP_NO_PHONE_HIDDEN_OK`,
  `LOCAL_WP_DISABLE_RELOAD_OK`, `LOCAL_R1_BLOCKED_OWNER_OK`.
- **Limite exato:** o navegador #255 usou uma API fake com a semântica R2;
  a API real R2 foi validada no stack local da #256, mas não há evidência de
  **um único processo SSR TanStack apontando para o PostgREST real da #256**.
  Não confundir duas provas complementares com homologação conjunta, nem
  confundir teste sintético com produção.
- Não houve novo workflow nesta branch de nomes; nenhuma mudança de SQL,
  titular, telefone, pagamentos, DNS, main, banco hospedado ou deploy.

**Próximo gate restrito:** executar checkout temporário da #255 sobre #256
com SSR TanStack conectado ao PostgREST local real já existente, ou aproveitar
um workflow autorizado equivalente. Preservar o alias original ao aplicar
`suggestLegacyDisplayName` apenas em fichas WordPress; nunca forçar município
a partir de DDD nem ampliar RLS. Após isso, homologar release/rollback antes
de ativar registros reais.

## Gate de procedência para nomes na ficha pública — 13/11/2026

Reconsulta somente de código versionado, sem acesso ao banco hospedado:
`main dc75adf5`, Draft #255 `9aa43cc7`, Draft #256 `ed04735b`, branch
de nomes `a286a20d`. Esta seção prevalece sobre a pendência de SSR
registrada acima: o run **43386276276 SUCCESS** já comprovou R1/R2 REAL
local + TanStack SSR #255 + Chromium **390px/1440px** (Issue comment
`6847031333` na PR #255), com 1 elegível/4 negados e contato privado.
Não repetir esse gate verde nem considerá-lo deploy de produção.

**Bloqueio específico da ligação do nome:**

1. A #255 recebe de `public.technicians` somente `COLUMNS` públicas
   (`id`, `public_slug`, `display_name` e campos de apresentação). A sua
   `PublicTechnician` **não inclui origem WordPress**. A função
   `eut_public_eligible_technician_ids(_ids)` devolve **IDs apenas**,
   corretamente sem procedência/contatos. O selo Bronze não é procedência.
2. A proposta R1 da #256 adiciona `catalog_origin` à tabela canônica e
   mantém o vínculo com `source_key` em
   `eut_moderation.catalog_provenance`, **privado e sem SELECT anônimo**.
   A R2 valida essa relação, auditoria, telefone privado e bloqueios
   antes de admitir Auth-less `pendente`. Mas as alterações são **SQL
   proposto**, sem prova nesta rodada de paridade do esquema hospedado.
   Adicionar `catalog_origin` ao `COLUMNS` da busca antes dessa paridade
   pode quebrar o SSR com coluna ausente.
3. O CRUD da R1 pode editar `display_name` sem guardar uma coluna imutável
   para o **apelido antigo**. O `source_key` privado identifica a origem,
   mas não é contrato de nome original. Portanto não é seguro reconstruir
   o apelido após uma edição nem inventá-lo com base no nome atual.

**Menor conexão segura quando o contrato estiver liberado:** no mesmo
servidor que já chama a RPC R2, depois de receber os IDs elegíveis,
consultar a coluna pública `catalog_origin` **somente após comprovar a
existência da migração R1/R2 no ambiente-alvo**. Reconhecer WordPress
apenas se `user_id IS NULL`, `status='pendente'`, `catalog_enabled=true`
e `catalog_origin='wordpress'`, com a RPC R2 aprovada para o mesmo ID.
Projetar ao cliente apenas o apelido público já existente (se ainda
corresponder ao `display_name`) como
`provenanceLinkedWordPressAlias` e a sugestão marcada **não verificada**.
Excluir do DTO final `catalog_origin`, `user_id`, `catalog_enabled`,
`source_key`, auditoria, bloqueios, telefones e DDD bruto. Sem fallback
por selo, padrão do texto ou status isolado. Perfil por slug e lista
devem usar **a mesma** projeção. Uma futura edição do nome exige
decisão explícita de preservação do alias de origem em contrato privado.

**Decisão desta micro-rodada:** não conectar o prop opcional diretamente
à consulta pública enquanto faltarem esses contratos ativos e a fonte
imutável do apelido. A ficha preparada no commit `a286a20d` permanece
sem mudança para quem não recebe sinal de procedência. Nenhum código,
RLS, RPC, SQL ou dado foi alterado nesta verificação. Próximo teste
proporcional: fixture local sintética de projeção **após R2**, provando
origem WordPress verdadeira e negativos de origem orgânica/sem procedência,
apelido editado, desabilitado e contato oculto; sem novo workflow ou CI
automático sem autorização específica.
