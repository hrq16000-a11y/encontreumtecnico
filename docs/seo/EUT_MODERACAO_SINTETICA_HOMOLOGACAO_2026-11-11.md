# Encontre um Técnico — QA sintético de suspensão e banimento (11/11/2026)

## Escopo

PR filha #181, base #176. Apenas testes, documentação e workflow. Nenhuma alteração de SQL, Supabase, contas, banimentos reais, main, produção, DNS, WordPress, Lovable, Vercel ou AdSense.

## Evidências no GitHub

A primeira execução do workflow Technician location registration gate (run #43058598836) retornou **38 testes executados, 36 aprovados e 2 reprovados**. As quatro verificações novas sobre suspensão e exclusão de perfis foram aprovadas.

Falhas do gate vermelho de moderação:

1. **Conta banida ainda aprovada** — o grafo retornou presença do perfil sintético qa-banido-uuid, embora o critério esperado fosse invisibilidade.
2. **Telefone banido ainda aprovado** — o XML continha a URL sintética /tecnicos/qa-banido-telefone. Nenhum número real foi consultado.

Ambos são **bloqueios de segurança reais no contrato de elegibilidade**, e não erros de compilação. Os cenários sintéticos comprovam que o filtro de aprovação, sozinho, não implementa a regra de banimento independente do status.

## Matriz da simulação

| Cenário | Evidência | Situação |
|---|---|---|
| Pendente/reprovado | Não gera perfil nem URL | Teste passou |
| Suspenso após aprovação | Perfil removido da fotografia reconstruída | Teste passou |
| Único técnico da cidade suspenso | Cidade/categoria órfãs removidas do grafo e sitemap | Teste passou |
| Técnico suspenso relacionado | Seus links não aparecem no HTML SSR | Teste passou |
| Conta banida sem alteração de status | Perfil permanece elegível no grafo | **BLOQUEADO** |
| Telefone banido sem alteração de status | Sitemap ainda inclui a URL | **BLOQUEADO** |

## Causa

As fontes públicas de perfil e catálogo usam o filtro status = aprovado. Não existe no caminho público homologado um sinal seguro de moderação que exclua, também, identidades em listas privadas de contas ou telefones bloqueados. Não se deve permitir SELECT anônimo nessas listas nem expor telefones/UUIDs no HTML, JSON-LD, sitemap ou logs.

**Importante:** a simulação de suspensão recriou o grafo depois da mudança fictícia de status. Não comprova revogação imediata em produção. O código atual mantém cache da fotografia pública por até 5 minutos e o sitemap tem cache de CDN por 15 minutos, antes de considerar efeitos de propagação. Portanto, o requisito de exclusão imediata também está pendente.

## Correção mínima recomendada, não executada

1. Unificar elegibilidade pública no backend: perfil aprovado, conta não banida e contato não bloqueado. Expor apenas perfis aprovados, não os motivos privados.
2. Usar a mesma fonte de elegibilidade na busca, perfil individual, grafo de cidades/categorias, interlinks e sitemap. Manter RLS/privacidade e auditoria de bloqueio. Jamais usar service-role no cliente.
3. Garantir invalidação imediata dos caches quando um administrador suspende ou bane, inclusive sitemap paginado. Não assumir que só mudar o status limpa um cache previamente publicado.
4. Em staging isolado com identidades sintéticas autorizadas, homologar revogação e retorno HTTP 404 para perfis removidos; validar interlinks, arquivos XML e comportamento após expiração/limpeza de cache.

## Gates antes de publicar

- [x] Teste de suspensão, pendência e reprovação em grafo, SSR e sitemap
- [x] Falha reproduzida para conta banida ainda aprovada
- [x] Falha reproduzida para telefone banido ainda aprovado
- [ ] Fonte pública de elegibilidade segura disponível e revisada
- [ ] Dois testes de banimento aprovados, sem reduzir cobertura
- [ ] Build e TypeScript aprovados no HEAD da PR filha
- [ ] Homologação E2E de remoção e cache em staging autorizado
- [ ] PR #176 reconciliada com a main mais recente e gates repetidos

**Conclusão:** não publicar o grafo SEO na main. Nenhum cadastro real foi alterado. A PR #176 permanece em rascunho.
