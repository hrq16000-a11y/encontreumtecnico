# Encontre um Técnico

Portal nacional de técnicos, com aplicação **TanStack Start**, código versionado no GitHub, publicação controlada na **Vercel** e backend dedicado no **Supabase**.

- Repositório oficial: https://github.com/hrq16000-a11y/encontreumtecnico
- Projeto Vercel: `msolus/encontreumtecnico`
- Domínio público: https://www.encontreumtecnico.com.br

## Desenvolvimento

Requer Node.js compatível com o projeto e Bun para utilizar o lockfile `bun.lock`.

```sh
bun install --frozen-lockfile
bun run dev
bun run test
bunx tsc --noEmit
bun run build
```

Os testes de integração, privacidade, SEO, navegação e os demais gates também estão em `.github/workflows/`. Não considere uma mudança pronta apenas porque o build local passou.

## Publicação segura

- Desenvolver em branch isolada e submeter PR para CI e revisão.
- Mesclar somente com os gates necessários aprovados; conferir a `main` e os commits concorrentes.
- A Vercel tem `git.deploymentEnabled: false` em `vercel.json`: publicação requer processo controlado, não pressupor deploy a cada push.
- Confirmar o SHA publicado, estado READY, aliases, páginas públicas, SEO, privacidade e fluxos essenciais antes de declarar conclusão.
- Preservar dados, DNS, contas, mídias históricas, rotas legadas, backups e migrations. Não executar SQL nem eliminar registros/importações sem autorização específica, validação de cópia e plano de restauração.

## Escopo dos sistemas

O Supabase usado pela aplicação é dedicado ao projeto. A pasta `supabase/migrations` e os documentos de migração são parte do histórico técnico e **não devem ser apagados por limpeza cosmética**. Código ainda pode utilizar pacotes originários do Lovable: descontinuá-los exige análise de dependências e testes, não exclusão por nome.

A pasta `lp2-template/original` preserva o snapshot original do tema TanStack para comparação, e o acervo WordPress continua relevante para conciliação de cadastros, URLs e mídias. Esses registros não equivalem a uma dependência de runtime do WordPress.

Consulte `AGENTS.md`, os gates da PR correspondente e os documentos de cutover antes de alterar autenticação, autorização, pagamentos ou infraestrutura.
