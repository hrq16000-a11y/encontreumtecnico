# AGENTS.md — Encontre um Técnico

## Fonte de verdade e governança

- Aplicação TanStack Start em `src/routes/`, interface compartilhada em `src/components/`; repositório oficial GitHub `hrq16000-a11y/encontreumtecnico`, deploy controlado no projeto Vercel `msolus/encontreumtecnico`.
- O backend ativo é o Supabase **dedicado ao Encontre um Técnico**. Não criar outro banco, não migrar para Lovable Cloud e não executar migrations/SQL sem autorização explícita e procedimento auditado.
- Metadados herdados em `.lovable/`, dependências `@lovable.dev/*` e referências históricas não demonstram que Lovable seja o controlador atual da publicação. Preservar integrações ainda referenciadas; não removê-las sem prova de ausência de dependência.
- GitHub é a fonte de código; não usar Lovable ou Max mode para mudanças ordinárias. Preservar histórico publicado; nunca forçar push/rebase de commits públicos.
- `vercel.json` desativa deploy automático por push; publicar somente quando gates aprovados, SHA conferido, rollback disponível e a mudança exigir release.

## Contratos críticos

- A identidade administrativa depende de autorização no servidor, com validação de e-mail e papel; nunca conceder admin por metadados editáveis pelo cliente.
- Pesquisa de técnicos, perfis, localização, funis e painel devem preservar privacidade e autorização no servidor. Telefone privado não pode vazar em SSR, HTML público, sitemap, logs, JSON-LD ou respostas de busca.
- Funil: recolher consentimento e persistir a solicitação conforme contratos antes de qualquer compartilhamento permitido. Não criar leads fictícios em produção e não ativar pagamento/contato pago por alteração incidental.
- A integração de IA existente usa `@lovable.dev/ai-gateway` em funções de servidor. Não colocar chaves no cliente e não excluir o gateway sem substituição e testes completos.
- O catálogo, as rotas SSR, `canonical`, `robots`, `sitemap.xml`, redirecionamentos legítimos e 404 reais devem continuar verificáveis.
- Não alterar DNS, Vercel, banco, WordPress, Supabase, dados, importações, pagamentos, anúncios ou controles administrativos fora do escopo aprovado.

## Preservação e limpeza

- **Não tratar nomes `legacy`, `wordpress`, `lp2-template/original`, `supabase/migrations`, `docs/sql` e backups como provas de obsolescência.** São arquivos de rastreabilidade, reconciliação de titulares, mídias, rotas e recuperação.
- Revisar referências do runtime, testes, workflows, rotas históricas, SEO e plano de restauração antes de remover código ou arquivos. Apagar somente itens com ausência de uso comprovada.
- Uma micro-rodada por tema, mudanças mínimas, CI real; merge e no máximo um deployment quando indispensável. Não desativar nem afrouxar gates para desbloquear fila.
- Diferenciar **teste estático**, **CI aprovado**, **Vercel READY** e **QA HTTP real**. Nenhum deles isoladamente prova paridade funcional completa com o portal anterior.

## Arquitetura e navegação

- Filtros de técnicos em `/tecnicos`, com parâmetros de consulta para especialidade, cidade e região, e links profundos nas categorias.
- Pesquisas analíticas consentidas não devem incluir identidade do visitante; agregações administrativas exigem autorização/RLS.
- Para alterações de integração, consultar `README.md`, documentação de migração e workflows específicos, sempre conferindo a validade temporal dos documentos.
- Para ferramentas abertas de atendimento, CRM, documentos, agenda ou IA, consultar `docs/integrations/open-source-compatibility-2026-11-18.md`; nenhuma integração externa está automaticamente autorizada.

## Adoção visual de referências externas (17/11/2026)

- TasteSkill (https://www.tasteskill.dev/): método de direção de arte, revisão visual e hierarquia; nunca copiar marca, material ou instalar scripts externos sem revisão.
- Transitions.dev (https://transitions.dev/): microtransições CSS em filtros, menus, modais, estados de formulário e feedback; respeitar `prefers-reduced-motion`, foco, teclado, Escape e contraste. Evitar `transition: all`.
- React Bits (https://reactbits.dev/): componentes React isolados da edição gratuita, com revisão da licença MIT + Commons Clause, dependências e custo de renderização; não instalar o catálogo inteiro nem assumir acesso ao Pro.
- RiseClub (https://riseclub.tech/): referência conceitual para comunidade e aprendizagem. Não copiar cursos, artigos, dados de usuários, imagens ou elementos protegidos.
- Prioridades locais: Home, `/tecnicos`, cards/perfis e painel administrativo 390/1440; preservar SSR, LCP, SEO, funis, dados reais e contatos privados.
- Mudanças funcionais: micro-PR isolada com comparação visual e gates existentes. Esta diretriz não autoriza deploy, alteração de DNS, pagamentos, dados, Supabase ou RLS.

## Controle exclusivo de edição e busca local (28/11/2026)
- Nunca editar main simultaneamente no Lovable e no GitHub. Em divergência, proteger ambos os SHAs, reconciliar a branch de sincronização por merge normal, preservar rascunhos escopados, testar e só então sincronizar a prévia. Sem reset/force push.
- Busca primária: serviço/especialidade + Encontrar agora e localidade compacta, visível e corrigível. Preferência explícita > contexto/sessão > IP aproximado > correção manual; GPS apenas sob clique e aviso de privacidade. Não presumir endereço, bairro ou cidade por operadora/DDD. Não apresentar perfis distantes como locais; alternativas abertas por escolha.
- Ver contrato e registro: docs/RECONCILIACAO_LOVABLE_BUSCA_LOCAL_2026-11-28.md.
