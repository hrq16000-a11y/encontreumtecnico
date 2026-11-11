# Encontre um Técnico — grafo público de cidades, categorias e profissionais (11/11/2026)

## Escopo desta micro-rodada
- Perfis aprovados `/tecnicos/:slug` conectam-se às páginas canônicas da **cidade-base** (`/cidades/:uf/:cidade`) e das **categorias ativas** (`/categorias/:slug`).
- O perfil também sugere até **seis outros perfis aprovados**, classificados por mesma cidade, categoria ou serviço informado. Os links não significam recomendação, parceria comercial, verificação, proximidade exata, qualificação ou avaliação.
- A página da cidade lista técnicos cuja cidade-base informada corresponde a um **município reconhecido no catálogo IBGE** (não "Região Metropolitana" nem bairro). A página da categoria lista técnicos que realmente a selecionaram e liga às respectivas cidades-base válidas.
- O sitemap atual incorpora URLs canônicas dessas cidades e categorias com ao menos um técnico aprovado, além dos perfis existentes, sem gerar duplicatas ou parâmetros de pesquisa. Alterações de cadastro aparecem após a atualização da cache e do sitemap, sem edições manuais.
- Registros antigos de WordPress ainda não aprovados, contatos ocultos e perfis inválidos **não** alimentam a malha.

## Evidência observada antes da mudança
Consulta somente leitura ao Supabase EUT: **5 técnicos aprovados** e com slug, **4** cuja cidade corresponde ao catálogo de **5.571 municípios**, **10 categorias ativas** no catálogo. O quinto perfil usa nome de região metropolitana, que não vira uma cidade de SEO.

## Engenharia e governança
- Source server-only via `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`, com `status = aprovado`; não há `service_role`, tabelas de contatos privados, SQL de escrita, Auth Hook ou dependência da API WordPress.
- `buildPublicGraph` deduplica slugs, valida município IBGE e categoria ativa, aplica a proteção de nome público e não aceita combinação bairro×cidade×serviço inventada.
- Cache em memória por instância (5 minutos), cabeçalho do sitemap `s-maxage=900`: atualizações **eventuais**, sem promise de indexação ou atualização instantânea.
- Na PR filha #166, o `/sitemap.xml` passa a ser um índice, com shards por tipo e lotes de 1.000 perfis. A fonte de leitura foi ampliada para até 50.000 perfis aprovados em páginas de 500, com consulta sentinela contra truncamento. Acima desse limite, o backend sinaliza **503**, em vez de fingir que publicou tudo. **Isso é um teto técnico, não homologação de desempenho com 50 mil contas**; medir carga e particionar leituras antes de escalar.
- `getSeoCity` e `getSeoCategory` retornam null e as rotas respondem HTTP 404 quando não houver profissional real com correspondência; `head` define canonicals sem parâmetros.
- É necessário homologar SSR e SEO via HTML real em Preview (200/404, canônicas, links `<a href>`, sitemap XML), testes com alterações no cadastro e um cenário de retirada de aprovação.
- CUIDADO: `status=aprovado` é a fronteira pública existente no diretório. Verificar que todos os banimentos persistentes também retiram efetivamente da consulta pública de técnicos. Não alegar invisibilidade de conta banida sem teste server-side integrado ao controle de moderação.
- **Não haverá qualquer multiplicação artificial de URLs**: o crescimento são nós reais e caminhos úteis para encontrar o técnico, não páginas de doorway ou conteúdo em escala sem valor.

## Pendente
1. Confirmar, em ambiente controlado, acesso anônimo aos dados de catálogo/IBGE e detalhes da moderação, sem expor números.
2. Validar CI, build e sitemap XML; verificar uma URL com cidade reconhecida, uma categoria com técnicos e duas URLs 404.
3. Revisar UX mobile e carga do grafo em amostras de 15 mil, 30 mil e 50 mil técnicos; o índice foi preparado, mas precisa de Preview e testes de desempenho antes de ativação.
4. Reconciliar alterações da `main` que continuam chegando de outras rodadas. Não forçar merge/rebase nem publicar sem gates.
5. Concluir PRs pendentes de autenticação e PR #156 AdSense separadamente; não alterar DNS, Lovable, Vercel, WordPress, 20 demos ou dados reais nesta rodada.

Referências: Google Search Central — [links rastreáveis](https://developers.google.com/search/docs/crawling-indexing/links-crawlable), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) e [políticas anti-spam](https://developers.google.com/search/docs/essentials/spam-policies).
