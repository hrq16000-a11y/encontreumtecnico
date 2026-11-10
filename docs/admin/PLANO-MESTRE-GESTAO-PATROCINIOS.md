# Encontre um Técnico — plano mestre de gestão e patrocínios

**Status:** especificação aprovada como direção de produto; implementação incremental.  
**Prioridade comercial:** patrocínios, banners e anúncios diretos de empresas.  
**Escopo:** portal principal, Home2, LPs públicas, páginas por cidade/serviço, busca, perfis e futuras frentes, com o mesmo backend e regras de permissão.  
**Fonte de demanda:** relato do proprietário e captura do /admin em 10/11/2026.

## 1. Objetivo do /admin

O proprietário deve conseguir controlar todas as **operações de negócio** da plataforma sem editar código: cadastros, taxonomia, áreas atendidas, conteúdo editorial, layouts publicitários configuráveis, campanhas, patrocinadores, preços comerciais, permissões, segurança, SEO editorial, relatórios e integrações permitidas. Mudanças em código, infraestrutura, DNS, autenticação sensível e migrações exigem fluxos próprios com aprovação e rollback — não se deve oferecer uma "edição irrestrita do banco" no navegador.

O /admin atual é um conjunto longo de componentes, não um console de gestão. Já existem funcionalidades reais de métricas, revisão WordPress, reivindicações, categorias, serviços e técnicos. Não substituir essas operações nem confundir **registros importados**, **contas autenticadas**, **perfis públicos** e **perfis ativos**.

## 2. Mapa completo de módulos

| Módulo | Controles esperados | Estado de referência 10/11 |
| --- | --- | --- |
| Visão geral | indicadores reais, alertas, últimas ações, pendências, atalhos por contexto | parcial: quatro KPIs e métricas |
| Patrocinadores (P0 comercial) | CNPJ/razão social, marca, contatos comerciais privados, proposta, contrato, situação, representantes e histórico | não identificado no /admin atual |
| Inventário de banners (P0) | slots com ID, rota, posição, formato, tamanhos responsivos, limites e disponibilidade | não identificado |
| Campanhas e criativos (P0) | criar, editar, duplicar, aprovar, agendar, pausar, expirar, pré-visualizar, associar banners, URL final segura, rótulo Publicidade | não identificado |
| Segmentação e entrega | UF, município, categoria, serviço, rota e dispositivo; prioridade, cota, rotação, exclusividade e concorrência | não identificado |
| Comercial e financeiro | tabela de preços de mídia, pacotes, propostas, cobranças, conciliação de pagamentos, renovação, comprovantes | não identificado; proibir receita fictícia |
| Relatórios de mídia | impressões verificáveis, cliques válidos, CTR, campanhas, receita confirmada, expiração, exportação | não identificado |
| Técnicos e clientes | busca e edição paginada, identidade confirmada, estados de publicação, serviços, cidade/bairro, bloqueios, privacidade e histórico | parcial, com importação/revisão |
| Categorias e serviços | CRUD, ordem, sinônimos, hierarquia, ativação, SEO e histórico | parcial, componentes existentes |
| Páginas e conteúdo (CMS) | textos, imagens, ordem de seções, menus, rodapés, logos, CTA, landing pages, SEO editorial, preview | pendente de inventário completo |
| Demandas e triagem | solicitações, consentimento, destinatário, status, histórico, spam, mensagens privadas | parcial |
| Avaliações/moderação | denúncias, conteúdo impróprio, bloqueios, justificativa e direito de resposta | a detalhar |
| Comunidade e convites | origem do convite, indicadores agregados, moderação e limites de abuso | parcial |
| Usuários e permissões | administradores autorizados, funções granulares, delegação, sessões e trilha de auditoria | admin básico; RBAC granular pendente |
| Configurações e publicação | recursos habilitados, backup lógico, revisão de alteração, preview, versões, rollback, proteção de produção | pendente |
| SEO e indexabilidade | metadados, redirects autorizados, canonicals, sitemap, index/noindex, GSC, auditoria por página | parcial; cutover do domínio é projeto separado |
| Integrações e API | credenciais **somente no servidor**, jobs, saúde, quotas, falhas, logs sem segredos | parcial |

A monetização por patrocinadores é **prioritária**; não mudar silenciosamente o modelo de gratuidade de cadastro dos técnicos. Eventuais compras de acesso a contato/serviços são produto distinto e precisam de preços, transparência e autorização próprios.

## 3. Publicidade: inventário por espaço, não banners soltos no código

### Slots iniciais propostos (IDs estáveis)

