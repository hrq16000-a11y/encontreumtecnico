# Encontre um Técnico — R2/5: conciliação Vercel Blob e mídia (09/11/2026)

## Destino único da migração
- Vercel: `msolus/encontreumtecnico` (projeto `prj_VaqJJAu3HfqcsRtUqZmeD8LCOaIy`).
- Código/layout: `hrq16000-a11y/encontreumtecnico`, visual clean preservado.
- Banco: Supabase EUT `pqtzhctvjbfcunmrvxne`.
- WordPress original continua funcionando. **Não mudar DNS, não excluir projetos antigos.**

## Auditoria somente leitura dos armazenamentos legados

Fonte do código legado: `hrq16000-a11y/Projeto-Encontre-um`, branch `feat/encontreumtecnico-migracao-vercel`. O código usa `@vercel/blob` privado com raiz padrão `encontreumtecnico/v1/`; foi auditado com `list()` sem leitura do JSON, nomes, telefones, tokens ou IDs individuais.

| Prefixo sob `encontreumtecnico/v1/` | Migração (Blob do projeto antigo) | TanStack (Blob do outro projeto) |
|---|---:|---:|
| `pending/` — técnicos pendentes | 0 | 0 |
| `approved/` — técnicos aprovados | 0 | 0 |
| `clientes/pending/` | 0 | 0 |
| `clientes/approved/` | 0 | 0 |
| `solicitacoes/pending/` | 0 | 0 |
| `solicitacoes/approved/` | 0 | 0 |

Em ambos os projetos, `complete=true` para as seis contagens; cada prefixo foi paginado integralmente, sem registros. Não foram lidos nem alterados objetos de cadastros, e nenhuma informação pessoal foi enviada ao GitHub.

**Evidência Vercel:**
- Migração: build Preview READY `dpl_52YpCgW7rbDNkgSfud2XLovGD513`, commit `9dc6696e`; no log, marcador `EUT_BLOB_INVENTORY_COUNTS`.
- TanStack: build Preview READY `dpl_8kMEjottjyS9XEvszNJW3HYwV7YB`, commit `061e398e`; mesmo marcador.
- Código de auditoria temporário em [PR #2 do repositório legado](https://github.com/hrq16000-a11y/Projeto-Encontre-um/pull/2) — **Draft, não mesclar:** substitui temporariamente o script de build só no Preview.

**Alcance limitado:** os zero objetos valem apenas para as seis pastas acima e os tokens dos dois ambientes inspecionados. Não provam ausência absoluta de arquivos em outras raízes, contas, outros Blob stores, backups e fotos WordPress.

## Supabase privado — dados que realmente precisam de integração

Contagens consultadas diretamente:
- `eut_migration.legacy_accounts`: 912 usuários WordPress.
- `eut_migration.legacy_directory`: 384 candidatos/técnicos + 270 contratantes.
- `eut_migration.legacy_media`: 434 referências de mídia, **não bytes de imagem**.
- `public.legacy_review_profiles`: 654 registros para revisão protegidos por RLS/admin.
- `auth.users`: 0 usuários no aplicativo novo; `public.technicians` aprovados: 0; solicitações novas: 0.
- `anon` não possui acesso ao schema privado `eut_migration`.

## Fotos recuperadas — alerta de qualidade de dados

O pacote pré-processado `encontreumtecnico-preparacao-migracao.zip` tem 18 arquivos de foto principal com hashes SHA-256 e 384 perfis pendentes. Os 18 IDs de fotos foram cruzados por ID WordPress com `public.legacy_review_profiles`: **todos os 18 correspondem a registros marcados como demonstração**. Não usar essas fotos em perfis reais/publicados.

O manifesto anterior aponta 434 referências de mídia, 194 referências encontradas no ZIP original e 240 ausentes na captura. Esse manifesto **não prova** que existam 194 imagens de técnicos reais prontas para publicação; a mídia original completa precisa ser conferida antes do upload. Nenhuma foto foi publicada ou enviada ao Supabase Storage nesta rodada.

## Decisão operacional

1. Não migrar dados inexistentes nos prefixos Blob auditados. Preservar ambos os projetos auxiliares por enquanto, sem cobrança adicional proposital, como fonte/rollback.
2. **Continuar a migração do staging WordPress já carregado**: login Google, reivindicação segura/validação de titularidade, triagem administrativa, perfis reais com especialidade/cidade e galeria após aprovação.
3. Reconciliar mídias originais via hash e ID antes de exibir avatares. Nunca copiar imagens de demonstração como se fossem pessoas reais.
4. Homologar solicitação e histórico reais ponta a ponta, RLS e indexação antes de substituir WordPress.

Nenhuma alteração de DNS, WordPress ou dados históricos do Supabase foi necessária para esta auditoria.
