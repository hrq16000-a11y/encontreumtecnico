# Encontre um Técnico — contrato de usuários unificados e ficha 360°

**Data:** 17/11/2026  
**Origem:** diretriz do proprietário e capturas reais de `/admin/contatos`, `/admin/legado` e `/tecnicos`.  
**Status:** decisão de produto documentada; implementação ampla **ainda não concluída**.  
**Princípio:** SOMAR capacidades de gestão, preservar registros e segurança; não criar outra classe de técnico por sua origem.

## 1. Decisão irrevogável de experiência

Há uma **única central de Usuários** e somente três papéis de negócio:

1. **Admin** — administra conforme permissões efetivas do servidor.
2. **Cliente** — solicita serviços e acompanha seus atendimentos.
3. **Técnico** — oferece serviços e mantém seu perfil profissional.

Uma pessoa possui **uma identidade canônica e um dossiê 360°**. Podem existir permissões adicionais e um perfil profissional vinculado a uma conta admin, mas isso **não cria um quarto tipo de usuário** nem duplica sua identidade. Origem de importação é metadado de auditoria, **não papel nem categoria de pessoa**.

Não expor no produto as categorias de pessoa “WordPress”, “Guiafix”, “WhatsApp”, “contato privado” ou “histórico”. Os registros continuam preservados no banco e podem ser reconciliados por identificadores internos; a proveniência técnica, quando necessária à auditoria, fica fora da navegação de negócio e nunca aparece em cartão público.

### Segurança não é um módulo de pessoas

“Não existe dado privado no painel” significa **não fragmentar pessoas em uma seção chamada Contatos privados**. O painel administrativo pode conter campos restritos, mas somente sob autorização e auditoria, no dossiê do próprio usuário. **Nunca tornar telefone, e-mail, IP, logs, dados de clientes ou outras informações pessoais públicos por causa da unificação.** Preservar RLS e contratos de exposição privada.

## 2. Navegação principal pretendida

| Menu principal | Conteúdo dentro dele |
|---|---|
| **Visão geral** | Indicadores confiáveis e ações pendentes, com definição explícita de cada contagem |
| **Usuários** | **Todos · Admins · Clientes · Técnicos**, busca global, filtros, modos de visualização, ações em massa, criação e dossiê |
| Solicitações | Fila, atribuição, SLA, histórico e vínculo com o usuário |
| Mensagens | Caixa de atendimento e histórico por usuário |
| Categorias e serviços | Catálogo, especialidades e cobertura válida por município/UF |
| Patrocinadores | Anunciantes, campanhas, criativos e posições |
| Métricas | Dados agregados, indicadores e acessos autorizados |
| Configurações | Papéis de acesso, políticas e auditoria administrativa quando autorizado |

**Remover da navegação principal**, após transplantar suas funções com testes: `Técnicos` e `Clientes` como centrais autônomas, `Contas e bloqueios`, `Contatos privados`, `Acervo WordPress` e `Reivindicações`. As funções úteis tornam-se filtros, ações, detalhes ou abas em **Usuários**; **não** apagar rotas, dados ou ferramentas antes de obter paridade e estabelecer redirecionamentos seguros.

### Menu lateral e organização

- Desktop: menu sticky com **altura limitada à janela** e **barra de rolagem vertical própria**; cabeçalho/busca permanecem visíveis. Usuário alcança a última opção por mouse, roda, toque e teclado.
- Mobile 390 px: botão único para expandir/recolher, conteúdo rolável, sem segunda coluna forçada nem rolagem horizontal; fechar com Escape, preservar foco e indicação de aba ativa.
- Apenas opções essenciais no nível superior. Subáreas usam **abas**, **acordeões/sanfonas**, **seções recolhíveis** e **menus contextuais**. Evitar dezenas de botões repetidos por cartão.
- Busca global reutilizada. Favoritos, últimas telas e atalhos devem apontar para o mesmo cadastro, sem cópias de dados.

## 3. Central única de Usuários

**Cabeçalho:** `Usuários` + `Novo usuário` + pesquisa unificada + filtros rápidos `Todos | Admins | Clientes | Técnicos`.

**Filtros combináveis:** nome, telefone/WhatsApp (somente autorizado), e-mail, município/UF, categoria/especialidade, situação, última atividade, data de entrada, completude do cadastro, bloqueio; ordenação e paginação no servidor. As cidades/UFs devem vir de seleção estruturada IBGE, com sugestão contextual e confirmação, não de texto livre persistido.

**Modos da mesma lista:** tabela compacta (padrão desktop), cards legíveis (mobile) e avatares. Mesmo conjunto de resultados, seleção em massa e ações consistentes. A linha mostra apenas o essencial: nome, papel, cidade/UF, especialidades resumidas, situação, completude, última atividade e ações.

**Ações a um clique ou menu de ações:** abrir dossiê, editar, habilitar/desabilitar, suspender/reativar, bloquear/desbloquear, ajustar permissões (admin), exportar dados autorizados e consultar histórico. Ações sensíveis exigem motivo, confirmação, auditoria, permissão e opção de reversão quando tecnicamente possível.

