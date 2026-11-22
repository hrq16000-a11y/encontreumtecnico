---
name: shared-reference-intelligence
description: Select safe, relevant design, motion, React, accessibility, browser QA and database-audit references for work in any of the owner's projects; never install third-party code by default.
---

# Inteligência de referências e skills — protocolo portátil v1 (2026-11-20)

## Gatilho e precedência
Use em tarefas não triviais de UI, portfólios **novos**, React/TanStack, QA responsivo, acessibilidade, SQL de diagnóstico, RLS ou segurança. Em cada repositório, leia **primeiro** seu `AGENTS.md`, skills locais, contratos de negócio e gates; este documento só acrescenta repertório e **não substitui** o roteador, a arquitetura, o CI ou as regras de publicação existentes. Em projetos sem UI, motion é `NOT_APPLICABLE`. Maximizar competências pertinentes, **não** instalar todas as skills nem aplicar todos os efeitos.

## Seleção por tarefa
| Necessidade | Referência e decisão permitida |
| --- | --- |
| Motion original e comparação de efeitos | [Reanimate](https://github.com/NiazMorshed2007/reanimate) (MIT): **ADAPTAR O MÉTODO**, não instalar CLI: referência autorizada → trigger/estados/tempo/easing → implementação com CSS/WAAPI existentes → capturas BEFORE/DURING/AFTER → comparação → ajuste |
| UI/portfólio premium | Reaproveitar direção criativa, anti-template, identidade e gates do próprio projeto; TasteSkill, Transitions.dev e React Bits são referências condicionais, não dependências padrão |
| Sobreposição/oclusão no mobile | [Playwright visibility debug](https://gist.github.com/tobiashochguertel/bf7bc60f8946c7ecbe0d14782b4a8c99): ideias para investigar CTA, botão fixo, rodapé, foco e viewport; **não rodar instalador remoto** |
| QA responsivo | [Visual QA plan](https://gist.github.com/michael-matias-2026/d80389dfa08f4db9c5cc6020adf911ce): roteiro 390/1440; preferir Playwright/Chromium já disponíveis |
| Acessibilidade | [Playwright accessibility draft](https://gist.github.com/arjunattam/e7a5d6bf25ffab2a1b972bbc3bf1db9f): teclado, tabulação, foco visível, Escape, semântica, leitores de tela e `prefers-reduced-motion`; adaptar, não presumir suíte pronta |
| Funções de servidor React/TanStack | [Middleware TanStack](https://gist.github.com/Ynng/fa9360a37633631de394a71c8becc91e): estudar separação cliente/servidor e autorização; **não trocar autenticação** ou enfraquecer autorização no servidor |
| Metadados Supabase/PostgreSQL | [SECURITY DEFINER audit](https://gist.github.com/cekuu35/32a0b4c3489f8406a78712585fbc3591): apenas inspiração para `SELECT` sobre catálogos, após revisão SQL; não executar em banco oficial sem escopo autorizado; preservar RLS, grants, dados e contatos privados |

**Erro conhecido a rejeitar:** [checklist RLS inadequado](https://gist.github.com/cekuu35/e9bed1ff71f491842552fdb2d28cbe80) alega que RLS ligada sem políticas permite acesso; o PostgreSQL usa *default deny* quando nenhuma política aplicável concede acesso. Fonte primária: https://www.postgresql.org/docs/current/ddl-rowsecurity.html .

## Aplicação em qualquer projeto
1. Identificar objetivo real, stack, riscos e **skill local existente**; evitar nova rota, workflow, plugin, PR ou pacote quando o equivalente já existe.
2. Selecionar somente referências pertinentes: `USE` (padrão local existente), `ADAPT` (princípio comprovado), `REFERENCE_ONLY`, `REJECT` ou `NOT_APPLICABLE`. Registrar motivo.
3. Confirmar origem, licença **de cada snippet**, commit/revisão, dependências, compatibilidade SSR, dados tratados, custo e riscos. Gist público **não** implica licença para cópia nem segurança; não copiar scripts sem autorização.
4. Preferir CSS/WAAPI/Playwright locais; nunca executar `curl|bash`, hooks, instaladores, agentes externos ou acesso a credenciais automaticamente. Sem serviços pagos/Lovable Max por padrão.
5. Manter conteúdo acessível sem animação/JS; `prefers-reduced-motion`, teclado, mobile 390 px, desktop 1440 px, LCP/CLS/SEO, privacidade e funis sempre prevalecem.
6. Validar somente os **gates relevantes e existentes** e registrar evidência real. Falha ou teste não executado = não homologado; CI verde não prova produção.
7. Toda alteração de código exige micro-PR revisável, sem merge ou deployment implícitos; não alterar banco/RLS/dados/contatos/identidade/SEO por adoção de skill.

## Escopo por produto
- **0WEB**: usar nas criações **futuras** de portfólios e novos projetos; não retrabalhar portfólios existentes por esta diretriz. Direção autoral distinta por cliente, identidade e mídia legítimas, funil `CTA → lead → WhatsApp`, `client_key`, SSR e indexabilidade preservados.
- **Encontre um Técnico**: cadastro, busca, perfis, localização e painel; motion mínimo e funcional. Preservar Supabase dedicado, RLS, contatos privados, suspensos, Pioneiros e regras comerciais.
- **O Técnico de Informática**: conteúdo técnico verificado, experiência de serviço, acessibilidade, performance, marca e funil; não usar imagens IA nem fabricar prova social.
- **Demais projetos**: usar o mesmo método de seleção, subordinado aos `AGENTS.md` locais, stack, marca e regras comerciais; funcionalidades sem UI não precisam de motion.

**Estado da referência:** método documentado; nenhum código externo, skill executável, CLI ou dependência do Reanimate/Gists foi instalado ou homologado em runtime.

## Roteamento adicional por produto — 21/11/2026

No Encontre um Técnico, consultar `docs/integrations/agent-tools-selection-2026-11-21.md` antes de propor novas ferramentas para admin, busca, perfil, conteúdo ou segurança. A matriz distingue método seguro de instalação e complementa as políticas de RLS/contatos, sem novas dependências ou autorização de deploy. Projetos não herdam o acesso aos dados de outros projetos.
