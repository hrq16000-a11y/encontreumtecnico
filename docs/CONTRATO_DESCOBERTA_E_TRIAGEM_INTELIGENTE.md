# Contrato de descoberta e triagem inteligente — Pilar 1

**Data:** 28/11/2026. **Escopo autorizado:** exclusivamente Rodada 1, documental.
**Estado:** contrato consolidado e inventário baseado em código local e testes; não constitui homologação do portal, confirmação do banco em produção, merge, sincronização GitHub ou publicação.

## 1. Autoridade, preservação e leitura obrigatória

A especificação integral do proprietário está preservada no Anexo A, sem reescrever seu conteúdo. Este documento complementa `../AGENTS.md` e `CONTRATO_MOTOR_ATENDIMENTO_E_CRM.md`, sem substituir regras comerciais, privacidade ou autorizações existentes. Consulte também `CONTRATO_SEO_CONHECIMENTO_IA.md`, `checkout-contact-activation.md` e as propostas e evidências em `docs/sql/`, `docs/migration/` e `docs/qa/` antes de qualquer execução futura pertinente.

- Repositório oficial declarado: `hrq16000-a11y/encontreumtecnico`.
- Domínio oficial declarado e utilizado nos canonical atuais: `https://www.encontreumtecnico.com.br`.
- Manter TanStack Start, React, Supabase dedicado, catálogo, solicitações e administração existentes.
- Nenhuma autorização para novo banco, SQL, importação, autenticação, pagamentos, DNS, integração externa, alteração de LP2 ou deploy decorre desta rodada.
- Não modificar regras tarifárias por inferência: não cobrar do profissional, não fazer leilão; distinguir serviço prestado, contato/indicação e eventual oferta própria homologada.
- O contrato de CRM possui condições específicas de evidência, persistência e eventual oferta remota. Não aplicá-las indiscriminadamente à busca, suporte de cadastro ou indicação; preservar o perfil local e a matriz comercial vigente.

## 2. Missão e medida de resultado

Ajudar o cliente a encontrar o profissional adequado ao problema, à especialidade, à localização, à modalidade e à cobertura realmente informada. Preservar valorização, confiança, proximidade, transparência, negociação livre e contato permitido conforme contratos. A medida de negócio é a quantidade mensal de clientes cujas solicitações foram aceitas por técnicos; abrir um popup, uma conversa ou um formulário não equivale a solicitação aceita.

## 3. Arquitetura consolidada — reutilização, não reconstrução

```text
Home / busca / perfil / cidade / especialidade / guia / contato
  |-- busca direta, sem exigir triagem
  |     -> filtros canônicos -> listApprovedTechnicians
  |     -> elegibilidade pública + cobertura -> ranking -> paginação
  |     -> TechnicianSearchCard -> perfil público
  |
  |-- ProblemAssistant -> triageProblem
  |     -> classificador local; refinamento opcional AI Gateway
  |     -> sugestão -> filtros + rascunho -> busca
  |
  |-- openFreeHelp(context) -> evento eut-open-free-help
        -> FreeSearchHelp -> AssistanceFunnel
        -> revisão + consentimento -> contact_messages
        -> confirmação do registro -> WhatsApp opcional da equipe

Fluxo autenticado de cliente/técnico -> service_requests / histórico
Admin existente -> filas + SearchMetrics -> admin_search_metrics
Buscas consentidas -> recordSearch -> search_events
```

**Distinção fundamental:** a entrada guiada pública registra `contact_messages`; ela não demonstra criação automática em `service_requests`. Os dois contratos já existem e devem ser reconciliados sem criar um terceiro funil ou um segundo painel. Os modos `direct` e `managed` são modelos de encaminhamento, não modalidades técnicas presencial/remoto/bancada.

## 4. Inventário verificável

Legenda: **existente no código** não significa implantado no Supabase dedicado; **parcial** exige aperfeiçoamento; **não verificado** exige evidência externa/autenticada; **planejado** não é implementação.

