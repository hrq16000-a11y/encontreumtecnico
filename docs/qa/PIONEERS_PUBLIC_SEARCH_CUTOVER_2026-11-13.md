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