**Operações em massa:** seleção por página ou por filtros com prévia do alcance, seleção de ação, resumo de impacto, motivo, execução auditada, feedback por item e idempotência. Não misturar pessoas fora do filtro, não reativar dois suspensos por engano, não aplicar alteração irreversível sem confirmação.

**Contadores não são intercambiáveis:** identidade única, total de perfis técnicos, perfis completos, profissionais elegíveis à exibição e fichas ainda não reconciliadas devem ser métricas distintas. As capturas exibem `5` no módulo de contatos, `310` no catálogo público e `385` no acervo; **esses números não podem ser somados nem declarados equivalentes sem reconciliação verificável**.

## 4. Dossiê de cada usuário (ficha 360°)

Um cabeçalho fixo contém nome, papel, status, ID canônico, foto real (quando fornecida), cidade/UF e ações principais. O restante é organizado em abas:

| Aba | Dados e operações |
|---|---|
| **Resumo** | Estado, cadastro, completude, atividade recente e ações essenciais |
| **Dados pessoais e contato** | Nome exibido, nome cadastral, e-mail, WhatsApp, endereço/município/UF, foto, consentimentos — edição auditada |
| **Perfil técnico** | Categorias, especialidades, serviços, descrição/apresentação, cobertura e raio, bairro, cidade/UF, slug público, fotos; edição completa |
| **Atendimentos** | Solicitações, OS, visitas, equipamentos, relatórios, responsáveis e SLA quando existentes |
| **Atividade e acessos** | Histórico de login, data/hora, IP e informações de dispositivo/rede **somente quando coletadas legitimamente e disponíveis**, com política de retenção |
| **Segurança e permissões** | Bloqueios, suspensões, papéis e trilha de justificativas; acesso por função |
| **Histórico e auditoria** | Linha temporal legível, antes/depois de mudanças, autor, horário, motivo e resultado |

O usuário cliente vê um subconjunto próprio: identidade/contato, solicitações, histórico, preferências e segurança. Um admin vê permissões e auditoria compatíveis com o seu escopo. A mesma pessoa não precisa existir em três tabelas concorrentes na interface.

**Edição completa:** salvar campos reais, validação de telefone, e-mail, município IBGE e slug exclusivo; preservar versões e redirecionamentos de slugs que já recebam tráfego. Edição de idade: preferir data de nascimento quando houver base legítima e necessidade, com idade derivada; não criar idade fictícia. Todo campo pode ser gerenciado conforme permissão, mas campos derivados e de auditoria não são reescritos arbitrariamente.

## 5. Contrato de cadastro e exibição do técnico

Para **novo perfil técnico completo**, exigir no fluxo: **nome, WhatsApp válido, e-mail válido, categoria/especialidade e município/UF de atendimento**. Categorias/municípios vêm de opções estruturadas; autocomplete sugere, o usuário confirma. Pode cadastrar múltiplas localidades/raio quando compatível com cobertura real.

Para fichas antigas incompletas, preservar identidade e história. Marcar **campos faltantes dentro do dossiê administrativo** e oferecer completude em lote/individual, sem inventar dados e sem criar uma nova categoria “histórico” ou “pendente de origem”. Regras existentes de elegibilidade pública e contato privado só mudam após aprovação específica de contrato e testes.

### Cartão público minimalista

1. Foto/identidade real, nome de exibição e resumo de serviços/especialidades se conhecidos.
2. Localidade exata **somente se informada e validada**. Se não houver cidade, mas houver DDD inequívoco de UF, usar no máximo uma referência estadual curta, como **“Área de atendimento: Alagoas”**; não apresentar isso como cidade verificada nem presumir GPS.
3. Se categoria estiver ausente, usar **“Técnico”**; se localização estiver ausente, omitir a linha. Nunca publicar frases de erro de cadastro.
4. CTA simples para abrir perfil/pedir ajuda pelo fluxo seguro; contato completo não vaza no HTML, SSR, API pública ou mídia.

**Eliminar das telas públicas** (substituição de texto, sem reescrever dados):

| Texto visto nas capturas | Comportamento final |
|---|---|
| “Categoria ainda não declarada” | Mostrar “Técnico” ou omitir a categoria opcional |
| “Local de atendimento não confirmado” | Omitir localidade desconhecida |
| “Nome sugerido (não verificado) · nome no cadastro: …” | Mostrar somente nome de exibição; origem do nome fica no dossiê |
| “Referência regional: Região do DDD 82 · AL · atendimento não confirmado” | Mostrar “Área de atendimento: Alagoas” **quando a referência estadual fizer sentido** |
| “WordPress”, “Guiafix”, importação, vínculo sem procedência | Não mostrar fonte de captura ou origem ao cliente |

**Visual:** card consistente, baixo ruído, hierarquia `foto → nome → serviço → região → ação`, respiro, contraste, avatar proporcional e truncamento elegante de nomes longos. Não fabricar retratos, avaliações ou cidades.

## 6. Modelo técnico e integração aditiva

Não executar migração de banco para alcançar a aparência de unificação. Começar por um **adaptador de leitura/gestão** que reúna, sob um identificador canônico, as fontes já existentes e as funções de administração autorizadas. Somente após inventário de chaves, duplicatas, RLS, gatilhos e testes de reconciliação, propor eventual evolução de schema.

