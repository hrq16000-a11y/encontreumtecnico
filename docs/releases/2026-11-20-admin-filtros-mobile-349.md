# Release controlado — filtros administrativos mobile (#349)

- **Base funcional:** `main` em `896270c334bdc4b8fdc025d2a2935393e00ad787`, após integração da PR #349.
- **Gates #349:** HEAD `c394fffdede8d3628738556626dce51bdd18f9e1`, 4/4 GitHub Actions concluídos com sucesso (CI, controle administrativo, proteção de contatos e QA isolado).
- **Melhoria:** entradas de município e bairro aguardam 300 ms de digitação antes de renovar a consulta; a ação **Limpar busca e filtros** restaura os critérios, a ordenação e a paginação sem trocar a aba administrativa de situação.
- **Compatibilidade:** a mesma `main` já inclui a PR #350 (busca global não deve aplicar resultados obsoletos), validada por CI e gate administrativo verdes; nenhum código externo à main foi agregado.
- **Escopo de dados:** sem alteração de SQL, RLS, registros, telefones privados ou contatos suspensos. Nenhuma alteração de DNS, Supabase, pagamento ou funil.
- **Release:** utilizar o prefixo `release:` exigido pelo Ignored Build Step existente e confirmar o commit e os aliases de produção somente quando o deployment atingir READY. Evitar deploy redundante.