| Camada | Caminhos e contratos reais | Estado e limites observados |
|---|---|---|
| Busca pública | `src/routes/tecnicos.index.tsx`; `src/lib/technicians.functions.ts` | Existente: loader, filtros de categoria, serviço, UF, cidade, bairro, região, prioridade e página. Não recebe descrição livre do problema como parâmetro de busca. |
| Catálogo ativo | `src/hooks/use-active-categories.ts`; `src/hooks/use-active-services.ts`; `eut_service_categories`, `eut_service_types` | Existente: seleção apenas de entradas ativas; validação server-side da categoria/serviço e da relação entre eles. Hooks carregam catálogo no cliente; não declarar ausência de waterfall ou paridade SSR sem medir. |
| Taxonomia editorial e triagem | `src/lib/service-catalog.ts`; `src/lib/service-taxonomy.ts`; `src/lib/problem-triage-local.ts`; `src/lib/categories.ts` | Há mapeamentos locais/editoriais e aliases. Reconciliar com catálogo ativo, sem inventar novo catálogo ou inferir competências a partir de rótulo legado genérico. |
| Triagem | `src/components/problem-assistant.tsx`; `src/lib/problem-triage.functions.ts`; `src/lib/problem-triage-local.ts`; `src/lib/triage-draft.ts` | Existente: entrada explícita, limite de 10–1000 caracteres, classificação local, IA opcional e fallback em erro/ausência de chave. **Não há rate limiter, cache ou orçamento próprio explícito nesse handler.** |
| Município e bairro | `src/components/municipality-picker.tsx`; `src/lib/neighborhood-sources.ts`; `src/lib/location-labels.ts`; `eut_ibge_municipalities` | Componentes/fontes existem; cadastro canônico e bairro precisam ser utilizados conforme contexto, sem afirmar que todo campo da busca usa IBGE. Cidade na busca é filtro textual com consulta auxiliar ao catálogo. |
| Localização sugerida | `src/components/customer-location-button.tsx`; `src/lib/customer-location.ts`; `src/lib/regional-suggestion.ts`; `src/lib/regional-hint.functions.ts` | Código contempla dispositivo e referência regional aproximada. Handler da busca lê headers regionais da Vercel e verifica cidade no IBGE antes de ranking automático. IP não é precisão geográfica e disponibilidade desses headers depende da hospedagem. |
| Cobertura e ranking | `src/lib/technicians.functions.ts`; `src/lib/technician-local-ranking.ts`; `src/lib/public-directory-pagination.ts` | Existente: cidade-base, cidades atendidas por IDs, UF e estado inteiro declarado; cobertura combinada e deduplicada antes da paginação em busca municipal/ranking global. Ranking por bairro/cidade/UF e desempates existentes. Não calcula distância GPS ou raio real. |
| Elegibilidade | `src/lib/public-eligibility.ts`; `src/lib/public-profile-text.ts` | Existente: consulta de aprovados + RPC `eut_public_eligible_technician_ids`; falha de moderação bloqueia resultado, não concede acesso. Comentário aponta proposta SQL de ativação: implantação não confirmada nesta rodada. |
| Publicação administrativa | `listAdminPublished` em `src/lib/technicians.functions.ts`; RPC `eut_public_admin_technicians` | Código prevê fonte administrativa autorizada com campos públicos. Não exigir conta fictícia nem afirmar que todo cadastro depende de conta vinculada; aplicação real da RPC precisa de evidência autorizada. |
| Cartões e perfis | `src/components/technician-search-card.tsx`; `src/components/public-technician-profile.tsx`; `src/routes/tecnicos.$tecnicoId.tsx`; `src/routes/tecnico.$slug.tsx` | Arquivos existentes. `PublicTechnician` possui campos de cobertura, foto e sinais opcionais; operações públicas são carregadas no perfil via RPC e schema estrito. Não afirmar que todas as modalidades já aparecem nos cartões/lista. |
| Operação declarada | `src/lib/technician-operations-contract.ts`; `src/components/technician-operations-editor.tsx`; RPC `eut_public_technician_operations` | Existente: ferramentas, transporte, deslocamento, janelas, estimativas e regras declaradas de deslocamento. Não é enum das cinco modalidades técnicas; RPC opcional com falha segura. |
| Seleção pesquisável | `src/components/ui/searchable-choice.tsx`; `src/lib/searchable-options.ts`; `src/components/municipality-picker.tsx`; `src/components/debounced-text-filter.tsx` | Reutilizáveis presentes; a busca ainda contém selects nativos e filtros textuais. Universalização é parcial, não nova biblioteca. |
| Popup contextual | `src/components/free-search-help.tsx`; `src/lib/free-search-help.ts`; `src/components/assistance-funnel.tsx` | Existente: evento global, carregamento lazy, modal desktop/base mobile, Escape, foco contido e retorno de foco, scroll-lock. Arrasto não é exigência do proprietário e não deve ser acrescentado como requisito. |
| Contexto e rascunho | `FreeHelpContext`; `src/lib/assistance-draft.ts`; `src/lib/unsent-ui-draft.ts`; `src/lib/triage-draft.ts` | Existente: serviço, técnico, problema inicial, cidade/UF/bairro, modo e guia. Não possui contrato completo de origem imutável, posicionamento, UTM sanitizada ou modalidade técnica. Rascunho local não é persistência no CRM. |
| Registro público e contato | `AssistanceFunnel.finish`; `src/lib/assistance-intent.ts`; `src/lib/assistance-whatsapp.ts`; `contact_messages` | Existente: nome/email/consentimento antes da inserção; sucesso após resposta, WhatsApp da equipe somente na tela de registro confirmado. Não há idempotency key nem identificação durável de solicitação retornada nessa inserção. Não enviar mensagens reais nesta auditoria. |
| Solicitação autenticada | `src/routes/area-cliente.tsx`; `src/routes/area-tecnico.tsx`; `src/components/request-list.tsx`; `src/components/technician-direct-requests.tsx`; `service_requests` | Fluxo e arquivos existentes, com testes relacionados; aceitação por conta real e consulta administrativa não exercitadas nesta rodada documental. |
| Sem resultados | `src/routes/tecnicos.index.tsx`; `groupTechniciansByDeclaredArea`; `openFreeHelp` | Já há ajuda contextual, registro de necessidade, recrutamento, retorno à primeira página e grupos de outras localidades em modo prioridade regional. Não caracterizar como página sem saída. Alternativas de modalidade/cidades relacionadas ainda precisam integração. |
| Analytics | `src/lib/search-analytics.ts`; `src/test/search-analytics.test.ts`; `search_events` | Consentimento, schema e gravação existentes. Payload atual só contabiliza especialidade/cidade/região e quantidade da página carregada; não soma todas as páginas nem inclui todos os filtros avançados. |
| Administração | `src/routes/admin.tsx`; `src/routes/admin_.$secao.tsx`; `src/components/search-metrics.tsx`; `src/components/admin-request-queue.tsx`; RPC `admin_search_metrics` | Painel/filas/gráficos existentes. RPC e permissões no banco ativo não verificadas ao vivo. Não criar segundo painel; gráficos de modalidades, conversão/abandono e demanda sem cobertura são escopo futuro. |
| SEO e descoberta | `src/routes/index.tsx`; `src/routes/cidades.$uf.$cidade.tsx`; `src/routes/servicos.$categoria.tsx`; `src/routes/guias.$slug.tsx`; `src/routes/sitemap[.]xml.ts`; `src/lib/public-sitemap-index.ts` | Rotas, títulos/OG/canonical e sitemap index existem. Não trocar por sitemap simplificado nem criar páginas thin para cada combinação. |