- **Identidade/papel:** conta canônica, papel principal `admin | cliente | tecnico`, permissões administrativas como capacidades restritas.
- **Perfis:** atributos técnicos e do cliente vinculados à mesma identidade; histórico herdado conciliado por chaves comprovadas; evitar merges automáticos apenas por nome ou DDD.
- **Contato:** WhatsApp/e-mail como campos do cadastro da pessoa, não outro tipo de usuário. A visualização administrativa detalhada permanece protegida e auditada.
- **Auditoria:** eventos append-only, quem/quando/o quê/motivo/resultado. Logs de IP/rede só se já previstos, obtidos legitimamente, minimizados e sujeitos à retenção; a origem do visitante não legitima coletar tudo indiscriminadamente.
- **Proteções:** preservar políticas RLS, contatos mascarados no público, dois suspensos, SSR, autorização em servidor, URLs, SEO e dados imutáveis necessários à recuperação.

## 7. Referências no repositório atual (antes da unificação)

- `src/components/admin-navigation.tsx`: menu lateral atual, no desktop com `lg:overflow-visible`; ponto da primeira microcorreção de rolagem.
- `src/lib/admin-sections.ts`: enumeração de módulos, ainda com `contatos`, `contas`, `legado` separados.
- `src/routes/admin.tsx`: entrada dos módulos e atalhos redundantes, acesso administrativo protegido.
- `src/components/admin-technician-unified-directory.tsx`: cadastro técnico, filtros, CRUD e referências de origem a concentrar.
- `src/components/admin-contacts-dashboard.tsx`: contatos e consulta auditada a incorporar no dossiê do técnico, sem torná-los públicos.
- `src/components/admin-accounts-manager.tsx`: identidades e bloqueios a reaproveitar no módulo único.
- `src/components/admin-client-insights.tsx` e `src/components/legacy-review-queue.tsx`: dados operacionais/históricos a reconciliar sem apagar proveniência técnica.
- `src/components/admin-command-overview.tsx`: indicadores com denominadores explícitos, sem confundir históricos com elegíveis.

## 8. Rodadas isoladas e critérios de homologação

| Rodada | Entrega verificável | Regra para integrar |
|---|---|---|
| **R1 — Navegação** | Scroll independente em menu lateral 390/1440; sem perder links/foco; contrato de usuários documentado | Testes locais/CI, QA visual, nenhum menu inacessível |
| **R2 — Usuários** | `/admin/usuarios` com todos os papéis, filtros, tabela/cards, paginação, ações rápidas; módulos antigos preservados como acessos compatíveis | Reconciliação de identidades e totais verificados; sem alteração em massa inadvertida |
| **R3 — Dossiê 360°** | Abas editáveis para identidade, técnico/cliente/admin, acesso e auditoria; absorção segura de contatos e bloqueios | Editar/salvar/reabrir, permissão, trilha, dois suspensos preservados |
| **R4 — Operações em massa** | Filtros, seleção, prévia, motivo, execução, reverter quando possível | Idempotência, autorização, QA de lote isolado sem dados reais afetados por testes |
| **R5 — Cartões públicos** | Texto enxuto, DDD estadual apenas aproximado, campos ausentes ocultos, imagem/ícones/CTA consistentes | QA real 390/1440, a11y, nenhuma exposição de contato |
| **R6 — Limpeza de menus** | Retirar do menu itens duplicados após paridade: contatos, contas/bloqueios, acervo e reivindicações | Todos os recursos acessíveis a partir de Usuários; redirecionamentos e auditoria preservados |

### Critérios de aceite gerais

- Em `390 px` e `1440 px`: sem corte lateral, menu com rolagem própria quando necessário, foco visível, Escape no mobile, sem ações encobertas pelo CTA fixo.
- `Usuários > Todos` mostra exatamente os mesmos registros dos filtros de papel quando somados sem duplicação, com paginação coerente.
- Buscar alguém por nome/e-mail/WhatsApp/município (conforme permissão) leva a **uma ficha**, não a vários painéis.
- Um técnico é sempre técnico, ainda que incompleto ou importado. A listagem pública não exibe mensagens internas ou fonte da ficha.
- Na ficha técnica, cada campo editável persiste e reabre; histórico e permissões auditáveis.
- Não há botão “Contato privado” no menu principal; o telefone autorizado pertence ao dossiê do usuário.
- Publicação somente após CI verde, QA autenticado 390/1440 e aprovação do proprietário. Nunca alterar banco/RLS/produção como consequência incidental de refatoração visual.

## 9. Estado honesto desta entrega

**Documentado:** contrato de produto, telas, exemplos de cópia, integração e critérios de aceite.  
**Na primeira PR:** apenas a rolagem do menu, sem esconder módulos de que o sistema ainda depende.  
**Não implementado ainda:** central unificada, integração de dados, ficha universal completamente editável, ações em massa universais, limpeza dos rótulos públicos e remoção de menus duplicados. Esses itens exigem micro-rodadas com validação real.

