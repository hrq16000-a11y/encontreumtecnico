# Release — confirmação de moderação administrativa (PR #346)

**Data:** 20/11/2026
**Merge funcional:** `e975e4743379ac81517088402eec23d78604f70d`.

## Escopo

- O painel só confirma uma ação de moderação quando a resposta da RPC auditada inclui o identificador e o estado realmente esperado; respostas incompletas ou divergentes não são tratadas como gravações bem-sucedidas.
- Não altera SQL de produção, RLS, autorização, dados, telefones privados, contatos suspensos ou registros dos Pioneiros.
- Nenhum perfil sintético é gravado no ambiente oficial.

## Evidências antes da liberação

- PR #346: CI, gate do painel administrativo, proteção de contatos públicos e homologação autenticada isolada aprovados no HEAD `7632481d424b1beb8b5f44a6326cbace5f66160b`.
- Supabase/GoTrue/PostgREST/Postgres locais e descartáveis: 2 sessões autenticadas (administrador e não administrador), 5 transições de status, 1 edição, 6 registros de auditoria, cenários de ações sem permissão, entradas inválidas e RLS rejeitados.
- A homologação verifica a operação SQL/trigger já versionados em `docs/sql/eut-admin-management-actions-20261111.sql`, sem executar operações contra a instância hospedada.
- SHA de produção antes do release: `762e70815e0a81df0fdf56ddcf1d22be59fdbdea`, Vercel READY. Diferença no código da aplicação restrita à PR #346.

## Controle de publicação

- O deploy manual do merge funcional `e975e474` foi **CANCELED** pelo Ignored Build Step: título sem `release:` / `[publish]`. ID `dpl_DFEUhNPmwkptUYmk6smKj36WxMzU`; não chegou a READY nem alterou os aliases.
- Este registro autoriza o commit de merge de release com prefixo `release:` conforme a regra atual, sem modificar o gate ou o arquivo `vercel.json`.
- Publicar manualmente apenas após gates verdes no HEAD final; conferir Vercel READY, SHA exato e aliases oficiais. Se falhar, preservar a implantação anterior e registrar o bloqueio.