## 5. Contrato de busca e taxonomia

- Identificadores canônicos vêm do catálogo ativo; labels, aliases e sinônimos servem para localizar e confirmar uma opção, não conceder competência ao técnico.
- Busca direta deve continuar disponível. Problema/equipamento/sintoma podem gerar proposta de especialidade; confirmar/corrigir sem forçar assistente.
- Campos extensos: digitação, sugestões limitadas, acentos/caixa/sinônimos, teclado e toque; manter IDs, labels legíveis, vazio/erro/loading e opção manual onde permitida.
- Mudança de UF/cidade invalida contexto incompatível, preserva edições explícitas e reseta paginação apropriadamente. Município homônimo exige UF ou escolha confirmável.
- Filtros técnicos previstos: problema, equipamento, categoria/subcategoria/serviço, UF/município/bairro quando disponível, CEP quando pertinente, raio declarado, cobertura, modalidade e urgência. Só introduzir filtros sustentados por atributos reais e validação existente no servidor.
- Aplicar compatibilidade e elegibilidade antes de ordenação; ordenação global antes de paginação. Preservar prioridades existentes, não substituir por menor preço. Não converter número de itens da página em total nacional de resultados.

## 6. Modelo de cobertura e localização

Separar cidade-base, município atendido, proximidade realmente calculada e remoto declarado. `service_radius_km` é declaração do profissional, não prova de distância. IDs IBGE de cobertura e `covers_entire_state` devem preservar a semântica existente. Não inventar bairro por geocoder ou herdar bairro da cidade-base para outra cidade.

Precedência: escolha explícita > contexto inequívoco da página > sugestão aproximada revisável > ausência de localização. GPS exige autorização; IP/DDD/operadora não determinam endereço exato. Não pedir endereço residencial na descoberta. Não persistir coordenadas em analytics, logs ou solicitação por conveniência. Fonte oficial de município deve poder falhar sem bloquear pesquisa manual.

## 7. Contrato de triagem e modalidades

Triagem é orientação inicial, não diagnóstico. Reutilizar o fallback determinístico existente e reconciliar seu vocabulário com serviços ativos. Ambiguidade deve gerar alternativas ou pergunta mínima; permitir confirmar/corrigir. Não transformar exemplos de TV/celular/recuperação de dados em categorias ativas sem verificar o catálogo.

IA somente se agregar valor: chamada explícita, validação, minimização de dados pessoais, orçamento, limite de chamadas, rate limiting e cache seguro quando apropriado. O código já possui fallback e tamanho limitado, mas os controles de consumo adicionais permanecem pendentes; não alegar proteção de rate limit própria por existir erro de quota do fornecedor.

Modalidades-alvo: presencial/in loco, bancada, retirada/entrega, remoto e híbrido. Devem ser atributos efetivamente ofertados e revisáveis; modos `direct`/`managed` não as substituem. Não garantir reparo remoto sem avaliação, disponibilidade ou preço não informado. Preservar matriz comercial e regras locais de evidência do CRM antes de qualquer ativação.

## 8. Contrato do funil universal

Reutilizar `openFreeHelp`/`FreeSearchHelp`/`AssistanceFunnel` e seus pontos existentes de abertura; não construir formulário independente para cada página. Conferir gatilhos de home, busca, perfil, cidade, especialidade, guia e contato antes de expandir outros.

