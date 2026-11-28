# Design engineering premium — análise e adoção Emil Kowalski

**Estado:** R0 + R1.1 — diagnóstico estático e baseline visual da Home; implementação NÃO iniciada.
**Data:** 27/11/2026 • **Repositório:** hrq16000-a11y/encontreumtecnico • **Checkpoint analisado da main:** `d31024c1b731aee36e1ae14dbc94b8284e5cf8de`.

Este documento é incremental. As regras locais de AGENTS.md, DESIGN.md, segurança, SEO, arquitetura, publicação, dados e funis prevalecem. Não autoriza alterações de runtime, instalações, custos, merge ou deploy. Não substitui a homologação visual da versão efetivamente publicada. R0 teve timeout do navegador; R1.1 registra abaixo a captura pública da Home. Nenhuma medição de performance, QA integral ou aprovação de produção é reivindicada.

## 1. Diagnóstico por projeto (evidência de leitura)

- **Contexto:** Diretório de técnicos e painel administrativo.
- **Observação concreta:** Home SSR em src/routes/index.tsx compõe CategoryGrid, ProblemAssistant, HomePublicProof, cobertura, mídia/anúncios. CSS tem 4 @keyframes e 5 menções a reduced-motion.
- **Stack presente (package.json):** @tanstack/react-start 1.168.60, react ^19.2.0, sonner ^2.0.7, tailwindcss ^4.2.1, vite 8.1.5, vitest ^4.1.10.
- **Home/entrada observada:** src/routes/index.tsx.
- **CSS amostrado:** src/styles.css (4 @keyframes; 5 referências a prefers-reduced-motion; 0 ocorrências de transição ampla). Contagem textual de declarações, não prova de uso/renderização ou defeito.
- **Documentação local a preservar:** docs/skills/ANTI_GENERIC_EXPERIENCE.md
- **Oportunidade prioritária (hipótese a validar):** Experiência de busca inconfundível: hero por problema/local, cards e perfis ricos mas estáveis; Admin com densidade, foco e feedback de filtros sem stagger. Reusar tokens existentes.
- **Limite local:** Manter LP2, contatos privados, catálogos, funil, SSR, canonicals, preços e dados; não alterar regras de negócio, Supabase ou produção.

## 2. Fonte primária e repertório

