# Encontre um Técnico — elegibilidade pública e revogação de cache

Preparação em 11/11/2026. **Nenhum SQL executado e nenhuma publicação realizada.**
Relações: PR #176 (grafo), PR #181 (falhas sintéticas), PR #186 (correção preparada).

## Regra única

Uma publicação de técnico exige: status aprovado, conta vinculada, ausência de bloqueio da conta por UUID e ausência de bloqueio do contato por telefone. O arquivo docs/sql/eut-public-eligibility-moderation-proposal-20261111.sql propõe uma função boolean de elegibilidade e RPC de lote que retorna somente IDs elegíveis. Não retorna contato, número, dono ou motivo de banimento.

O backend usa SECURITY DEFINER com search_path fixo para consultar tabelas privadas, revoga privilégios de execução amplos e conserva a leitura administrativa/do próprio dono. A política de leitura pública via RLS deverá exigir a elegibilidade além do status aprovado. A implementação de src/lib/public-eligibility.ts valida a resposta da RPC e falha fechada sem fallback permissivo.

**IMPORTANTE:** a migração está APENAS EM ARQUIVO. Sem a RPC aplicada e homologada, merge do código bloquearia a exibição normal dos técnicos. Não fazer merge, deploy ou aplicar SQL nesta rodada.

## Problema atual de cache

O grafo público pode manter informações por cerca de **5 minutos** e o sitemap tem CDN s-maxage=900, aproximadamente **15 minutos**. Um técnico suspenso/banido poderia continuar aparecendo em links e no XML já armazenados no cache, ainda que o banco passasse a negar novas leituras. Os testes sintéticos de #181/#186 não demonstram invalidação imediata de cache de múltiplas instâncias.

## Plano seguro para revogação imediata — ainda não implementado

1. A ação administrativa deve persistir e auditar o bloqueio antes de declarar sucesso. O status aprovado isoladamente nunca deve permitir publicar uma conta/telefone banido.
2. Inicialmente, retirar cache de dados moderados: no-store para HTML SSR com perfis, cidade/categoria e sitemaps, e dispensar cache de grafo de 5 minutos. Medir impacto de custo e latência antes de ativar, especialmente na leitura do catálogo IBGE.
3. Confirmar que nova requisição após commit de banimento retorna 404 no perfil, não inclui URL no sitemap, nem nome nos links relacionados. Página órfã deve responder 404, sem canonical indexável.
4. Caso o banco/RPC fique indisponível, responder erro sem expor dados antigos. Conteúdo já entregue anteriormente ao navegador não pode ser recolhido retroativamente.
5. Depois da homologação, avaliar cache chaveado por época de publicação: cada moderação incrementaria versão de elegibilidade, e a versão seria usada para evitar reuso de snapshots antigos. Estudar invalidação de CDN multi-região com APIs oficiais Vercel. Nenhum trigger, webhook, tabela, cron ou purge foi criado agora.

## Plano de staging isolado — sem execução

- Aprovado e depois banido por conta, sem mudar status: perfil 404, busca/interlinks/sitemap sem URL. Reaprovar ainda banido continua invisível.
- Aprovado e banido por telefone, incluindo variações de formato: mesma exclusão.
- Suspenso, pendente ou reprovado: nunca público; remoção da última pessoa da cidade/categoria elimina páginas órfãs.
- Reversão de banimento: não suspende automaticamente regras de status, e não contorna aprovação.
- Verificar direto via REST e RPC anônima, mantendo acesso legítimo de proprietário/admin, sem revelar tabelas e telefones privados.
- Em duas instâncias diferentes, verificar não existência de cache antigo após confirmar o bloqueio. Confirmar HTTP 200/404/503 e respostas no-store.
- Testes de carga em 100, 1.000, 15.000 e 50.000 perfis antes de habilitar no-store em produção.

## Checklist obrigatório antes de merge/publicação

- [x] Arquivos SQL e adaptador server-only preparados, não aplicados.
- [x] Testes sintéticos de bloqueio UUID/telefone, pendente e suspenso.
- [ ] Revisão de RLS, dono da função SECURITY DEFINER, privilégio EXECUTE e índices das tabelas, em staging autorizado.
- [ ] Aplicar SQL apenas em staging com autorização separada e testar consultas REST e RPC.
- [ ] Homologar remoção imediata de cache e HTTP 404 sem tocar contas reais.
- [ ] Reconciliar com a main atual e validar gates no mesmo commit.
- [ ] Aprovação explícita para qualquer alteração de banco, rollout e publicação.

**Status:** correção de código pronta para revisão e simulação. Banco e produção inalterados; operação real continua BLOQUEADA.