Contexto desejado: origem/posicionamento imutáveis e sanitizados, técnico, IDs de serviço/especialidade, problema, equipamento, cidade IBGE/UF/bairro, modalidade e urgência realmente conhecidas. Não enviar texto sensível na URL, UTM, logs ou analytics; não sobrescrever rascunho editado. Saltar apenas etapas já confirmadas, permitir revisão.

Preservar rota, scroll, resultados, teclado, Escape e retorno de foco. Mobile deve respeitar teclado virtual, safe-area e área visível de ações; arrasto é opcional, não exigência. Fechamento deve preservar rascunho, não enviar dados. Persistência no servidor só no momento autorizado e com aviso verdadeiro. Reconciliar contato guiado e solicitação autenticada com IDs duráveis, idempotência, retry e estado de falha; não declarar integração com Sheets/CRM existente apenas por constar no contrato.

## 9. Resultados, ausência de cobertura e elegibilidade

Exibir apenas campos públicos autorizados e informações declaradas disponíveis: nome, imagem, serviços, cidade-base, cobertura, apresentação, operações e portfólio quando existente. Separar declaração, confirmação e ausência de dado. Aprovação cadastral não é certificação profissional. Sinais de presença/referral/pioneiro só podem ser exibidos quando retornados pelos mecanismos existentes; não inventar avaliações, selos, números ou distâncias.

Em ausência de cobertura, preservar alternativas já existentes e acrescentar futuramente ações coerentes: ampliar área, buscar cidade próxima com evidência, especialidade relacionada, modalidade ofertada ou orientação. Não prometer que técnico de outro estado atende a cidade. Registrar demanda não atendida sem identificar visitante em analytics e sem criar lead privado automaticamente.

## 10. Analytics, administração e privacidade

Contrato-alvo de eventos: `search_started`, `search_completed`, `search_no_results`, `triage_started`, `triage_completed`, `specialty_suggested`, `specialty_confirmed`, `specialty_corrected`, `location_selected`, `service_modality_selected`, `technician_profile_viewed`, `contact_funnel_opened`, `contact_funnel_step_completed`, `contact_funnel_completed`, `request_created`, `whatsapp_clicked`.

Esses nomes são **planejados**, não declaração de registro atual. Eventos existentes incluem `project.technician_filter_used` e `project.problem_triaged`; fazer inventário de outros gatilhos antes de mapear os nomes, sem emitir duplicados. `recordSearch` tem consentimento; o gatilho `project.problem_triaged` no assistente não verifica consentimento localmente e precisa revisão antes de declarar analytics universalmente consentido.

Não enviar problema livre, endereço, contato, identidade, tokens ou coordenadas a analytics. Deduplicar por ação lógica; diferenciar início, sucesso, falha, busca sem resultados e página vazia. Clique em WhatsApp não prova envio, recebimento ou aceite. Administração deve reutilizar filas existentes para agregações de cidades/categorias/filtros, modalidades, demanda sem cobertura e conversões mensais, com autorização no servidor/RLS; proibir consultar dados privados por cliente público.

## 11. Lacunas reais e prioridades

1. Reconciliar vocabulário local/editorial com catálogo ativo e seleção universal; cidade/categoria/serviço da busca ainda não reutilizam uniformemente os seletores pesquisáveis existentes.
2. Formalizar filtros de cobertura/raio/urgência/modalidades somente após identificar atributos reais e contratos. Não há evidência de cálculo de distância nem enum de modalidades técnicas no handler atual.
3. Completar confirmação/correção e ambiguidade na triagem; implementar controles de consumo/abuso sem tornar busca dependente da IA.
4. Completar contexto imutável/atribuição sanitizada e preservar escolhas no funil; reconciliar `contact_messages` e `service_requests` com idempotência e histórico sem duplicar sistemas.
5. Aperfeiçoar alternativas do vazio já existente, sem prometer cobertura nem classificar outras localidades como locais.
6. Completar analytics consentido, filtros avançados e semântica de total/página; eventos de funil, modalidade e conversão não comprovados como implantados.
7. Homologar contratos/RPCs no Supabase dedicado e contas reais apenas em rodada autorizada; esta revisão não acessou dados de clientes.
8. Revisar metadata por folha em rodada SEO própria: busca e home possuem head; root ainda contém imagem social e index não declara imagem própria, divergência a tratar sem alterar runtime nesta rodada.

## 12. Aceite e sequência de micro-rodadas

### Rodada 1 — entrega atual
- Preservar integralmente especificação e contratos existentes.
- Inventariar caminhos e referências reais; distinguir código, proposta SQL, homologação e produção.
- Consolidar regras, lacunas e critérios; registrar testes e situação Git sem fabricar commit.
- Não alterar aparência, rotas, schema, tarifas, dados, integrações ou publicar.

### Rodada 2 — próximo escopo objetivo, não executado
- Reutilizar os seletores existentes para busca de categoria/serviço e município/UF, sem novo catálogo ou dependência.
- Preservar links profundos, aliases compatíveis, reset de página e par município/UF; confirmar atributos de cobertura/ranking existentes.
- Cobrir com testes: acentos/caixa, seleção inequívoca, cidade homônima/UF, troca de UF, edição, vazio/falha de catálogo, cobertura fora da cidade-base e ordenação antes da paginação.
- QA funcional de busca em 390/768/1440, teclado, reduced motion e lista extensa. Nenhuma alteração SQL se atributo faltar: registrar proposta e aguardar autorização.
- Modalidades/triagem ficam na Rodada 3; não deslocá-las automaticamente para Rodada 2.

