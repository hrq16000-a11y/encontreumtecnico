# EUT — Expansão regional, SEO em rede e captação de profissionais
Data de referência: 2026-11-20. Fonte comercial: mensagem de recrutamento fornecida pelo proprietário neste atendimento. Status: plano de implantação; somente o primeiro bloco de captação está codificado nesta PR.

## Objetivo e evidência
- Prioridade empresarial: gerar cadastro simples e completo de técnicos e registrar a necessidade do cliente por serviço + município, sem induzir disponibilidade inexistente.
- Proprietário relata cerca de **300 demandas por dia** na operação/rede. Esse número **não foi conciliado com dados do EUT**; não exibir como prova social, taxa de atendimento ou estatística do site até existir fonte, período, deduplicação e consentimento adequados.
- O chamado de recrutamento não comprova que já há técnicos elegíveis nem pedidos persistidos nas 65 cidades. A lista é referência de expansão, não dado técnico do Supabase.
- Abrangência contínua pedida: **PR, SC, RS, SP e RJ inteiros**. Relação nominativa: **65 municípios em outras 18 UFs**, preservada abaixo. Não equiparar "Região Sul toda" a 3 municípios.
- "Cachoeirinhas, TO" aparece literalmente no comunicado; IBGE registra **Cachoeirinha/TO** (referência oficial https://www.ibge.gov.br/cidades-e-estados/to/cachoeirinha.html). O site usa o nome municipal oficial; documento preserva a origem e a reconciliação. "Rio Branco/MT" existe no IBGE: https://www.ibge.gov.br/cidades-e-estados/mt/rio-branco.html. Validar demais nomes/IDs contra `eut_ibge_municipalities` antes de novas URLs de cidade.

## Inventário da mensagem — estado por estado
- **AL (3):** Arapiraca; Campo Grande; Jundiá.
- **AM (4):** Barreirinha; Benjamin Constant; Careiro; Manaus.
- **AP (1):** Macapá.
- **BA (2):** Alagoinhas; Ilhéus.
- **CE (5):** Cascavel; Barreira; Campos Sales; Iracema; Viçosa do Ceará.
- **ES (10):** Vitória; Vila Velha; Águia Branca; Anchieta; Boa Esperança; Cariacica; Ibitirama; Itapemirim; Presidente Kennedy; Serra.
- **GO (5):** Itumbiara; Caldas Novas; Divinópolis de Goiás; Goiânia; Valparaíso de Goiás.
- **MA (3):** Jatobá; Montes Altos; Vargem Grande.
- **MG (9):** Belo Horizonte; Betim; Campo Belo; Diamantina; Governador Valadares; Juiz de Fora; Montes Claros; Teófilo Otoni; Ubá.
- **MS (2):** Campo Grande; Dourados.
- **MT (2):** Rio Branco; Sinop.
- **PB (2):** Alagoinha; Bayeux.
- **PE (3):** Barreiros; Caruaru; Jaboatão dos Guararapes.
- **PI (3):** Teresina; Parnaíba; Parnaguá.
- **RN (2):** Mossoró; Viçosa.
- **RO (1):** Vilhena.
- **SE (4):** Aracaju; Laranjeiras; Pinhão; Salgado.
- **TO (4):** Cachoeirinhas [nome recebido; oficial Cachoeirinha]; Monte do Carmo; Taguatinga; Palmas.

## Estado real examinado no repositório
- `src/routes/cidades.$uf.$cidade.tsx`: SSR/canonical para cidade apenas quando `getSeoCity` retorna perfis elegíveis; sem perfil, o loader responde 404.
- `src/lib/public-seo-graph.functions.ts`: confere elegibilidade pública e monta cidades/categorias, descartando resultados ausentes, privados, suspensos; não alterar esta barreira para fabricar cobertura.
- `src/lib/public-sitemap-index.ts` + `sitemaps.*`: índice e sitemaps base/cidades/categorias/técnicos. `cidades` contém somente municípios com pelo menos um perfil público elegível. `/cobertura` já pertence ao sitemap base.
- `src/components/public-seo-discovery.tsx`: interliga perfil, cidade, categoria e serviços; não é correto dizer que o grafo inexiste. Ligações **guias → categorias → cidades → perfis → serviços → regiões** ainda requerem auditoria de completude.
- `src/components/home-public-proof.tsx`: até três perfis públicos elegíveis, carregados ao visualizar; zero avaliações/depoimentos falsos. A seção pode estar vazia quando a consulta falha ou não existem perfis.
- `src/components/home-community-invite.tsx`: banner público + pop-up após 11 segundos, com proteção de privacidade, foco e sessão. Verificar visibilidade real, frequência e conversão em navegador; não declarar inexistente sem QA.
- `src/components/sponsored-public-slot.tsx`: publicidades aprovadas por RPC; se não houver campanha, mostra convite para anunciante. `src/components/adsense-public-unit.tsx`: unidade condicionada ao consentimento e flag; exibição real depende de aprovação/preenchimento do provedor.
- `src/components/adsense-loader.tsx`: publicidade limitada a rotas públicas elegíveis; anúncios em formulários/contas privadas e overlays intrusivos não são meta.

## Primeira entrega desta PR (sem dependências, SQL ou nova página thin)
1. Home: chamada visível para cadastro gratuito de técnico e link navegável para localidades listadas.
2. /cobertura: seção de recrutamento agrupada por UF; 65 buscas filtradas por cidade/UF; CTA de cadastro; declaração explícita de que a lista não representa disponibilidade/contagem de pedidos.
3. Testes sintéticos de integridade e conversão de links, incluindo duas cidades com homônimos/ambiguidade. **Não houve alteração nos 65 municípios do banco.**
4. /cobertura permanece no sitemap já existente; **nenhum `/cidades/... ` sem técnico foi indexado à força**, nenhuma regra de moderação mudada.

## Fases seguintes — backlog de execução independente
### P0 — demanda/cadastro e prova quantitativa
- Instrumentar o funil existente: etapa de entrada, município IBGE, categoria/serviço, envio consentido, erro seguro e confirmação de ticket. Registrar agregações sem telefone nem nome em analytics públicos.
- Confirmar com dados reais as demandas **recebidas / únicas / concluídas / sem resposta / convertidas em cadastro** por cidade e dia. Distinguir rede externa, mensagem do grupo e pedidos do EUT. Jamais publicar "300/dia" sem trilha.
- Auditoria ponta a ponta 390/1440: Home → busca por serviço/cidade → sem resultados → pedir ajuda → confirmação; Home → cadastro técnico → rascunho → revisão → perfil. Sem reabrir OTP como tema deste projeto.
- Atribuição por campanha: cada CTA, publicidade e orgânico com UTM preservada sob consentimento; conversões por município/serviço; não registrar números privados na camada pública.

### P1 — páginas indexáveis que têm valor
- Para cidades com técnicos: `/cidades/{uf}/{slug}` com resposta HTTP 200, canonical, SSR, perfis elegíveis, categorias oferecidas, serviços pertinentes, orientação local original e CTA de solicitação; gerar links recíprocos e sitemap elegível.
- Para cidades sem técnico: não emitir página de "profissionais disponíveis"; disponibilizar busca filtrada e captação de cadastro/necessidade. Se houver demanda real e conteúdo exclusivo útil (não duplicado), estudar página editorial útil e indexação caso a caso; até lá, **noindex e fora do sitemap**.
- Expansão de grafo de navegação com links HTML `<a href>` SSR e breadcrumbs: Home ↔ Cobertura ↔ Cidades ↔ Categorias ↔ Serviços ↔ Guias ↔ Perfis, sob relevância contextual, sem links artificiais e sem expor privados.
- SEO: robots e meta index apenas em páginas canônicas substantivas; sitemaps segmentados já existentes, `lastmod` verdadeiro, 200/301/404/noindex coerentes, sem páginas de filtros duplicadas e sem entradas órfãs; monitorar Google Search Console (indexadas x enviadas, impressões, cliques e páginas excluídas).
- Guia original por categoria e problema comum com orientações práticas locais, segurança e links para serviços. Não copiar texto de concorrentes ou multiplicar templates vazios.
- O Google enquadra doorway/scaled content e listagens artificiais de cidades como spam potencial: https://developers.google.com/search/docs/essentials/spam-policies . Sitemap facilita descoberta, **não garante indexação**: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap .

### P1 — Home, social proof e conversão
- Reorganizar a Home em entradas "Preciso de técnico" e "Sou profissional", busca município + serviço com digitação simples, cidade/região base, indicação quando não existe oferta, CTA para pedir ajuda sem pagar antes de saber as condições; testar UX mobile 390 e desktop 1440.
- Prova social **verificável**: perfis realmente publicados e autorizados; contadores apenas com consulta agregada/auditada; depoimentos de clientes apenas com consentimento e procedência; nunca estrelas fictícias, técnicos falsos, "ao vivo" simulado ou fotos geradas representando pessoas reais.
- Banners editoriais não invasivos: chamada regional e convites para cadastro/ajuda; pop-up existente deve ter limite de sessão, fechar/Escape, não cobrir campo nem botão sticky, não ser modal intrusivo, respeitar reduzido movimento. Medir CTR e conversão de banners/callouts antes de adicionar outros.
- Usar Triider/GetNinjas apenas como referências de estrutura de descoberta e cadastro, **não copiar sua marca, conteúdos nem cobrança**. EUT mantém contato direto, sem leilão ou intermediação financeira. Referências: https://www.triider.com.br/como-funciona e https://www.getninjas.com.br/central-de-ajuda/geral/quem-somos/como-funciona-o-getninjas .

### P2 — publicidade distribuída por contexto
- Mapear slots públicos por tipo de página `home.content_1`, `search.top`, `services.content_1`, `city.content_1`, `category.content_1`, `guide.article_inline`, `profile.related`; verificar quais contratos estão implementados e quais exigem SQL/admin antes de ativar. Não anunciar a todos como ativos.
- Segmentação de patrocínio por município IBGE, UF/região, categoria/serviço; fallback seguro sem patrocinador; campanhas com vigência, motivo de aprovação e auditoria administrativa. Não revelar telefone privado.
- AdSense responsivo somente em páginas públicas com consentimento/configuração aplicável, bem separado do conteúdo, nunca substituindo CTA crítico, menus ou formulários. Google: https://support.google.com/adsense/answer/1346295?hl=en e https://support.google.com/adsense/answer/1282097?hl=en-en .
- Não usar intersticiais de anúncios que atrapalhem navegação. Publicidade precisa de rótulo explícito; usuários com bloqueador/sem consentimento devem poder usar o site normalmente.

## Gates de aceite por rodada
- Cadastro técnico e funil navegáveis em 390/1440 e teclado; foco/legibilidade; links corretos; hidratação SSR; sem rolagem horizontal.
- SEO HTTP real: robots/canonical, XML válido, links internos rastreáveis, 200 para página legítima, 404 para inexistente, nenhum perfil suspenso e nenhum telefone privado.
- Anúncios consentidos e identificados, sem interferência em CTA e sem violação de privacidade.
- CI direcionado + build + TypeScript + gates de privacidade quando afetados, SHA exato, publicação única e verificação READY, somente após homologação.
- Sem SQL, RLS, dados, importações, suspensos, Pioneiros, banners de anunciantes ou flags de produção nesta primeira PR.