| ID | Superfície | Localização | Observação |
| --- | --- | --- | --- |
| `home.hero_below` | home principal | após apresentação principal | destaque premium, preservar CLS |
| `home.content_1` | home | entre blocos editoriais | responsivo |
| `home.footer_pre` | home | antes do rodapé | rodízio |
| `home2.content_1` | Home2 | bloco editorial próprio | conteúdo e SEO independentes |
| `search.top` | /tecnicos | acima da lista de resultados | identificado como anúncio |
| `search.inline` | /tecnicos | a cada intervalo configurado | nunca misturar com resultado orgânico sem identificação |
| `search.sidebar` | /tecnicos | barra lateral em desktop | reposicionamento responsivo |
| `profile.below_intro` | /tecnico/:slug | após informações principais | não sugerir validação profissional |
| `services.content_1` | /servicos | entre categorias/serviços | contextual |
| `city.content_1` | páginas regionais elegíveis | bloco da cidade | sem doorway ou conteúdo artificial |
| `content.article_inline` | guias futuros | entre seções | limites de densidade |
| `global.footer_pre` | páginas públicas elegíveis | antes do rodapé | exclusões por rota |
| `landing.*` | LPs públicas selecionadas | posições cadastradas individualmente | nunca sobrepor CTA essencial |

**Exclusões padrão:** /admin, /entrar, painel do cliente/técnico, páginas privadas, confirmação de pagamento, formulários sensíveis, erros e autorização de identidade. "Em todos os locais" significa **todas as superfícies públicas elegíveis e configuráveis**, não cobrir ações críticas, atrapalhar o usuário ou coletar dados sensíveis.

### Formatos suportados por prioridade

- **Fase 1:** banner de imagem responsiva, card patrocinado textual/visual, selo de patrocínio de uma seção e destaque de marca com identificação.
- **Fase 2:** vídeo curto silencioso e acessível, carrossel patrocinado e campanhas de seção, sem autoplay sonoro.
- **Fase 3 (se justificar):** formatos rich media controlados, sem JavaScript arbitrário de terceiros e sem pop-ups intrusivos.
- Cada criativo terá versões mobile/desktop e fallback; dimensões/aspect ratio, peso máximo e reserva de espaço definidos no slot para limitar CLS/LCP.
- **Sempre rotular:** “Publicidade” ou “Patrocinado”. Anúncios não alteram a ordenação orgânica de prestadores nem simulam avaliações ou certificação.

### Regras de entrega

- Público-alvo por **UF, município, categoria, serviço e página** usando somente filtros ou dados que o visitante forneceu; geolocalização precisa somente com consentimento, sem fingerprinting.
- Disponibilidade por data/hora e fuso, prioridade, exclusividade por slot/período, frequência por visita **com base lícita**, teto de impressões e fallback sem anúncio.
- Ações `rascunho → em revisão → aprovado/agendado → ativo → pausado/expirado`; só ativos e aprovados podem renderizar.
- Criativo deve ser revisado contra phishing, conteúdo enganoso, URL de destino maliciosa, direitos de imagem e políticas comerciais. Destinos HTTPS validados; sem HTML/JS livre.
- Aprovar alterações comerciais relevantes requer permissão apropriada, log imutável e possibilidade de pausar imediatamente um anúncio.
- Relatórios distinguem **reservado, contratado, faturado, pago**; não contar impressões/cliques falsos, duplicados ou bloqueados. Métricas consentidas/agregadas e exportáveis.

## 4. Contrato de dados a construir em migração isolada

**Não executar criação de tabelas nesta especificação.** Aprovar esquema e políticas RLS antes de cada migração. Nomes de trabalho:

1. `eut_sponsors`: titular comercial, marca, dados de faturamento e contatos privados, estado.
2. `eut_ad_placements`: ID de slot, rota/página, tipo de layout, dimensões, ativo, limites de inventário.
3. `eut_ad_campaigns`: sponsor_id, nome, prazo, objetivos, modelos de preço, limites e status de aprovação.
4. `eut_ad_creatives`: campanha, mídia armazenada, alt, texto, URL final, formatos, revisão, versão.
5. `eut_ad_campaign_placements`: atribuição de campanhas a slots, prioridade, exclusividade, cota, regras de segmentação controladas.
6. `eut_ad_contracts` / `eut_ad_invoices`: acordos e faturamento; somente informações comerciais verificadas.
7. `eut_ad_daily_stats`: agregados diários de entrega, cliques legítimos e erros; retenção explícita, sem PII.
8. `eut_admin_audit_log`: ator autorizado, recurso, operação, versão anterior/posterior *sem segredos*, data e motivo.
9. `eut_site_content` / `eut_site_content_versions`: CMS governado por campos e revisões, sem expor segredos ou HTML arbitrário.

Regras: RLS em toda tabela exposta; leitura pública só de criativos **aprovados, ativos, no prazo e no slot permitido**, servida por função/view de leitura estritamente pública; escrita somente a operadores com papéis do servidor e escopo apropriado. Contatos comerciais, preços negociados e dados financeiros ficam restritos aos papéis autorizados. Medição e pagamentos nunca confiarão em contadores enviados pelo navegador como fonte de verdade.

## 5. Modelo de permissões