Rodada 3: triagem/modalidades/fallbacks. Rodada 4: funil universal/contexto. Rodada 5: cartões/alternativas/conversão. Rodada 6: analytics/admin/homologação. Parar após cada rodada; publicação apenas com autorização e gates próprios.

## 13. Evidências desta rodada e limitações

- Leitura do documento integral e dos caminhos detalhados no inventário; nenhuma revisão geral de integrações externas.
- Comando executado: `bun run test` (script real do projeto: `vitest run`). Resultado: **183 arquivos de testes aprovados, 929 testes aprovados**, duração **75,11s**, início **05:29:55 UTC em 28/11/2026**. Log local: `/tmp/pilar1-tests.log` (temporário, não garantia permanente).
- Observabilidade: últimas entradas lidas às 05:29:21 e 05:29:43 UTC indicaram `build OK`; não foi executado build/typecheck manual. Erros anteriores de árvore de rotas estavam no histórico, não no último sinal.
- Referência pública obtida por leitura: `git ls-remote https://github.com/hrq16000-a11y/encontreumtecnico.git HEAD` retornou `872af048955b49783db2cf6db35adbcf38a4af4b`.
- Referência local observada durante o levantamento: `35880ba11c8049422e9609e9d1f0b512ab47ea51` (o ambiente pode salvar commits automaticamente). Remotos locais são da plataforma, não o repositório oficial diretamente; não registrar URLs autenticadas.
- **Não foi feito commit, push, merge ou deploy pelo agente. Sincronização do contrato no GitHub não foi confirmada.** Verificar presença do arquivo no repositório oficial e SHA antes de afirmar entrega remota.
- Root `AGENTS.md` já está acima do orçamento de edição (10.929/10.240 bytes). Nenhuma regra do proprietário foi cortada: governança complementar em `docs/AGENTS.md`. Vinculação no root permanece pendente de espaço autorizado; não contornar o limite nem reescrever instruções do proprietário.
- Não se verificaram login real, gráficos autenticados, chamadas IA, WhatsApp, produção HTTP ou estado ativo das RPCs. Não houve envio de pedido nem dados fictícios.
- `bun.lock` e `src/routeTree.gen.ts` já apareciam alterados pelo ambiente antes da criação do contrato; não são mudanças documentais deliberadas e não foram editados pelo agente.
- Skills: `0web-skill-router` classificou o trabalho como `docs`; design/motion/CRO e visual QA não se aplicam porque não houve alteração de UI. Sem instalação, execução ou adoção de skill externa.

## Anexo A — especificação integral enviada pelo proprietário

O conteúdo abaixo é reprodução integral do arquivo enviado, preservado como fonte normativa. Seus itens de implementação são requisitos, não alegações de funcionalidades entregues.

# ENCONTRE UM TÉCNICO — PILAR 1

DESCOBERTA, BUSCA CONTEXTUAL E TRIAGEM INTELIGENTE
1. Missão
Estruturar, aperfeiçoar e consolidar completamente a experiência de descoberta, busca, triagem e solicitação de atendimento do Encontre um Técnico.

O portal deve ajudar o cliente a encontrar o profissional adequado ao seu problema, considerando especialidade, localização, modalidade de atendimento e cobertura geográfica.

O posicionamento institucional deve permanecer fundamentado em:

Valorização do profissional.
Confiança.
Proximidade.
Transparência.
Liberdade de negociação.
Ausência de leilão de serviços.
Ausência de precarização profissional.
Contato direto entre cliente e técnico.
Preservação das regras comerciais existentes.
Não transformar o portal em um marketplace tradicional de disputa por menor preço.

2. Preservação da arquitetura existente
Antes de implementar, consulte o código, os componentes, as tabelas, as funções e os contratos existentes.

Consulte especialmente:

AGENTS.md
docs/CONTRATO_MOTOR_ATENDIMENTO_E_CRM.md
Documentação do catálogo de técnicos.
Documentação de cobertura geográfica.
Documentação do funil de atendimento.
Documentação das regras comerciais.
Repositório:

hrq16000-a11y/encontreumtecnico

Domínio oficial:

https://www.encontreumtecnico.com.br

Não reconstruir funcionalidades existentes.

Não criar outro banco de dados.

Não duplicar o funil de atendimento.

Não criar um segundo catálogo de especialidades.

Não modificar a LP2 sem necessidade comprovada.

3. Busca contextual e geolocalizada
Criar ou aperfeiçoar um motor unificado de busca de profissionais.

Critérios de busca
Permitir que o visitante encontre técnicos por:

