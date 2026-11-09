# Encontre um Técnico — consolidação no Vercel principal (rodada 1/5, 09/11/2026)

## Destino e isolamento
- **Destino único do novo portal:** Vercel `msolus/encontreumtecnico` — `prj_VaqJJAu3HfqcsRtUqZmeD8LCOaIy`.
- **Código principal e layout clean aprovado:** `hrq16000-a11y/encontreumtecnico` (TanStack Start/Lovable, branch `main` e fluxo `lovable-sync`).
- **Banco de dados a preservar:** Supabase `pqtzhctvjbfcunmrvxne`; 912 contas WordPress/654 perfis no staging privado (384 técnicos e 270 contratantes, na última inspeção), ainda não transformados em contas Google ou perfis públicos ativos.
- **Origem em produção:** WordPress original continua online; sem mudança de DNS, remoção de dados ou corte de tráfego. Visual original e novo não precisam coincidir.

## Origens a conciliar — não são cópias equivalentes
| Projeto Vercel | GitHub | Situação / encaminhamento |
|---|---|---|
| `encontreumtecnico` | `hrq16000-a11y/encontreumtecnico` | **Aplicação escolhida**: mantém a UI, login Google/Supabase, painel, busca e solicitações do novo código |
| `encontreumtecnico-tanstack` | `hrq16000-a11y/Projeto-Encontre-um` em `encontreumtecnico/tanstack` | Prévia TanStack de geração anterior, último deploy READY; usa proxy para APIs antigas e URLs `/galeria`, `/cadastro`, `/cliente`, `/tecnico/:slug` etc. Recuperar apenas recursos compatíveis |
| `encontreumtecnico-migracao` | Mesmo GitHub anterior, pasta `encontreumtecnico` | Primeira migração, último deploy ERROR; usa **Vercel Blob privado e token administrativo**, em vez de contas/RLS Supabase. Não ligar em produção sem reconciliação de novos registros |
| `encontreum.online` | `hrq16000-a11y/encontre_um-online` | Portal independente. **Não mesclar** aplicação, usuários ou dados automaticamente |
| `zeroweb-2026` e `emporiolelecute` | Repositórios comerciais separados | Fora do escopo |

## Capacidade anterior que não deve ser perdida
- Prévia antiga tinha fluxo técnico: cadastro, moderação, galeria, edição/reaprovação; cliente e solicitações usando APIs + armazenamento Blob.
- TanStack anterior tinha SSR, galerias, avatares, especialidades, rotas legadas e bridge server-side.
- Novo projeto usa Google/Supabase Auth, RBAC/RLS e registro transacional. **Não copiar** token administrativo, chave de protocolo ou gravação Blob como autoridade sobre as novas contas.
- **Verificar se existe qualquer cadastro novo efetivo nos Blobs antigos** antes de desligar/deletar projetos, pois dados de homologação podem ser reais.
- Ativar galeria pública só após revisão, titularidade e consentimento; não interpretar 384 perfis históricos como 384 aprovados no sistema novo.

## Trabalho integrado nesta rodada
- Compatibilidade da rota `/galeria?q=<categoria>&city=<cidade>` com `/tecnicos?especialidade=...&cidade=...`.
- Conversão limitada a sinônimos conhecidos; termos desconhecidos não são falsamente interpretados como especialidades e resultam no filtro `Todas`.
- Rota `/cadastro` antiga aponta temporariamente à entrada unificada `/entrar`.
- Ambos são redirecionamentos temporários **302** no novo projeto apenas; não alteram as URLs no WordPress ou nas outras Vercels.
- Testes unitários escritos em `src/lib/legacy-navigation.test.ts`. Execução de testes, build e preview devem ser confirmados antes do merge.

## Rodadas seguintes (micro-escopos)
1. **Inventário e compatibilidade** (esta) — mapa de projetos, rotas preservadas, primeira PR e Preview.
2. **Cadastros e mídia** — reconciliar itens no Vercel Blob da homologação anterior com staging privado do Supabase e uploads originais, deduplicar sem publicar.
3. **Integração funcional** — titularidade/reivindicação do perfil, clientes, solicitações, especialidades, localização e avatares no destino único.
4. **Autenticação, privacidade e qualidade** — conta Google administrativa real, RLS, histórico, testes E2E e anti-spam; sem segredos no código.
5. **Homologação final** — cobertura de rotas/SEO, mídia, rollback, busca e fluxo completo; somente depois considerar DNS e desligamento das versões antigas.

## Gates
Nunca copiar dados privados do WordPress/WhatsApp/Blob para GitHub. Não fazer merge massivo de repositórios com bases diferentes. Não desligar projetos antigos nem redirecionar os domínios até reconciliação das gravações e testes. Não usar Lovable Max mode. Manter `noindex` do projeto novo durante homologação.
