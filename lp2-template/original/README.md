# Encontre um Técnico — TanStack Start (SSR)

Segunda geração, isolada da versão estática, sem alterar o WordPress nem o DNS.

- TanStack Start + TanStack Router com rotas limpas (sem `.html`)
- Vite + Nitro para deploy Vercel
- Galeria pública SSR/React a partir da API da prévia legada
- Cadastro de técnicos em React via proxy server-side para Vercel
- Demais jornadas serão migradas da prévia existente em fases controladas
- Logo original via URL pública da origem, provisoriamente; arquivo deve ser copiado localmente
- Homologação `noindex` até importação integral do MySQL e mídias WordPress

A ponte server-side em `src/server/proxy.ts` é transitória: os dados continuam na instalação Vercel já existente. Não declarar migração completa nem independência de WordPress neste estágio.
