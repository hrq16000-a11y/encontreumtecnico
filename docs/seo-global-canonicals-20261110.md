# Micro-rodada SEO global — canonicals e indexabilidade

## Alterações
- Canonical self para quatro rotas públicas: /servicos, /como-funciona, /faq e /contato.
- OG URL para /servicos e /como-funciona; FAQ e contato passam canonicalPath ao pageHead.
- Canonical /home2 normalizado para o host oficial com www, mantendo noindex/nofollow.
- Novo teste de canonicals, sitemap, robots, redirects e noindex; CI SEO executa build, vitest e TypeScript.

## Home2
A versão /home2 apresenta o mesmo produto e intenção principal da homepage (busca de técnicos e serviços), mudando prioritariamente o visual. Manter noindex e fora do sitemap até haver conteúdo próprio, distinto e útil, validado editorialmente. Não forçar indexação de páginas duplicadas.

## Inventário preservado
- /, /tecnicos, /lp2 e /lp2/galeria possuem canonicals self. O conteúdo público da LP2 deve ser monitorado por similaridade com a home.
- Páginas legais com pageHead(..., canonicalPath) mantêm canonicals próprios.
- /tecnicos/:id e /lp2/tecnico/:slug indexáveis somente para profissionais aprovados; indisponíveis usam noindex.
- Login, administração, solicitação e acervo histórico em validação continuam noindex.
- sitemap.xml publica 17 URLs públicas estáticas; Home2 e áreas privadas ficam fora. Perfis aprovados não constam dinamicamente no sitemap.
- robots.txt aponta para www.encontreumtecnico.com/sitemap.xml; Vercel aliases e DNS não foram alterados.
- Redirecionamentos legados /lista-de-tecnicos, /termos-de-uso, /politica-de-privacidade e /politica-de-cookies preservados.

## Antes de publicar
- Reconciliar branch com main atual.
- Gate SEO, build, vitest e TypeScript aprovados.
- Não alterar banco, DNS, variáveis secretas nem outras rotas.

## Pendências externas
- Verificar HTTP 200 e HTML renderizado das páginas, cabeçalhos de redirects, canonical e robots de produção.
- Confirmar sitemap lido no Search Console, inspeções individuais e URLs efetivamente indexadas. A integração GSC Wizard está indisponível por assinatura encerrada.
- Definir futura indexação de perfis aprovados via sitemap dinâmico, caso a cobertura cresça.
