# EUT — segurança RLS / elegibilidade / HTTP 404: preparação para staging

**Revisão isolada, 11/11/2026. Nenhum SQL foi executado. Nenhum deploy/merge.**

## Evidências do código, não da produção

- A função privilegiada que consulta banimentos por conta e telefone foi movida, **somente no rascunho SQL**, para `eut_visibility`, esquema que **não poderá** ser exposto no PostgREST. O endpoint `public.eut_public_eligible_technician_ids` proposto roda como `SECURITY INVOKER`, com RLS e máximo de 500 IDs solicitados.
- O rascunho usa política `AS RESTRICTIVE FOR SELECT TO anon` em `public.technicians`; evita adicionar uma política permissiva que pudesse ser contornada por outra permissão anônima. **Não substitui nem apaga políticas administrativas existentes.** Políticas reais e a ordem de avaliação precisam de revisão em staging.
- O helper continua `SECURITY DEFINER` para ler listas privadas sem expor seus dados. **P0:** proprietário, privilégios `BYPASSRLS`, política de execução e esquema exposto devem ser comprovados em staging. Se o proprietário não contornar a RLS de `technicians`, a função poderá entrar em recursão. A concessão de `USAGE` no novo esquema também exige auditoria.
- A leitura pública do portal usa chave publicável, sem sessão de usuário, e chama a RPC antes de exibir perfis, listas, grafo ou sitemaps. Testes de browser e de sessões autenticadas precisam comprovar a separação entre consulta pública e administração.
- O código da PR #192 prepara `no-store` e reavalia os profissionais em requisições novas. Não invalida retroativamente conteúdo já entregue/caches antigos.

## Testes sintéticos nesta branch

- Verificação de contrato SQL: nenhum helper `SECURITY DEFINER` no esquema exposto, RPC `SECURITY INVOKER`, política restritiva e vedação de acesso direto a listas privadas.
- Integração de `getApprovedTechnician` com RPC simulada: aprovado aparece, depois RPC nega e função retorna `null`; falha da RPC lança erro em vez de falso 404.
- Loader TanStack do perfil: elegível recebe canonical; perfil revogado lança `notFound` (404 na semântica do roteador); identificador malformado retorna `notFound` sem consulta ao backend.
- Testes anteriores de cidade/categoria, XML e cabeçalhos `no-store` continuam obrigatórios no gate.

**Limite explícito:** os testes do loader exercitam erro 404 em memória, não observam status HTTP de uma implantação real. Não se deve declarar E2E de staging aprovado sem SQL, endpoint e Preview isolados.

## Checklist de homologação posterior, somente com aprovação independente

- [ ] Inspecionar políticas vigentes, papel proprietário de `SECURITY DEFINER`, esquema exposto em PostgREST e grants de tabelas/funções.
- [ ] Criar staging descartável, sem usuários, números, imagens ou dados copiados da produção.
- [ ] Validar anon SELECT e RPC: aprovado 200; status suspenso, banimento por conta, por telefone e reaprovação de banido => não elegível.
- [ ] Validar admin/owner autorizados, dados privados não expostos, testes de privilégios e de recursão RLS.
- [ ] Validar 404 HTTP real em perfil/cidade/categoria órfãs, remoção de sitemap/interlinks e `no-store` em múltiplas instâncias, após revogação fictícia.
- [ ] Simular RPC indisponível e verificar 5xx sem fallback de visibilidade.
- [ ] Medir carga, especialmente consultas repetidas por sitemap e 15k técnicos.
- [ ] Preparar rollback compatível com políticas existentes e ativação segura: banco homologado primeiro; código depois.
- [ ] Reconciliar com a `main` mais recente sem regressão, preservar AdSense #156 e programa de destaques reservado.

**BLOQUEIO:** nenhum merge, deploy ou SQL sem homologação independente. Este arquivo não concede autorização de execução.