Problema apresentado.
Equipamento.
Especialidade.
Subespecialidade.
Tipo de serviço.
Estado.
Município.
Bairro, quando disponível.
CEP, quando aplicável.
Raio de atendimento.
Modalidade de atendimento.
Urgência.
Cobertura geográfica.
Exemplos de pesquisa
Meu notebook não liga.
Preciso instalar câmeras de segurança.
Minha impressora não imprime.
Minha internet cai constantemente.
Meu computador está muito lento.
Minha televisão está sem imagem.
Preciso configurar uma rede empresarial.
Meu celular não carrega.
Preciso recuperar arquivos.
Preciso de suporte remoto.
O visitante não deve precisar conhecer termos técnicos para encontrar o profissional adequado.

Campos inteligentes
Todos os campos de seleção extensos devem permitir:

Digitação.
Pesquisa instantânea.
Autocomplete.
Sugestões contextuais.
Seleção por teclado.
Seleção por toque.
Correção de termos comuns.
Tratamento de acentos.
Reconhecimento de sinônimos.
Preenchimento automático contextual.
Evitar listas extensas que obriguem o usuário a rolar centenas de opções.

Utilizar componentes reutilizáveis e acessíveis.

4. Geolocalização e cobertura inteligente
A localização deve considerar a cobertura real informada pelos profissionais.

Localização do cliente
Permitir:

Informar manualmente cidade e UF.
Pesquisar município.
Informar bairro opcionalmente.
Utilizar localização do dispositivo mediante autorização.
Corrigir localização identificada.
Alterar localização durante a navegação.
Utilizar referências oficiais de municípios, preferencialmente IBGE.

Não tratar DDD como localização exata.

Não exigir endereço residencial completo na etapa inicial.

Cobertura profissional
Considerar:

Cidade-base.
Municípios atendidos.
Regiões atendidas.
Raio de deslocamento.
Atendimento presencial.
Atendimento remoto.
Atendimento em bancada.
Retirada e entrega.
Deslocamento informado pelo profissional.
Disponibilidade declarada.
Distinguir claramente:

Técnico localizado na cidade.
Técnico que atende a cidade.
Técnico localizado em município próximo.
Técnico disponível para atendimento remoto.
Não inventar distâncias, disponibilidade ou cobertura.

Ordenação dos resultados
Priorizar:

Compatibilidade com o problema.
Especialidade adequada.
Cobertura confirmada.
Proximidade geográfica.
Modalidade compatível.
Elegibilidade pública.
Critérios de prioridade já existentes no portal.
Aplicar a ordenação antes da paginação.

Não utilizar menor preço como critério dominante.

5. Triagem inteligente do problema
Criar uma camada de interpretação contextual integrada ao catálogo existente.

O cliente deve conseguir descrever o problema em linguagem natural.

Fluxo esperado
Cliente descreve o problema.
Sistema identifica possíveis equipamentos e categorias.
Sistema sugere a especialidade adequada.
Sistema apresenta perguntas complementares somente quando necessário.
Cliente confirma ou corrige a sugestão.
Sistema identifica modalidades de atendimento compatíveis.
Sistema apresenta profissionais elegíveis.
Exemplos
Descrição do cliente	Sugestão inicial
Notebook não liga	Manutenção de notebooks
Internet cai constantemente	Redes e conectividade
Câmera não grava	CFTV e segurança eletrônica
Impressora puxa papel errado	Manutenção de impressoras
Computador muito lento	Suporte e manutenção de computadores
Televisão sem imagem	Assistência técnica de televisores
Preciso recuperar arquivos	Recuperação de dados
Preciso configurar servidor	Infraestrutura e servidores
As sugestões devem ser tratadas como orientação inicial, não como diagnóstico definitivo.

Quando houver ambiguidade, apresentar alternativas relevantes.

Inteligência progressiva
Priorizar inicialmente:

Catálogo canônico.
Taxonomia existente.
Palavras-chave.
Sinônimos.
Regras contextuais.
Correspondência semântica disponível.
Avaliar integração com IA somente quando agregar valor real.

Se utilizar AI Gateway ou outro modelo:

Controlar consumo.
Utilizar cache quando apropriado.
Limitar chamadas.
Aplicar rate limiting.
Evitar chamadas a cada tecla digitada.
Proteger informações pessoais.
Implementar fallback determinístico.
Não tornar a busca dependente de IA.
Não inventar profissionais, serviços, preços ou diagnósticos.

6. Modalidades de atendimento
Estruturar modalidades de atendimento como atributos reais do catálogo profissional e da triagem.

Atendimento presencial — In loco
O profissional se desloca até o cliente.

Atendimento em bancada
O equipamento é levado até o estabelecimento ou local de trabalho do profissional.

Retirada e entrega
O profissional oferece logística de retirada e devolução do equipamento.

Atendimento remoto
O atendimento pode ocorrer por acesso remoto, orientação ou suporte online.

Atendimento híbrido
O atendimento pode começar remotamente e evoluir para uma visita ou atendimento em bancada.

Comportamento esperado
A triagem deve sugerir modalidades compatíveis com o problema.

O cliente deve conseguir confirmar ou alterar sua preferência.