Fonte verificada: [emilkowalski/skills — revisão 64eb3deb](https://github.com/emilkowalski/skills/tree/64eb3deb9a5fbfa041faf783e0bc3fd635872e9c). Consultar `SKILL.md` do módulo e, quando necessário, RECIPES/STANDARDS antes da implementação. Esta é uma síntese autoral de princípios adaptados à aplicação; não instala nem executa scripts externos.

| Módulo | Uso no próximo trabalho visual |
| --- | --- |
| emil-design-eng | Refinar origem, feedback, legibilidade e detalhes; calibrar critérios de gosto |
| find-animation-opportunities | Ler UI e código, inventariar oportunidades e rejeições sem editar |
| remove-animations | Subtrair loops/reveals e atrasos que não se justificam |
| improve-animations / review-animations | Auditar componentes existentes e propor ajustes isolados |
| animate / animation-vocabulary | Escolher propósito, curva, duração, propriedade, entrada/saída e vocabulário |
| choreograph | Definir lead, apoio, simultaneidade, interrupção e o que permanece imóvel |
| animation-performance | Medir paint, layout, custo JS, frames, camadas e regressões |
| mobile-native / gestures | Touch, safe areas, hover, teclado, swipe e controle interrompível |
| apple-design | Continuidade espacial e adaptação da interação, sem copiar interfaces |
| prototype | Comparar duas ou três composições em branch local, inclusive versão sem motion |
| break-ui | Testar dados extremos, vazio, erro, loading, nomes longos, zoom e viewport |
| learn-taste | Registrar decisões confirmadas e seus motivos em DESIGN.md ou documento equivalente |
| pick-ui-library / ask-emil / ask-sonner | Escolher mecanismo mínimo e reaproveitar componentes existentes; módulos específicos só quando necessários |

Módulos mobile nativos (animate-expo/write-swift) não são aplicáveis por padrão a uma aplicação web. Não atualizar dependências só para cumprir esta diretriz; validar licença, SSR, bundle e compatibilidade se houver necessidade real. Referências anteriores (TasteSkill, Transitions.dev, React Bits, GSAP/Lottie/3D) são complementares quando compatíveis, não justificativa de efeitos obrigatórios.

## 3. Experiência premium: direção de arte primeiro

- Escolher uma personalidade (tipografia, paleta, contraste, espaço, forma, fotos/mídia reais, ritmo e assinatura) derivada da marca e da intenção de cada página.
- Estruturar o primeiro viewport para explicar o benefício e ação primária; evitar padrões repetitivos de cards/gradientes, sombras pesadas, excesso de badges e composição indistinguível entre projetos.
- Usar hierarquia editorial, alinhamento, espaço negativo e elementos visuais específicos ao negócio. Fazer teste sem marcas: a composição ainda comunica a proposta? Não copiar layout, ativos, textos ou marcas de sites premiados.
- Uma experiência de campanha rara pode ter um momento assinado (ex.: revelação localizada, galeria ou transformação explicativa). Não impor uma quantidade de animações; a ausência de motion pode ser a decisão correta.
- Nas rotas transacionais, busca, listas e administração, privilegiar velocidade, foco e estabilidade. Conteúdo, CTA, preços, resultados, navegação e formulários devem funcionar sem movimento, e conteúdo público/SEO deve ficar disponível antes da hidratação quando aplicável.

## 4. Critério de decisão de motion

Toda proposta precisa declarar **superfície, propósito, frequência, propriedade, easing, duração, fallback e interrupção**. Rejeitar quando não houver utilidade ou quando a frequência tornar o movimento incômodo.

| Superfície | Escolha inicial (adaptar tokens existentes) |
| --- | --- |
| Atalho de teclado ou ação repetida centenas de vezes | Imediato, sem animação ornamental |
| Press feedback ocasional | `scale(0.97)`, 100–160ms; manter hit target estável |
| Tooltip / popover pequeno | 125–200ms, origem no gatilho; tooltip seguinte sem atraso |
| Dropdown / seleção ocasional | 150–250ms, entrada/saída com resposta rápida |
| Modal / drawer | 200–500ms quando necessário, foco/escape, sem espera para interagir |
| Marketing / explicação rara | Só sequência com propósito, conteúdo legível e alternativa estática |

Se não existirem tokens equivalentes, avaliar curva de entrada/saída `cubic-bezier(0.23, 1, 0.32, 1)`, movimento entre estados `cubic-bezier(0.77, 0, 0.175, 1)` e drawer `cubic-bezier(0.32, 0.72, 0, 1)` da referência. Não adicionar sistema paralelo. Evitar ease-in em UI, transition: all, scale(0), layout properties animadas, loops decorativos e atraso no CTA. Usar transform/opacity, origem do gatilho, CSS para movimento previsível, springs para gesto realmente interrompível; `will-change` só com evidência. Não duplicar animação de pai e filhos; sem stagger em listas frequentes. Hover apenas em hover/pointer fine; respeitar reduced-motion e preferência local mais estrita, sem esconder conteúdo. Para 3D, orçamento específico, degradação estática e nenhuma dependência imposta.

## 5. Micro-rodadas futuras — sem autorização implícita de código

1. R1 — Auditoria visual real em Home e rotas críticas, 390/768/1440, registrar screenshots, fonte commit/deployment, interação, frequência, oportunidade e rejeição; comparar baseline de performance. Avaliar se os indícios acima se confirmam.
2. R2 — Direção de arte e protótipo de uma superfície, criar brief com paleta, tipografia, layout, mídia e assinatura; comparar com versão sem motion; evitar alterar contratos.
3. R3 — Implementar apenas o ajuste aprovado, em micro-PR; reusar tokens e componentes existentes. Validar teclado, foco, toque, reduced-motion, interrupção, loading/vazio/erro, textos longos e sem overflow.
4. R4 — Revisão por `review-animations`, `animation-performance`, `break-ui`; registrar antes/depois, LCP/CLS/INP ou gates locais e teste de uso real. Verificar que SEO, SSR, canonical, sitemap, dados, rotas e conversões não regrediram.
5. R5 — Aprender com feedback explícito; acrescentar decisões justificadas ao documento de design local. Merge/publicação só no fluxo aprovado do projeto; uma publicação quando necessária, sem Lovable Max sem autorização.

## 6. GO/NO-GO

GO para implementação somente com baseline visual, brief próprio da marca, propósito de cada movimento, seleção dos módulos pertinentes e uma micro-superfície definida. GO para release somente com gates locais, comparação real nos viewports, interação funcional, reduced-motion, zero regressão crítica de performance/conversão, sem novos riscos de acessibilidade, SSR/SEO e privacidade. NO-GO se movimento interferir na ação, se houver conteúdo invisível, template copiado, alteração comercial incidental, bloqueio de dados, dependência sem justificativa ou validação inconclusiva.

**Registro desta rodada:** leitura de referências e arquivos; documentação proposta/registrada em branch isolada. Nenhum código de aplicação, dependência, banco, DNS ou configuração de hospedagem foi alterado por esta diretriz.

## 7. R1.1 — baseline visual real: Home Encontre um Técnico (27/11/2026)

**Escopo:** https://www.encontreumtecnico.com.br/; visita pública sem enviar pesquisa/solicitação, criar conta, escolher consentimento ou acessar painel. Capturas após a busca estar renderizada, desktop 1440 CSS px (documento 1421 px) e mobile 390 CSS px (documento 371 px); nenhuma largura excedeu viewport nessa Home. Não equivale a QA de diretório, perfis ou Admin, acessibilidade completa, Core Web Vitals ou vínculo verificado com SHA de Production.

| Passo e evidência | Observação | Prioridade |
|---|---|---|
| 01 — Home desktop | Headline e vocação de rede nacional claras; foto contextual e busca por especialidade/município com CTA e sugestões; preservar esses elementos. Header usa marca de leitura relativamente discreta; pode ganhar contraste/clareza sem redesenho da marca. | P1 |
| 02 — Home mobile | Busca é o objetivo principal, mas o banner fixo de privacidade cobre parte do botão Buscar no primeiro viewport. Header prioriza cadastro de prestador, não a ação principal do visitante. Foto não antecede a busca, bom. | P0 — organizar espaço e hierarquia |
| 03 — Hidratação observada | Primeiro estado apresentou “Recuperando sua busca...” com link para diretório; depois formulário apareceu. Investigar estabilidade e tempo para ação sem concluir falha de rede ou medir duração. | P1 |

**Próxima intervenção cirúrgica proposta:** corrigir sobreposição e preservar integralmente a escolha de consentimento, reduzir ocupação do primeiro viewport e priorizar pesquisa contextual. Manter 100% dos filtros/rotas/privacidade e contratos de atendimento. Não animar entrada de campos, busca digitada, paginação ou UI administrativa; feedback de botão/seleção pontual com tokens existentes. Avaliar imagens por contexto e diversidade somente após resolver interação. Diretório público/perfil e painel em lote posterior com evidências, sem alterar identificação, catálogo, valores ou regras de negócio.

**Evidência capturada nesta sessão** (arquivos locais exatos, não integram o Git): `03-eut-1440.png` SHA256 `6c3216e4004f1ccac2e59ae802dc17c4d6febaa52b15e5b2db0c966c75a08bdd`; `04-eut-390.png` SHA256 `55ac013baae1e65d70df356dbdf1f5de30c1b2143fdd8ced60601ffa22e98bfc`.


## R18 — Seleção inteligente no atendimento guiado (28/11/2026)
- A produção READY `5f4e4c0f` já tem o diálogo contextual responsivo `FreeSearchHelp` e `MunicipalityPicker` com busca e ID oficial IBGE; preservados. A página de contato já prioriza o fluxo e não exibe cartões de e-mail/cidade institucional. A intervenção limita-se ao funil de assistência.
- Pesquisa de serviço por texto, sugestões priorizadas sem acentos, catálogo ativo consultado pela validação existente e confirmação explícita por toque/teclado; texto livre só por opção explícita e jamais convertido em slug arbitrário. Prazo e UF mantêm o valor confirmado durante digitação; município/bairro são limpos apenas quando a UF realmente muda. Limite de sugestões e nenhum motion recorrente, novas dependências ou alteração de arquitetura.
- Testes previstos: contexto do perfil, pesquisa por teclado, serviço livre, UF com nome e sigla, preservação de município IBGE, modalidade/consentimento e navegação segura. QA visual 390/768/1440 e release isolado sobre SHA READY devem ser aprovados separadamente; não promover main integral.
