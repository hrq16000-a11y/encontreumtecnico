# LP2 — Cópia completa e isolada do tema TanStack

**Fonte:** [Projeto-Encontre-um @ 31d587cd](https://github.com/hrq16000-a11y/Projeto-Encontre-um/tree/31d587cd1ade864d8c7c55b6bd21e700b9d9a379/encontreumtecnico/tanstack)
**Origem Vercel:** https://encontreumtecnico-tanstack.vercel.app/
**Destino planejado:** https://encontreumtecnico.vercel.app/lp2

## Estado real

A pasta `original/` é um snapshot fiel dos **40 arquivos do projeto TanStack**, incluindo código de todas as páginas, arquivos de API, estilos, ilustração, logotipo e favicon. É uma cópia de preservação, não uma aplicação registrada nas rotas oficiais.

Nenhuma rota ou API original foi sobrescrita. O código-fonte arquivado não deve ser importado diretamente no app de produção sem adaptar CSS, navegação, API e autenticação.

## Mapeamento das páginas

| Original | LP2 proposta |
|---|---|
| `/` | `/lp2` |
| `/galeria` | `/lp2/galeria` |
| `/cadastro` | `/lp2/cadastro` |
| `/acompanhar` | `/lp2/acompanhar` |
| `/meu-perfil` | `/lp2/meu-perfil` |
| `/cliente` | `/lp2/cliente` |
| `/clientes` | `/lp2/clientes` |
| `/atividades` | `/lp2/atividades` |
| `/tecnico/:slug` | `/lp2/tecnico/:slug` |
| `/admin` | `/lp2/admin` |
| `/admin-portal` | `/lp2/admin-portal` |

## Integração e restrições

1. Criar camada de visualização `/lp2` com CSS exclusivamente escopado, sem afetar a UI atual ou `/home2`.
2. Todos os links internos devem permanecer sob `/lp2`.
3. **Não ativar APIs antigas da origem**, nem conectar formulários históricos às tabelas e permissões atuais sem validação; a migração de dados e segurança é separada.
4. Durante a homologação, adicionar `noindex,nofollow` e não colocar LP2 em sitemap.
5. Gate de regressão: build, rotas atuais preservadas, login oficial intacto, sem novos segredos e sem modificar DNS.

**Status:** snapshot completo salvo na branch isolada. As rotas /lp2 ainda não foram implementadas/publicadas.