Os resultados devem considerar as modalidades efetivamente oferecidas pelos profissionais.

Não garantir que determinado problema possa ser resolvido remotamente sem avaliação profissional.

Não inventar preços de deslocamento ou atendimento.

Preservar a distinção entre o valor do serviço técnico e eventuais tarifas de indicação ou acesso ao contato previstas nas regras comerciais do portal.

7. Funil universal de solicitação — Modal e Bottom Sheet
Consolidar o funil existente em uma experiência universal e contextual.

Desktop
Utilizar modal acessível, integrado à página atual.

Mobile
Utilizar bottom sheet ou modal responsivo, respeitando teclado virtual, altura disponível e navegação.

Pontos de abertura
O mesmo motor deve funcionar a partir de:

Home.
Busca.
Lista de técnicos.
Perfil profissional.
Página de cidade.
Página de especialidade.
Página de problema.
Página de preços.
Guias.
Artigos.
Página de contato.
CTA de suporte.
Barra inferior mobile.
Não criar formulários independentes para cada página.

Preservação de contexto
Ao abrir o funil, preencher automaticamente, quando disponíveis:

URL de origem.
Página de origem.
Técnico selecionado.
Especialidade.
Subespecialidade.
Equipamento.
Problema.
Município.
UF.
Bairro.
Modalidade de atendimento.
Origem de tráfego.
Campanha.
UTM.
Contexto da pesquisa.
Não perguntar novamente informações já fornecidas pelo visitante.

Não redirecionar o cliente desnecessariamente para uma página genérica.

Ao fechar o modal, preservar a posição de rolagem, os filtros e os resultados anteriores.

Etapas adaptativas
O funil deve solicitar apenas as informações necessárias ao contexto.

Etapas possíveis:

Qual é o problema?
Onde precisa de atendimento?
Qual modalidade prefere?
Qual a urgência?
Como podemos entrar em contato?
Revisar e confirmar.
Quando alguma informação já estiver disponível, pular ou preencher automaticamente a etapa correspondente.

8. Jornada ideal do cliente
A experiência deverá seguir esta lógica:

Cliente acessa o portal → descreve o problema → confirma a especialidade → informa a localização → identifica a modalidade adequada → visualiza profissionais compatíveis → seleciona um profissional ou solicita orientação → abre o funil contextual → confirma a solicitação → recebe feedback claro.

O cliente deve conseguir pesquisar diretamente, sem passar obrigatoriamente pela triagem.

O fluxo deve ser progressivo, flexível e não burocrático.

9. Resultados e cartões de profissionais
Aperfeiçoar os resultados existentes para facilitar a escolha consciente.

Apresentar, quando disponíveis e autorizados:

Nome profissional.
Foto ou logotipo.
Especialidade.
Subespecialidades.
Cidade-base.
Cobertura informada.
Modalidades de atendimento.
Experiência informada.
Apresentação resumida.
Disponibilidade declarada.
Portfólio.
Acesso ao perfil.
CTA contextual.
Diferenciar visualmente informações confirmadas, declaradas e não informadas.

Não inventar:

Avaliações.
Certificações.
Selos de verificação.
Disponibilidade em tempo real.
Quantidade de serviços realizados.
Distâncias.
Preços.
Não expor contatos privados fora das regras comerciais vigentes.

10. Ausência de resultados e alternativas
Quando não houver profissionais compatíveis, não apresentar uma página sem saída.

Oferecer alternativas:

Ampliar a região.
Pesquisar municípios próximos.
Consultar especialidades relacionadas.
Considerar atendimento remoto.
Alterar modalidade.
Solicitar orientação.
Registrar interesse em atendimento na região.
Explicar claramente quando não houver cobertura confirmada.

Registrar demandas não atendidas para identificar oportunidades de expansão da rede.

Não fabricar resultados.

11. Integração com o painel administrativo
Reutilizar a estrutura administrativa 360° existente.

Garantir que o administrador possa consultar, conforme os recursos existentes:

Problemas mais pesquisados.
Especialidades mais procuradas.
Municípios com maior demanda.
Municípios sem cobertura.
Modalidades mais solicitadas.
Pesquisas sem resultados.
Solicitações iniciadas.
Solicitações concluídas.
Origem das solicitações.
Abandono por etapa.
Conversões por especialidade.
Conversões por município.
Integrar ao motor de solicitações e CRM existente.

Não criar outro painel administrativo.

12. Analytics e observabilidade
Aproveitar o analytics existente.

Registrar eventos relevantes:

search_started
search_completed
search_no_results
triage_started
triage_completed
specialty_suggested
specialty_confirmed
specialty_corrected
location_selected
service_modality_selected
technician_profile_viewed
contact_funnel_opened
contact_funnel_step_completed
contact_funnel_completed
request_created
whatsapp_clicked
Evitar eventos duplicados.

Não enviar informações pessoais ou descrições sensíveis para plataformas de analytics.

Distinguir abertura do WhatsApp de mensagem efetivamente enviada.

13. Design engineering e experiência premium
Aplicar os princípios de design já documentados no projeto.

