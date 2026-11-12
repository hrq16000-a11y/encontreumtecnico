# Homologação SEO / SSR / HTTP e índice de sitemaps — EUT

**Data:** 11/11/2026. **Base:** PR #162 (`feature/eut-interlinks-cidades-categorias-20261111`). Trabalho isolado, sem merge, deploy ou alterações de banco.

## Entrega nesta PR de homologação

- `/sitemap.xml` torna-se um **índice de sitemaps**, referenciando exclusivamente caminhos canônicos existentes.
- Filhos servidos por handlers TanStack Start: `/sitemaps/base.xml`, `/sitemaps/cidades.xml`, `/sitemaps/categorias.xml`, `/sitemaps/tecnicos/1.xml`, `/sitemaps/tecnicos/2.xml`, etc., **apenas quando houver registros aprovados e indexáveis**.
- Perfis divididos em lotes de 1.000 URLs; páginas de catálogo inexistentes retornam 404 (não XML vazio com 200). Falhas de banco/catálogo retornam 503 sem cache de erro.
- Limites por XML: 50 mil URLs e 50 MiB, com exceção explícita em caso de excesso. A consulta de catálogo foi ampliada do teto de 10 mil para até 50 mil profissionais aprovados, com leitura sentinela para detectar mais de 50 mil. Não há garantia de desempenho em 50 mil sem teste de carga e eventual particionamento da leitura.
- A lista de URLs nunca se multiplica por combinações arbitrárias de bairro, serviço e município; apenas técnicos aprovados, cidades compatíveis com catálogo IBGE e categorias ativas com técnico.
- Preservado o `Sitemap:` já existente em `public/robots.txt`. Sem dados privados, telefones, leads, URLs de banidos conhecidos ou WordPress ainda não homologado.
- O código do AdSense permanece na PR #156, sem alterações ou ativação nesta rodada.

## Comprovação por CI, antes de Preview

1. Vitest de `public-sitemap-index` valida 15.005 perfis sintéticos, 16 arquivos de técnicos e a última página com 5 perfis.
2. Vitest de `public-sitemap-http` exercita **objetos HTTP Response reais** (200, 404 e 503) com leitura do grafo simulada: não consulta produção.
3. React `renderToStaticMarkup` comprova que links são efetivamente gerados em **HTML SSR**, sem exigir hidratação.
4. Testes das rotas validam o loader, canonical e `throw notFound()` para cidades e categorias ausentes, com mocks de fonte: não representam o comportamento HTTP de uma instância Vercel publicada.
5. Gate TanStack build + TypeScript confirma que o roteador reconhece as novas rotas e não introduz erros de compilação.

## Teste HTTP de ponta a ponta ainda obrigatório

`scripts/eut-seo-ssr-http-smoke.mjs` executa GETs **somente leitura** contra uma origem previamente disponibilizada e aprovada, exigindo URLs de município, categoria e técnico realmente existentes naquele ambiente.

Exemplo (executar somente quando houver Preview protegido disponível e autorizado):

```bash
EUT_SEO_SMOKE_ORIGIN="https://encontreumtecnico-SEU-PREVIEW.vercel.app" \
EUT_SEO_CITY_PATH="/cidades/pr/jardim-alegre" \
EUT_SEO_CATEGORY_PATH="/categorias/CATEGORIA-EXISTENTE" \
EUT_SEO_PROFILE_PATH="/tecnicos/PERFIL-APROVADO" \
node scripts/eut-seo-ssr-http-smoke.mjs
```

O teste consulta 200 (HTML, canonical, H1 e links rastreáveis), 404 para cidade/categoria inexistente e páginas de sitemap inexistentes, 200/XML para índice + arquivos reais; redirects não autorizados falham. A URL de Preview **não existe como artefato criado nesta rodada**; não afirmar que o HTTP público já está homologado.

## Critérios para liberar publicação

- Todos os workflows da PR devem terminar verdes na mesma revisão.
- O GitHub atualmente indica conflito entre PR #162 e a `main` em evolução; conciliar sem forçar merge, apagar histórico ou perder alterações recentes.
- Rodar o smoke HTTP acima com Preview da versão efetiva (não a antiga produção); verificar conteúdo XML, canonicals e links no navegador mobile/desktop.
- Verificar que bloqueio, suspensão e remoção de aprovação **retiram perfil e páginas órfãs do sitemap**.
- Medir tempo de resposta/uso da consulta pública em catálogos de 15 mil, 30 mil e 50 mil perfis antes de prometer escala operacional.
- Não publicar, modificar DNS, executar SQL persistente, cadastrar/banir usuários reais, nem alterar Lovable/WordPress/20 demos nesta rodada.

**Decisão atual:** preparação e CI. **Indexação pelo Google e disponibilidade pública ainda não comprovadas.**
