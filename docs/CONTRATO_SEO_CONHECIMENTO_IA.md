# Contrato permanente — SEO, descoberta por IA e inteligência comercial (Rodadas 21–30)

**Data: 28/11/2026. Estado: especificação de execução incremental, não comprovação de implantação.** Complementa [o contrato do motor de atendimento e CRM](CONTRATO_MOTOR_ATENDIMENTO_E_CRM.md). Respeitar as regras comerciais e técnicas locais e não antecipar rodadas futuras. Publicação funcional somente após os gates existentes e vínculo exato do deployment com o SHA aprovado.

## RODADA 21 — IMAGENS SOCIAIS E METADADOS

- Inventariar a camada de SEO existente e as páginas públicas representativas (Home, serviço, problema, preço, cidade, guia, artigo, profissional/produto/portfólio quando pertinente). Corrigir somente ausências comprovadas. Preservar canonical, title, description, index/noindex intencional e identidade de cada marca; evitar duplicatas.
- Garantir Open Graph e Twitter Card com título, descrição, URL canônica, imagem social pertinente, URL HTTPS absoluta, texto alternativo e dimensões coerentes com o arquivo real; preferir 1200 × 630 para compartilhamento quando viável e imagem de fallback própria da marca. Reutilizar mídia autorizada e gerar imagem específica quando faltar. Não reutilizar imagem de outra marca, nem expor informações privadas. Evitar renderização da imagem social no caminho crítico visual.
- Validar HTML entregue ao crawler sem exigir hidratação, URL da imagem acessível com resposta 200 e tipo de imagem apropriado, tamanho/dimensões, ausência de redirecionamento indevido e qualidade visual; conferir página pública representativa, Preview e Production efetivamente aprovados. Não indexar áreas privadas ou demonstrações intencionalmente noindex. Não criar novos serviços ou dependências pagas.

## RODADA 22 — SCHEMA.ORG E AUDITORIA DE JSON-LD

- Reaproveitar schemas existentes; implementar tipos semanticamente corretos para guias, artigos, serviços, preços, problemas e cidades, além de produtos e organizações quando pertinente. Utilizar BreadcrumbList nas páginas públicas com hierarquia real; Home sem breadcrumb fictício. Manter URLs absolutas e identidade canônica, e coerência com conteúdo visível.
- Emitir FAQPage em ServicePage, PricePage, ProblemPage e CityPage quando houver as seis perguntas e respostas editoriais reais e exibidas na página; não fabricar FAQs, preços, avaliações ou entidades, não duplicar schema. Se houver FAQ existente, manter paridade SSR/visível. FAQPage não assegura rich result e não deve ser adscrito a conteúdo não elegível.
- Criar ou evoluir script de auditoria de JSON-LD no build/CI, incluindo Article, FAQPage, BreadcrumbList e demais tipos realmente utilizados. Falhar por JSON inválido, campos obrigatórios aplicáveis ausentes, inconsistência de URLs/canonical, duplicações ou divergência com conteúdo público; não reduzir thresholds nem criar workflows redundantes. Validar resultados representativos via ferramentas existentes e, quando aplicável, validadores oficiais.

## RODADA 23 — SEO TÉCNICO E DESCOBERTA POR BUSCADORES E IA

**Implementar ou aprimorar:**

- **Sitemap XML automatizado.**
- **Sitemap index, quando necessário.**
- **Robots.txt.**
- **Canonical.**
- **Links internos contextuais.**
- **HTML semântico.**
- **SSR ou pré-renderização adequada.**
- **Entidades claramente identificadas.**
- **Conteúdo rastreável.**
- **Respostas objetivas.**
- **Guias completos.**
- **Referências verificáveis.**
- **Identificação editorial.**
- **Datas reais de atualização.**
- **Arquitetura de tópicos.**
- **Páginas relacionadas.**
- **IndexNow, quando aplicável.**
- **Integrações existentes com Google Search Console e Bing Webmaster Tools.**

**Avaliar `llms.txt` como recurso complementar experimental, sem tratá-lo como requisito oficial de indexação ou garantia de recomendação por IA.**

**Revisar as permissões dos crawlers de pesquisa e descoberta, diferenciando rastreamento para busca de coleta destinada ao treinamento de modelos.**

**Preservar páginas privadas, administrativas e informações pessoais.**

**Não criar milhares de páginas vazias, duplicadas ou de baixa qualidade.**

**Não utilizar técnicas de manipulação de buscadores.**

---

## RODADA 24 — BASE DE CONHECIMENTO ADMINISTRATIVA

**Criar ou evoluir os painéis administrativos existentes para permitir o gerenciamento centralizado de conhecimento dentro de cada projeto.**