- **Proprietário/superadmin:** configura gestão, delegações e políticas comerciais. Operações sensíveis com confirmação extra e auditoria.
- **Administrador operacional:** cadastros, suporte e moderação; não altera papéis de proprietário nem segredos.
- **Gestor comercial:** anunciantes, propostas, campanhas e posições dentro de limites; não acessa contatos privados de técnicos sem base legal.
- **Editor CMS:** conteúdo e mídia revisáveis; sem autorização de pagamentos ou RLS.
- **Financeiro:** contratos, faturas e recebimentos; não consegue alterar a segurança do portal.
- **Analista:** somente relatórios agregados.
- Contas técnico/cliente: **nunca** podem acessar dados administrativos. Não derivar autorização de e-mail visível, `user_metadata` editável ou flag no front-end; exigir RBAC/checagem no servidor.

## 6. UX do painel administrativo

- **Navegação por módulos**, busca global, atalhos, breadcrumbs, filtros, paginação e cards com estado.
- **Home administrativa**: receita patrocinadores *confirmada*, campanhas ativas, espaços livres, contratos vencendo, cliques válidos, demandas reais, técnicos ativos, fichas históricas em revisão, erros operacionais, pendências.
- Contadores distintos para: `legado importado`, `identidade verificada`, `perfil autorizado`, `perfil público`, `online`. A captura de 10/11 mostra 0 técnicos ativos na base nova e centenas de fichas WordPress ainda em revisão; nunca chamar importados de ativos.
- **Cada módulo:** lista filtrável, detalhe, edição, validação, prévia, publicação, histórico e exportação conforme permissão.
- **Gestão de publicidade:** mapa visual dos slots públicos, ocupação, preview de criativos em mobile/desktop, agenda, limites de investimento e botão de pausa urgente.
- Tela da configuração deve explicar *o que será alterado e onde aparecerá*, com prévia e validação; recursos em planejamento não devem parecer operacionais.

## 7. Micro-rodadas e critérios de conclusão

| Rodada | Entrega de produto | Gate verificável |
| --- | --- | --- |
| R1 — esta | plano mestre versionado; mapa navegável das funções administrativas que **já existem** | build/tsc, testes, sem alterar banco/produção antes dos gates |
| R2 | SQL e RLS de sponsors, slots, campanhas, criativos e papéis de mídia; só dados de teste em ambiente autorizado | migração rastreada, RLS negativa, nenhuma publicação acidental |
| R3 | CRUD real de patrocinadores e biblioteca de mídias na área protegida; estados rascunho/arquivado | RBAC, auditoria, upload seguro, permissões negativas |
| R4 | cadastrar slots e posicioná-los em home e busca, com fallback sem campanha | SSR/SEO, mobile, acessibilidade, CLS, privacidade, nada fora de slots declarados |
| R5 | editor de campanhas, segmentação, preview, agendamento, ativar/pausar, rotação | relógio/expiração, filtragem e RLS, desativação imediata |
| R6 | relatórios agregados e financeiro comercial comprovável | faturamento sem placeholders, reconciliação, consentimento |
| R7 | ampliar inventário em perfis/LPs/cidades/artigos; pacotes e renovação | testes de regressão, SEO, métricas e densidade por página |
| R8 | CMS de menus, textos, rodapé, SEO editorial e controles adicionais por módulo | versão, preview, auditoria, rollback, sem alterações de DNS |

**Sequência P0 de negócio:** patrocinadores → espaços/slots → campanhas e criativos → exibição real e métricas → comercial/financeiro → CMS/gestão transversal. O conteúdo legado continua sob as regras de revisão e titularidade.

## 8. Regras de execução permanentes

1. GitHub é fonte de código, Vercel publica versões aprovadas; não usar Lovable Max, não mexer em DNS, não criar banco paralelo nem migrar dados por impulso.
2. Micro-rodadas isoladas: branch, PR, gate, preview, merge somente se aprovado; evitar deployments redundantes.
3. Banir demos publicitárias fictícias em produção; nenhum “campanha ativa” sem patrocinador, prazo, contrato/critério comercial e criativo autorizado.
4. Nunca expor telefones, e-mails privados ou dados pessoais de cadastros antigos em mídia ou relatórios; manter verificação do titular.
5. Patrocínio é **publicidade**, não certificação, nota de qualidade, classificação profissional nem privilégio disfarçado na busca.
6. Avisar explicitamente qual capacidade já está operacional e qual ainda depende de desenvolvimento/validação.

## 9. Referências de código no estado atual

- `src/routes/admin.tsx`: indicadores, métricas, técnicos, solicitações e mensagens.
- `src/components/search-metrics.tsx`: métricas de busca consentidas.
- `src/components/legacy-review-queue.tsx`: acervo WordPress.
- `src/components/legacy-claim-review.tsx`: revisão de reivindicações.
- `src/components/eut-admin-manager.tsx`: gestão parcial de categorias, serviços e fichas.
- `AGENTS.md`: diretrizes de arquitetura, proteção do projeto conectado e integrações.
