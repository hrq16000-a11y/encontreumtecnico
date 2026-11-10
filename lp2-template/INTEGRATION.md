# LP2 / rodada 3 — integração do template original

Fonte integral preservada em `lp2-template/original`, commit original `31d587cd1ade864d8c7c55b6bd21e700b9d9a379`. Esta rodada adiciona as páginas TanStack sob `src/routes/lp2/`, sem modificar qualquer arquivo preexistente de rota, layout global, banco, credenciais ou configuração Vercel.

## Rotas LP2

- /lp2 (home original)
- /lp2/galeria (filtros + estados vazios)
- /lp2/cadastro (formulário visual)
- /lp2/acompanhar (formulário visual)
- /lp2/meu-perfil (formulário visual)
- /lp2/cliente (formulários visuais)
- /lp2/clientes (diretório visual)
- /lp2/atividades (solicitações visuais)
- /lp2/admin (interface administrativa sem autenticação ativa)
- /lp2/admin-portal (redirecionamento interno)
- /lp2/tecnico/:slug (estado de perfil indisponível, sem requisição externa)

## Segurança por padrão

- CSS original em `src/components/lp2/theme.css` encapsulado por `@scope (.lp2-theme)`; design não sobrepõe páginas oficiais.
- Navegação dentro do namespace; logo e ilustração em `public/lp2-assets/`.
- A LP2 não realiza chamadas de rede originais nem grava cadastros: funções `api` e `lp2Fetch` são bloqueadores explícitos.
- Dados dinâmicos de diretório, clientes e solicitações **não** são copiados nem inventados. Os estados vazios indicam a ausência de integração.
- Login Google, chaves administrativas e endpoints de produção continuam independentes. Nenhum dado privado é processado pela LP2.
- URLs LP2 estão em `noindex,nofollow` durante homologação.

## Verificações

Teste estático em `src/test/lp2-isolation.test.ts`; build e smoke de preview precisam ser comprovados antes de merge. Não publicar produção nesta rodada; não alterar DNS.
