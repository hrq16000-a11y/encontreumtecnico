# Auditoria mobile real dos seis guias — 11/11/2026

**Fonte:** Lighthouse **12.8.2** em Chrome Headless no GitHub Actions, modo mobile e throttling simulado, URL oficial de produção. Relatórios JSON completos no artifact do [workflow #43070958933](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/43070958933). Execuções entre 17:44 e 17:45 UTC. Nenhuma requisição foi gravada como lead ou publicada durante o teste.

## Baseline antes da correção

| Guia | Perf. Lighthouse | Acessib. | SEO | LCP (ms) | CLS | TBT (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Computador lento | 76 | 100 | 100 | 4174 | 0.000 | 0 |
| Câmeras | 71 | 100 | 100 | 4133 | 0.142 | 0 |
| Wi-Fi | 83 | 100 | 100 | 3191 | 0.118 | 0 |
| Impressora | 66 | 100 | 100 | 4127 | 0.214 | 0 |
| Backup | 75 | 100 | 100 | 4010 | 0.105 | 0 |
| Ar-condicionado | 74 | 100 | 100 | 4132 | 0.106 | 0 |

**Critérios mantidos (não alterados):** LCP até 2500 ms, CLS abaixo de 0.1 e INP abaixo de 200 ms no percentil 75 de dados de campo. Lighthouse estima LCP e CLS em laboratório; **não mede INP de usuários reais**. TBT não substitui INP. Este baseline não comprova aprovação em CWV.

## Evidência de causa
- O LCP das seis páginas foi identificado no **parágrafo da introdução** do artigo, não na capa SVG. O atraso de renderização respondeu por cerca de 80–85% do LCP em várias execuções.
- O audit `layout-shifts` marcou deslocamentos iniciais do banner/figura em quatro páginas, associando explicitamente às fontes web **Manrope e Sora** carregadas da Google Fonts. Em outra página o elemento afetado foi um controle flutuante.
- Em todas as páginas, o Lighthouse identificou recursos CSS bloqueantes (incluindo Google Fonts) e ~158 KiB estimados de JavaScript não utilizado, parte do bundle compartilhado do portal. TBT foi 0 no teste, portanto não é evidência suficiente para alterar globalmente hidratação/admin ou relaxar limites.
- O perfil público, sitemap e as URLs /guias permanecem como evidência HTTP/SSR separada. Não modificar AdSense, middleware, root shell, Supabase nem conteúdo dos seis guias como reação especulativa.

## Correção mínima na branch
- `.eut-guide-stable-type` no artigo com fonte de sistema estável e headings herdando a mesma família, **somente** dentro de /guias/$slug. Cabeçalho, administração, modalidades e outros portais mantêm suas fontes originais.
- Adição de `Climatização` à lista visível do funil existente, pois o guia pré-selecionava a especialidade mas o formulário a mostrava como “Outro serviço”. A gravação prévia, validação, rascunho e WhatsApp manual não foram alterados.
- Teste de regressão de tipografia escopada, funil e preservação de `contact_messages`.

## Validação e pendências
- Executar build, TypeScript, SEO, privacidade, rascunho e smoke de rotas antes de permitir merge/deploy.
- **Medição depois:** executar novamente Lighthouse mobile nas mesmas seis URLs, idealmente três vezes cada, após o deployment homologado, registrar mediana e faixas (variação entre execução). Não afirmar melhoria mensurada ou “LCP aprovado” até coletar esses valores.
- **CrUX/Search Console:** consultar os dados de campo quando houver amostra suficiente para LCP, INP e CLS. Sem amostra, classificar como “sem dados” e não como “aprovado”.
- **Risco residual:** recursos Google Fonts e bundles globais continuam sendo carregados. A correção é localizada e não promete atingir 2.5 s de LCP. Se o limite continuar reprovado, abrir próxima PR cirúrgica com evidência comparativa e sem reescrever arquitetura inteira.

## Governança
Sem banco, DNS, Lovable, Max Mode, anúncios, pagamentos, Cloud API WhatsApp, dados reais ou deploy durante a fase de medição. No máximo um deploy final após gates.