Priorizar:

Mobile-first.
Hierarquia visual.
Componentes consistentes.
Ícones Lucide.
Autocomplete inteligente.
Feedback imediato.
Microinterações úteis.
Transições naturais.
Skeletons.
Estados vazios úteis.
Acessibilidade.
Navegação por teclado.
Motion funcional.
prefers-reduced-motion.
Eliminar aparência genérica.

Não adicionar animações pesadas ou elementos decorativos que prejudiquem a busca.

Validar em:

390px.
768px.
1440px.
14. SEO e descoberta orgânica
Integrar a experiência de descoberta às páginas públicas existentes.

Aproveitar:

Páginas de cidades.
Páginas de especialidades.
Páginas de problemas.
Páginas de equipamentos.
Guias.
Perfis profissionais.
Links internos contextuais.
Preservar SSR, URLs existentes, canonical e sitemap.

Evitar indexação indiscriminada de combinações de filtros.

As páginas públicas devem permanecer acessíveis e compreensíveis sem depender da execução do assistente de IA.

15. DOCUMENTAÇÃO PERMANENTE NO GITHUB
Registrar integralmente este pilar no repositório oficial.

Criar ou atualizar:

docs/CONTRATO_DESCOBERTA_E_TRIAGEM_INTELIGENTE.md

Atualizar:

AGENTS.md

Complementar, quando necessário:

docs/CONTRATO_MOTOR_ATENDIMENTO_E_CRM.md

A documentação deverá conter:

Objetivos.
Regras de negócio.
Arquitetura.
Jornada do cliente.
Taxonomia.
Modelo de cobertura.
Modalidades de atendimento.
Contrato de busca.
Contrato de triagem.
Contrato do funil contextual.
Componentes reutilizáveis.
Integrações.
Eventos de analytics.
Regras de privacidade.
Critérios de elegibilidade.
Critérios de ordenação.
Estados vazios.
Fallbacks.
Critérios de aceitação.
Funcionalidades existentes.
Funcionalidades pendentes.
Decisões permanentes.
Evidências de implementação.
Documentar também os caminhos reais dos componentes, serviços, tabelas e funções utilizados.

Não documentar funcionalidades planejadas como se estivessem implementadas.

Integrar a documentação à estrutura de segundo cérebro do projeto, caso já exista.

16. EXECUÇÃO EM MICRO-RODADAS
Rodada 1 — Contrato e estrutura
Identificar os componentes existentes.
Mapear o fluxo atual.
Consolidar a arquitetura.
Documentar o pilar no GitHub.
Definir lacunas reais.
Reutilizar o máximo possível.
Rodada 2 — Busca e geografia
Busca contextual.
Autocomplete.
Taxonomia.
Localização.
Cobertura.
Ordenação.
Rodada 3 — Triagem e modalidades
Interpretação do problema.
Sugestão de especialidade.
Perguntas adaptativas.
Modalidades de atendimento.
Fallbacks.
Rodada 4 — Funil universal
Modal desktop.
Bottom sheet mobile.
Preenchimento contextual.
Preservação da navegação.
Integração com solicitações.
Rodada 5 — Resultados e conversão
Cartões profissionais.
Compatibilidade.
Estados vazios.
Alternativas.
CTAs.
Aperfeiçoamento visual.
Rodada 6 — Integração e homologação
Analytics.
Integração administrativa.
Validação funcional.
Responsividade.
Acessibilidade.
Documentação final.
Evidências.
Publicação após validação.
17. REGRAS DE EFICIÊNCIA PARA O LOVABLE
Não utilizar Max Mode.
Não executar todas as rodadas simultaneamente.
Não reconstruir páginas existentes.
Não criar dependências desnecessárias.
Não duplicar sistemas.
Não realizar auditorias gerais repetitivas.
Não consumir créditos com funcionalidades comprovadamente concluídas.
Não repetir informações já documentadas.
Priorizar componentes reutilizáveis.
Trabalhar em tarefas pequenas.
Validar cada etapa antes de avançar.
Sincronizar as alterações e a documentação com o GitHub.
Não executar outras sugestões automáticas da fila do Lovable.
Não publicar alterações não validadas.
18. ORDEM DE EXECUÇÃO IMEDIATA
Execute exclusivamente a Rodada 1 neste momento.

Estruture o contrato completo do Pilar 1, aproveitando a arquitetura existente e registrando permanentemente as decisões no GitHub.

Identifique quais funcionalidades já existem, quais precisam de aperfeiçoamento e quais realmente precisam ser implementadas.

Entregue:

Arquitetura consolidada.
Documentação registrada.
Arquivos modificados.
Commit ou evidência de sincronização com o GitHub.
Funcionalidades reaproveitadas.
Lacunas reais.
Escopo objetivo da próxima rodada.
Não avance automaticamente para as demais rodadas.

O objetivo é consolidar um motor inteligente, universal, contextual e reutilizável de descoberta e triagem, sem comprometer o posicionamento comercial, a privacidade ou a infraestrutura existente do Encontre um Técnico.