**Permitir cadastrar:**

- **Guias.**
- **Artigos.**
- **Serviços.**
- **Profissões.**
- **Especialidades.**
- **Problemas.**
- **Sintomas.**
- **Soluções.**
- **Cidades.**
- **Regiões.**
- **Perguntas frequentes.**
- **Orientações preventivas.**
- **Critérios para contratação.**
- **Referências de preços.**
- **Fontes.**
- **Conteúdos relacionados.**

**Cada registro deverá possuir, quando aplicável:**

- **Status.**
- **Autor.**
- **Fonte.**
- **Data de criação.**
- **Data de atualização.**
- **Revisão.**
- **Categoria.**
- **Relacionamentos.**
- **Localização.**
- **Slug.**
- **Metadados SEO.**
- **Visibilidade.**
- **Histórico de alterações.**

**Utilizar o banco de dados existente.**

**Evitar criar outro painel administrativo quando já houver estrutura adequada.**

**Preservar RLS, autenticação, permissões e auditoria.**

**Preparar a base para alimentar páginas públicas, buscas internas, recomendações por IA e futuros agentes.**

**Não utilizar informações privadas de clientes como conteúdo público ou base indiscriminada para modelos.**

---

## RODADA 25 — BASE REAL DE PREÇOS E INTELIGÊNCIA REGIONAL

**Criar uma estrutura administrativa para cadastrar referências reais de preços.**

**Permitir relacionar:**

- **Serviço.**
- **Especialidade.**
- **Cidade.**
- **Região.**
- **Tipo de projeto.**
- **Complexidade.**
- **Urgência.**
- **Unidade de cobrança.**
- **Preço mínimo.**
- **Preço máximo.**
- **Preço de referência.**
- **Deslocamento.**
- **Materiais.**
- **Mão de obra.**
- **Fonte da informação.**
- **Data da última atualização.**
- **Validade da referência.**

**Permitir diferenças entre preços de serviços, produtos, atendimento técnico e tarifas de indicação.**

**Não confundir o preço do profissional com a tarifa cobrada pelo portal.**

**Substituir progressivamente o texto genérico “sob orçamento” somente quando houver referências confiáveis cadastradas.**

**Quando não houver dados suficientes, informar claramente a indisponibilidade de estimativa.**

**Não inventar valores.**

**Permitir que as páginas públicas utilizem essas informações dinamicamente.**

---

## RODADA 26 — MOTOR INTELIGENTE DE RECOMENDAÇÕES

**Criar um recurso contextual para que o visitante descreva seu problema em linguagem natural.**

**Exemplo:**

**“Meu computador liga, mas não aparece imagem. Estou em São José dos Pinhais.”**

**O motor deverá identificar, quando possível:**

- **Intenção.**
- **Problema.**
- **Categoria.**
- **Especialidade.**
- **Cidade.**
- **Região.**
- **Urgência.**
- **Tipo de atendimento.**
- **Informações ainda necessárias.**

**A partir da base de conhecimento, recomendar:**

- **Guias relacionados.**
- **Artigos úteis.**
- **Serviços disponíveis.**
- **Possíveis causas.**
- **Orientações iniciais seguras.**
- **Faixas de preço cadastradas.**
- **Quando contratar um profissional.**
- **Profissionais elegíveis, conforme as regras do portal.**
- **Próximo passo adequado.**

**Utilizar AI Gateway ou integração equivalente já disponível no projeto, mediante avaliação de custo e segurança.**

**Priorizar uma arquitetura econômica:**

1. **Busca determinística.**
2. **Correspondência de categorias.**
3. **Busca textual.**
4. **Busca semântica, quando necessária.**
5. **Recuperação de conteúdo relevante.**
6. **Modelo de IA somente quando agregar valor.**

**Adotar RAG quando houver necessidade comprovada.**

**O modelo deverá utilizar a base de conhecimento autorizada e identificar as referências que sustentam suas recomendações.**

**Não inventar preços, profissionais, disponibilidade ou diagnósticos.**

**Implementar cache, limites de consumo, proteção contra abuso, timeout e fallback sem IA.**

**Não enviar dados pessoais desnecessários ao provedor do modelo.**

**Não ativar serviços pagos ou ampliar custos recorrentes sem autorização específica.**

### Integração com o funil universal

**O motor inteligente deverá aproveitar o contexto da página de origem.**

**Não perguntar novamente o que já estiver identificado.**

**Preservar:**

- **Serviço.**
- **Cidade.**
- **Especialidade.**
- **Problema.**
- **Origem.**
- **Campanha.**
- **Página visitada.**
- **Contexto da navegação.**

**A experiência deverá funcionar preferencialmente como modal, drawer ou interface contextual, sem retirar o visitante desnecessariamente da página original.**

