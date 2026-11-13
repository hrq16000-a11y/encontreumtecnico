# Catálogo único — verificação privada do apelido WordPress (offline)

Estado em 13/11/2026: **preparado em código, não homologado com backup real, não publicado**.
Todos os registros elegíveis continuam sendo simplesmente **técnicos** na apresentação pública.

## Fontes reaproveitadas, sem novos dados hospedados

1. `ops/cutover/verify_backup_integrity.py` produz `old_sql_dump.sha256`,
   tamanho e `sql_executed=false` a partir **dos bytes originais** do SQL privado.
   Fixar o SHA-256 também em um registro independente, fora do manifesto e do Git.
2. `ops/cutover/reconcile_private_legacy_inventory.py` emite, em arquivo privado,
   `type=PRIVATE_EUT_REVIEW_ONLY` e `entries[].wp_post_id` únicos. O inventário
   **não** comprova apelido, identidade, WhatsApp, foto ou direito de publicação.
3. Extrair separadamente do **backup SQL original restaurado e auditado** um
   manifesto privado de apelidos, com rastreio da tabela/linha `wp_post_id` e
   conferência humana da fidelidade da extração. Não derivar o manifesto do
   espelho `legacy_review_profiles` nem do nome público editável.
4. Confrontar o manifesto, a fotografia original espelhada, o inventário por
   `wp_post_id` e o *snapshot privado autorizado* da R1
   `eut_moderation.catalog_provenance` no mesmo ambiente offline. A chave R1
   precisa ser **literalmente** `wordpress_20261108:<wp_post_id>` e ter
   `catalog_origin=wordpress`, sem duplicidade de técnico ou chave. A R1 aceita
   outras chaves de importação; nesses casos **não inventar equivalência**.

## Contrato do manifesto privado

O documento JSON `PRIVATE_EUT_WP_ORIGINAL_ALIAS_V1` tem apenas:

- `type`: literal acima;
- `backup_sha256`: SHA-256 fixado do backup SQL **original**;
- `entries`: lista de `{source_key,original_alias_sha256,backup_sha256}`.

`original_alias_sha256` é o SHA-256 em UTF-8 de
`JSON.stringify(["eut-wordpress-original-alias-v1",source_key,raw_title])`;
`raw_title` corresponde ao título **exato**, sem corrigir espaços, nome ou
acentuação. Não incluir título, telefone, usuário, DDD nem dados administrativos
no manifesto. Guardar o arquivo privado com acesso restrito, fora do Git.

O validador `src/lib/pioneer-wordpress-offline-manifest.server.ts` aceita os
objetos privados somente em memória, exige a concordância do checksum fixado,
relatório de backup, manifesto e IDs do reconciliador, e então chama o
`verifyWordPressAliasIntegrity` existente. A saída contém somente
`{source_key,original_alias}` **privados**, para o projetor server-side após a
RPC R2 e suas guardas de bloqueio, auditoria, contato privado e elegibilidade.
**Não** importar esse validador em uma rota pública nem serializar suas entradas.

## Bloqueio e prova da micro-rodada

Os arquivos brutos `encontre_wp_aishs.sql`, WXR e ZIP não foram encontrados
neste checkout; o inventário de arquivos histórico não equivale à leitura dos
bytes. Também não há manifesto original certificado nem exportação R1 privada
conferida aqui. **Sem essas fontes, saída real obrigatoriamente vazia**.

Prova proporcional exclusivamente sintética:
`vitest run src/lib/pioneer-wordpress-offline-manifest.server.test.ts`.
Não repetir testes verdes anteriores, executar SQL, obter dados hospedados,
fazer merge ou publicar até homologação separada e autorizada.
