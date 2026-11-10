# Redesign C — Encontre um Técnico

## Objetivo
Superar a legibilidade, facilidade de busca, confiança informativa e navegação móvel do tema WordPress sem imitar a identidade dos concorrentes. Usar somente registros reais e fatos verificáveis.

## Benchmarks e decisões
- GetNinjas: categorias claras, busca simples e CTAs de jornada. Adaptar sem prometer quatro orçamentos ou avaliação não disponível.
- Cronoshare: formulários concisos, filtro por localidade, explicação do modelo de contato e transparência das fichas. Não replicar nota, selo verificado nem preço de terceiros.
- Identidade: preservar logo original; sistema de cores navy profundo + azul + acento turquesa; tipografia acessível; bordas arredondadas; detalhes vetoriais originais.

## Mapa final de blocos
1. Header sticky acessível, navegação mobile.
2. Hero orientado a tarefa: título "Encontre um técnico perto de você", busca por serviço/cidade, CTAs encontrar/cadastrar/publicar.
3. Trilha de especialidades ilustradas, com pesquisa pré-preenchida.
4. Como funciona: buscar, conhecer perfil, conversar diretamente.
5. Perfis públicos reais (somente cadastros reais; campos ausentes indicados; sem nota/selos inventados).
6. Solicitações aprovadas reais, se houver; estado vazio informativo.
7. Proposta de valor: negociação direta, técnico independente, cadastro grátis.
8. Banner de cadastro de profissionais.
9. FAQ/SEO, footer com rotas reais e link para WordPress original durante a migração.

## Copy principal
- Headline: "Encontre um técnico perto de você."
- Texto: "Pesquise por especialidade e região, conheça profissionais independentes e combine o atendimento diretamente."
- CTA primário: "Encontrar técnicos"
- CTA secundário: "Sou técnico — cadastrar grátis"
- CTA cliente: "Publicar uma solicitação"
- Prova operacional: "Perfis públicos reais", sem alegação de validação documental.
- Nota: "Perfis antigos podem ter dados incompletos até a importação WordPress."

## Etapas e marcos do redesign (independente da migração total)
1. Home, ilustração original e navegação móvel.
2. Busca/filtros, diretório e páginas de perfil premium.
3. Formulários, painéis de usuário e solicitações.
4. Acessibilidade, performance, segurança e gates externos de publicação.

## Regras
- Manter prévia noindex até restauração e reconciliação dos dados WordPress; não alterar DNS.
- Nunca criar depoimentos, avaliações, preços, contagem de atendimento, bairro ou cidade fictícios.
- Não bloquear cadastros ou links legados durante a reforma.
- Progresso do redesign é diferente de progresso da migração de dados históricos.

## Execução real da Opção C (06/11/2026)

- Rodada 1 — **home + navegação móvel**: aplicada no TanStack. Busca por serviço e cidade no topo, CTA técnico/cliente, ícones vetoriais, ilustração original em `public/illustrations/hero-tech.svg`, seções como funciona, FAQ e rodapé. Feita sem imagens, avaliações ou contagens inventadas.
- Rodada 2 — **galeria**: filtros por nome, serviço, cidade e UF, classificação e paginação visual; cards responsivos e identificação de informações de origem ainda não confirmadas.
- Rodada 3 — **jornadas**: cadastro de técnico em três etapas, comprovante com protocolo/chave copiáveis, layout da área de cliente, solicitações aprovadas e perfil individual reformulados.
- Rodada 4 — **qualidade/publicação**: TypeScript e SSR passaram no GitHub Actions; endpoint público está disponível pela Vercel. Validação HTTPS final do alias fixo e da nova imagem foi adicionada ao workflow.
- Commit publicável revisado: `42965a2836297ac30f29d90ab26d762b76164f74` (CI GitHub Actions #42170616657 success).
- Deploy Vercel existente do commit: `dpl_69J3Kk17vHxHHp3kurCPBv6pDCgS`, `READY`, publicado no alias fixo `https://encontreumtecnico-tanstack.vercel.app` por reatribuição do alias. **O deploy possui target preview (null), embora o alias seja público e fixo**; não alegar promoção de ambiente produção.
- Não alterar `encontreumtecnico.com` (WordPress, DNS), indexação (continua `noindex`), contas antigas ou os preços sem fonte.
- Próxima frente separada: MySQL e `wp-content/uploads`, autenticação Google e dados históricos. **Não equivalem ao redesign.**
