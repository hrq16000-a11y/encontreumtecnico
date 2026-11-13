# Pioneiros — pré-homologação PostgreSQL LOCAL do apelido original

**Estado: bloqueado por executor local indisponível; nenhum SQL executado.**
Consulta de 13/11/2026, branch `fix/pioneer-readable-aliases-20261113`
HEAD `4a0a40e2`; main `97de497d`; Drafts #255 `9aa43cc7`,
#256 `df6ac1df`, #259 `ac44c6cf`. Nenhuma dessas referências foi alterada.

## Evidência do impedimento neste executor

Busca read-only por executáveis no `PATH`: `psql`, `postgres`, `pg_ctl`,
`initdb`, `docker` e `podman` **indisponíveis**. A árvore habitual
`/usr/lib/postgresql` também **não existe**. Não instalar pacotes, criar
container, baixar dependências, executar SQL, abrir conexão hospedada ou
criar GitHub Actions por conta deste bloqueio.

## Material já versionado e reutilizável

- `docs/sql/eut-wordpress-original-alias-private-proposal-20261113.sql`:
  **proposta**, não migração homologada. Registro privado append-once ligado
  por `technician_id` e `source_key` exatos à R1, com gatilho que veta
  `UPDATE`/`DELETE`, RLS ativada e grants públicos revogados.
- `docs/qa/fixtures/eut-wordpress-original-alias-synthetic-20261113.json`:
  quatro identidades **inteiramente fictícias**, sem telefone, e-mail ou
  titular real: origem exata elegível, nome público editado, chave de
  procedência divergente e técnico não elegível por R2.
- `src/lib/pioneer-wordpress-offline-manifest.server.ts` e
  `src/lib/pioneer-wordpress-integrity.server.ts`: exigem manifesto privado
  atestado a partir de backup WordPress original e SHA-256 fixado fora do Git.
  Nenhum checksum fictício da fixture vale como atestado.

## Menor homologação futura, somente após disponibilizar PostgreSQL 17 local gratuito

1. Reconsultar HEADs e confirmar executor PostgreSQL 17 **descartável**, com
   papéis locais `anon`/`authenticated` e R1/R2 de #256 instaladas somente
   em fixture sintética. Não tocar no Supabase hospedado. Não executar a
   proposta contra um PostgreSQL vazio: ela depende de
   `eut_moderation.catalog_provenance` e dos papéis R1 existentes.
2. Aplicar a proposta **somente nesse banco descartável**. Inserir registros
   sintéticos que correspondam em `technician_id`, `catalog_origin=wordpress`
   e `source_key` exatos. Comprovar unicidade, falha de fonte divergente,
   proibição de atualização/exclusão e privacidade `anon`/`authenticated`.
3. Revalidar apenas o recorte afetado do fluxo: RPC R2 primeiro; depois
   projeção server-only que descarta metadados privados e retorna o apelido
   original somente se o nome público ainda for exatamente igual à fonte
   auditada. Nome editado, chave ambígua, origem não comprovada ou R2
   inelegível devem produzir `null`, nunca publicar telefone, fonte privada
   nem dado administrativo.
4. Registrar saídas sanitizadas e destruir integralmente o banco temporário.
   Não repetir os gates verdes de #255/#256, não migrar dados reais, não
   autorizar merge, deploy ou pagamentos por causa desta prova.

## Bloqueios independentes

- **Infraestrutura de teste:** não há PostgreSQL local disponível neste
  executor; nenhuma homologação SQL pode ser declarada como aprovada.
- **Origem real:** falta obter e atestar os bytes do backup WordPress original
  em ambiente privado, com correspondência literal da chave R1. A proposta
  de armazenamento imutável não inventa essa procedência.
- **Ativação:** depende de revisão RLS, backfill privado auditado, integração
  server-side e liberação separada. Todos seguem publicamente só como
  **técnicos**, sem selo de origem ou reivindicação obrigatória; elegibilidade
  Auth-less com telefone válido e bloqueios continuam sob a autoridade R2.
