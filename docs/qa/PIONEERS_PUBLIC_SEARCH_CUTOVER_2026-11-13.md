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
