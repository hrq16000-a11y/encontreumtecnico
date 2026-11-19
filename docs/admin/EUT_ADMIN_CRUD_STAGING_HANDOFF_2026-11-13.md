# Encontre um Técnico — passagem de homologação do CRUD administrativo

**Estado:** preparação offline; não há autorização nem comprovação de instalação das RPCs no Supabase hospedado.

## Avanço local posterior a `efd56fa`

- O fixture agora **interrompe antes de criar qualquer objeto** se banco e usuário não forem ambos `eut_fixture`, ou se os schemas/papéis sintéticos já existirem. Não é um script de migração genérico.
- Casos negativos adicionais de RPC: telefone de destino bloqueado; campo fora da lista permitida; código de município ausente do catálogo; falha de auditoria durante **arquivamento**, com verificação de rollback do status, marcador de arquivo e consentimento do contato.
- Os 14 testes Vitest diretamente relacionados ao contrato/payload/validação local passaram. O teste completo de transações SQL **continua não executado** por ausência de PostgreSQL descartável nesta estação.
- A checagem global `tsc --noEmit` desta sessão foi bloqueada por tipagens de rotas geradas desatualizadas (`src/routeTree.gen.ts`), fora dos arquivos alterados nesta passagem; não classificar isso como gate verde.

## Fonte de verdade

- Base local: `d56efae`, sucessora de `d08823b`; preservar o histórico da `main`.
- Editor avançado: `src/components/admin-technician-comprehensive-draft.tsx` continua `preview_only`.
- Proposta de RPCs: `docs/sql/eut-admin-technician-crud-staging-proposal-20261111.sql`.
- Teste SQL: `docs/sql/tests/eut-admin-crud-ephemeral-schema-20261111.sql` e `...-assertions-20261111.sql`.
- Gate existente: `.github/workflows/eut-admin-rpc-ephemeral.yml` — dispara apenas por PR com alterações nos caminhos monitorados, sem disparo manual.

## Etapa 1 — testes em PostgreSQL descartável

Usar exclusivamente instância **nova e vazia** PostgreSQL 16, com usuários fictícios do fixture. Com `psql -X -v ON_ERROR_STOP=1`, executar, nesta ordem:

1. Schema sintético `eut-admin-crud-ephemeral-schema-20261111.sql`.
2. Proposta de RPCs `eut-admin-technician-crud-staging-proposal-20261111.sql`.
3. Asserções `eut-admin-crud-ephemeral-assertions-20261111.sql`.

O workflow já isola a execução com `postgres:16-alpine`, usuário e banco de teste. **Não** fornecer URL, JWT, dumps privados ou chaves do Supabase real ao job. A execução nesta conversa fica limitada a testes TypeScript/estáticos, caso não exista PostgreSQL local descartável.

Asserções mínimas: anônimo/cliente/admin não verificado negados; conflito de versão; município IBGE e cobertura na mesma transação; categorias e serviços válidos; telefone duplicado/bloqueado; `keep`, `replace` e `remove` privados; arquivar/restaurar sem desbanir; falha forçada de auditoria com rollback integral. Auditoria guarda somente sufixo do telefone.

## Etapa 2 — preflight de staging realmente isolado

**Somente após autorização própria** e identificação inequívoca de uma instância de staging, distinta da produção:

1. Conferir estrutura e versões de tabelas, funções, triggers e tipos existentes, sem copiar registros pessoais.
2. Conferir constraints, número de telefones duplicados **somente por contagem agregada**, banimentos e dependências de `archived_technicians`.
3. Verificar se `CREATE UNIQUE INDEX` exigiria saneamento e se a atualização de cidade dispara o gatilho que limpa cobertura; qualquer divergência bloqueia instalação.
4. Aplicar a proposta dentro do fluxo auditado de staging, com snapshot de esquema, rota de rollback e registro da revisão.
5. Repetir casos de permissão com identidades fictícias e verificar se a trilha de auditoria não contém o telefone completo. Sem e-mails ou números verdadeiros.

## Critérios para liberar gravação no painel

- RPCs instaladas e verificadas **na instância correta**, sem grants anônimos; testes transacionais, de concorrência e rollback verdes.
- A aplicação só deve ativar ações de salvar/arquivar quando a função real confirmar versão, identidade, autorização e auditoria.
- A opção `preview_only` permanece até essa comprovação. Não implementar UPDATE direto do navegador sobre `technicians` ou contatos privados.
- Nenhum merge/deploy/DNS/SQL de produção ocorre nesta passagem. O banco real permanece intocado.

**Bloqueio atual:** ausência de PostgreSQL local descartável e de staging autorizado/identificado. O gate já existente em GitHub Actions usa PostgreSQL 16 descartável apenas em PR com arquivos SQL monitorados; **não foi disparado** nesta rodada. Testes estáticos não equivalem a homologação SQL real.
