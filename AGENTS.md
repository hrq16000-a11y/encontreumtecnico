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

## Padrão anti-site genérico — R8/10
- Para trabalho visual autorizado, ler `docs/skills/ANTI_GENERIC_EXPERIENCE.md` antes do código. A diretriz integra TasteSkill, Transitions.dev, React Bits e Emil Kowalski; não substitui as regras específicas deste repositório.

## Design engineering premium — Emil Kowalski (27/11/2026)

- Para qualquer trabalho visual autorizado, ler `docs/skills/EMIL_DESIGN_ENGINEERING.md` antes de editar runtime. Aplicar diagnóstico, direção de arte autoral, decisão de motion por frequência/propósito, performance, reduced motion e QA 390/768/1440; reaproveitar tokens e bibliotecas existentes.
- Referência oficial: https://github.com/emilkowalski/skills. As regras específicas deste repositório permanecem prioritárias. Esta documentação não autoriza execução automática de scripts, instalações, mudanças de código ou deploy.

## Padrão universal de contato e seleção contextual (27/11/2026)

- **Privacidade e identidade:** não publicar faixas decorativas de “Informações de contato” com e-mail operacional, cidade/endereço da operação, nome institucional antigo (Ping Soluções) ou cartões redundantes. Usar a marca própria do projeto e o canal/funil oficial existente. Não substituir a razão social por um nome inventado: aguardar a nova identidade confirmada. Distinguir informação promocional de identificação legal obrigatória, requisitos do comércio, privacidade/LGPD, endereço de cliente/loja autorizado e área geográfica de atendimento/SEO; preservar contratos e dados privados, sem alterar CNPJ, termos, integrações ou dados de terceiros por inferência.
- **Funil contextual em popup:** em CTAs de atendimento, orçamento, suporte, indicação ou cadastro, abrir o fluxo canônico sobre a página de origem (dialog/modal acessível, sheet no mobile quando adequado). Não navegar para uma página de contato como caminho comum. Preservar a rota e posição de scroll e capturar origem/posicionamento, especialidade, problema, objetivo, cidade/UF/bairro, modalidade/urgência apenas quando realmente conhecidos pela rota/ação ou selecionados pelo visitante. Reaproveitar contexto existente; não perguntar novamente nem obrigar a selecionar o que já foi confirmado. Permitir revisar/corrigir antes do envio. Manter link direto existente como fallback SSR/sem JS ou entrada deliberada, sem duplicar funil. Foco inicial e retorno ao gatilho, Escape, scroll interno, acessibilidade/teclado e reduced-motion; não perder rascunho por fechamento acidental.
- **Seleção inteligente universal:** para campos de escolha pesquisáveis (objetivo, especialidade, categoria, município, UF/bairro, serviço/produto, filtros e seletores administrativos compatíveis), permitir digitação + sugestões/autocomplete + seleção; não exigir percorrer catálogos extensos. Preferir componente combobox acessível já existente ou nativo comprovado; busca tolerante a caixa/acentos e sinônimos do catálogo, resultados priorizados e limitados, grupos quando úteis, estados vazio/loading/erro, navegação ↑/↓/Enter/Escape, toque e foco. Escolha automática somente quando correspondência inequívoca e confirmável, sem fingir decisão do visitante; guardar IDs canônicos, texto livre apenas onde permitido, e opção “Outro”/manual. Para escolhas pequenas, priorizar clareza e interação simples; quando compatível, permitir digitar. Preservar validação no servidor, catálogos, permissões, consentimento e contratos de checkout.
- **Contexto e dados:** prioridade = escolha explícita do visitante > contexto inequívoco da página/gatilho > defaults seguros; nunca sobrescrever edição ou inferir cidade/especialidade desconhecida. Origem imutável da abertura, UTM/atribuição sanitizadas; não incluir respostas, endereço, e-mail, telefone, dados privados, tokens ou texto livre em URL, analytics ou logs. Não armazenar ou enviar automaticamente; preservar as regras locais existentes de persistência autorizada, preços, revisão, consentimento e canal oficial.
- **QA/GO:** 390/768/1440 + teclado, reduced-motion, texto longo, lista de 100+ itens, pesquisa com/sem acento, vazio, seleção/auto-preenchimento explícito, edição/retorno, abrir/fechar na origem, contexto de serviço/cidade/problema e quatro intenções aplicáveis; nenhum envio real em QA. Preservar SSR, canonical, sitemap, SEO, LCP, acessibilidade, segurança, regras comerciais e isolamento por marca.
- **Execução:** norma permanente, não implementação estrutural automática. Inventariar os seletores/CTAs existentes, reutilizar a triagem/modal/combobox realmente compatível, integrar em micro-PR própria por projeto na futura rodada dedicada e publicar só com gates locais e confirmação. Não instalar dependências nem rodar agente/fila/Max do Lovable para esta documentação.