---

## RODADA 27 — SIMULADOR INTELIGENTE DE ORÇAMENTO

**Criar uma experiência de estimativa de preço baseada em dados reais.**

**O visitante poderá informar:**

- **Serviço.**
- **Cidade.**
- **Tipo de projeto.**
- **Complexidade.**
- **Quantidade.**
- **Urgência.**
- **Condições específicas.**

**O sistema deverá retornar, quando houver dados suficientes:**

- **Faixa estimada.**
- **Fatores que influenciam o preço.**
- **Possíveis custos adicionais.**
- **Referência regional.**
- **Data de atualização dos dados.**
- **Limitações da estimativa.**
- **Próximo passo recomendado.**

**O cálculo deverá ser preferencialmente determinístico.**

**A IA poderá interpretar a descrição e explicar o resultado, mas não deverá inventar a faixa de preço.**

**Deixar claro que estimativa não representa orçamento definitivo.**

**Integrar o simulador ao funil de atendimento, sem solicitar novamente informações já fornecidas.**

**Aplicar somente aos projetos em que essa funcionalidade fizer sentido comercial.**

---

## RODADA 28 — ANALYTICS E INTELIGÊNCIA COMERCIAL

**Aproveitar o analytics já implantado.**

**Criar ou evoluir um painel administrativo com indicadores reais.**

**Monitorar:**

- **Visualizações por página.**
- **Visualizações por profissão.**
- **Visualizações por especialidade.**
- **Visualizações por cidade.**
- **Visualizações por problema.**
- **Origem do tráfego.**
- **Cliques nos CTAs.**
- **Cliques no WhatsApp.**
- **Abertura do funil.**
- **Abandono por etapa.**
- **Solicitações concluídas.**
- **Rolagem até FAQ.**
- **Interações com FAQ.**
- **Guias mais acessados.**
- **Pesquisas internas.**
- **Pesquisas sem resultado.**
- **Uso das recomendações inteligentes.**
- **Uso do simulador.**
- **Conversões efetivamente confirmadas.**
- **Custos de utilização da IA.**

**Diferenciar claramente:**

- **Clique no WhatsApp.**
- **Abertura do WhatsApp.**
- **Solicitação registrada.**
- **Mensagem efetivamente confirmada.**
- **Atendimento.**
- **Conversão comercial.**

**Não afirmar que houve envio de mensagem quando existe somente evidência de clique.**

**Utilizar os indicadores para identificar oportunidades reais de crescimento.**

**Não duplicar eventos existentes nem criar métricas fictícias.**

---

## RODADA 29 — CRESCIMENTO ORGÂNICO E AUTORIDADE TEMÁTICA

**Transformar os dados disponíveis em oportunidades de conteúdo útil.**

**Identificar:**

- **Serviços mais procurados.**
- **Problemas mais pesquisados.**
- **Cidades com demanda.**
- **Especialidades pouco exploradas.**
- **Perguntas recorrentes.**
- **Páginas com impressões e poucos cliques.**
- **Páginas com baixa conversão.**
- **Buscas sem resposta.**
- **Conteúdos desatualizados.**
- **Oportunidades de links internos.**

**Evoluir a arquitetura editorial com agrupamentos de conteúdo:**

**Problema → Guia → Serviço → Preço → Cidade → Profissional → Atendimento.**

**Criar páginas somente quando houver utilidade real, conteúdo suficiente e coerência comercial.**

**Aprimorar:**

- **Títulos.**
- **Descrições.**
- **Intenção de busca.**
- **Respostas diretas.**
- **Tabelas comparativas.**
- **Guias de contratação.**
- **Orientações preventivas.**
- **Perguntas frequentes.**
- **Referências regionais.**
- **Conteúdos relacionados.**
- **Autoridade editorial.**
- **Experiência mobile.**
- **Conversão contextual.**

**Utilizar dados reais do Search Console, Bing Webmaster Tools e analytics quando houver acesso.**

**Medir resultados por impressões, cliques, páginas indexadas, CTR, tráfego qualificado e conversões.**

**Não prometer posicionamento, tráfego ou recomendações garantidas por IA.**

---

## RODADA 30 — CONSOLIDAÇÃO E PUBLICAÇÃO

**Consolidar as melhorias das rodadas anteriores.**

**Validar:**

- **Build.**
- **TypeScript.**
- **Testes existentes.**
- **JSON-LD.**
- **SEO técnico.**
- **Imagens sociais.**
- **Sitemap.**
- **Robots.txt.**
- **Canonical.**
- **Links internos.**
- **Performance.**
- **Acessibilidade.**
- **Segurança.**
- **Privacidade.**
- **Experiência mobile.**
- **Painel administrativo.**
- **Integridade dos preços.**
- **Recomendações inteligentes.**
- **Fallback sem IA.**
- **Analytics.**
- **Funis.**
- **Integrações existentes.**

**Testar as resoluções:**

- **390px.**
- **768px.**
- **1440px.**

**Preservar os princípios de design engineering, motion e qualidade visual já estabelecidos.**

**Não permitir que as novas funcionalidades transformem os projetos em interfaces genéricas, pesadas ou visualmente poluídas.**

---

## 4. REGRAS UNIVERSAIS DE EXECUÇÃO

- **Trabalhar em micro-rodadas.**
- **Aproveitar PRs existentes.**
- **Evitar branches desnecessárias.**
- **Priorizar GitHub e Codex.**
- **Não executar a fila do Lovable.**
- **Não utilizar Max Mode.**
- **Não consumir créditos desnecessariamente.**
- **Não duplicar bancos de dados.**
- **Não reconstruir funcionalidades existentes.**
- **Não introduzir dependências sem necessidade.**
- **Não modificar regras comerciais sem autorização.**
- **Não expor e-mails, telefones privados ou informações administrativas.**
- **Não inventar dados.**
- **Não mascarar erros.**
- **Não reduzir thresholds para aprovar pipelines.**
- **Não confundir merge com publicação.**
- **Não confundir publicação com indexação.**
- **Não confundir indexação com posicionamento.**
- **Não confundir elegibilidade com recomendação por IA.**

**Publicar incrementalmente todas as melhorias tecnicamente aprovadas.**

**A autorização de publicação permanece válida, respeitando os gates técnicos e a integridade de cada projeto.**

---

## 5. RELATÓRIO OBRIGATÓRIO POR RODADA

**Apresentar uma matriz contendo:**

| **Projeto** | **Existente** | **Implementado** | **Verificado** | **Merge** | **Production** | **Pendências** |
| ----------- | ------------- | ---------------- | -------------- | --------- | -------------- | -------------- |

**Registrar também:**

- **Repositório.**
- **Branch.**
- **PR.**
- **Commit SHA.**
- **HEAD.**
- **Arquivos modificados.**
- **Testes executados.**
- **Resultado do CI.**
- **Preview.**
- **Deployment Production.**
- **URL oficial.**
- **Evidências pós-publicação.**
- **Bloqueios reais.**
- **Custos adicionais previstos.**
- **Próxima ação executável.**

**Classificar cada projeto individualmente.**

**Não declarar conclusão global enquanto houver projetos sem evidências suficientes.**

---

## 6. ORDEM DE INÍCIO IMEDIATO

**Inicie pela Rodada 21.**

**Primeiramente, documente o contrato permanente das rodadas 21 a 30 nos repositórios pertinentes.**

**Em seguida:**

1. **Identifique o que já existe.**
2. **Reaproveite as implementações anteriores.**
3. **Corrija as ausências comprovadas de imagens sociais e metadados.**
4. **Valide as correções.**
5. **Integre e publique os projetos aprovados.**
6. **Registre as evidências.**
7. **Informe a próxima micro-rodada.**

**Não tente executar as dez rodadas simultaneamente.**

**Não entregue somente planejamento.**

**Progrida efetivamente, na medida das capacidades técnicas disponíveis.**

**Quando houver impedimento de acesso, custo, infraestrutura ou autorização, documente o bloqueio específico e continue nos demais projetos que possam evoluir.**

**Objetivo permanente: aumentar a capacidade de descoberta, autoridade, tráfego qualificado, inteligência operacional e conversão comercial de todo o ecossistema.**

**PROSSIGA.**

## Perfil de aplicação local — hrq16000-a11y/encontreumtecnico

Portal de indicação e descoberta: aplicar modalidade e evidência somente ao tipo de solicitação de serviço pertinente; não bloquear busca, inscrições, suporte de cadastro ou pedidos sem natureza técnica. Não converter tarifa de contato/indicação em cobrança de atendimento remoto, nem intermediar pagamento do prestador. R$ 69,99 somente se este projeto tiver oferta técnica própria homologada, distinguindo-a das condições do profissional. Preservar catálogo, cobertura nacional, match, consentimento, perfil e contratos de indicação.

Aplique as rodadas de acordo com o negócio, sem impor módulos comerciais incompatíveis. As regras de SEO técnico e imagem social aplicam-se somente à superfície pública autorizada; Schema.org descreve entidades e conteúdo verificáveis; base de preços, simulador e recomendação devem ser adotados quando houver fonte real e aderência comercial. Sem ativar gastos, IA paga, coleta real, banco, pagamentos, DNS ou integrações novas nesta micro-rodada documental.
