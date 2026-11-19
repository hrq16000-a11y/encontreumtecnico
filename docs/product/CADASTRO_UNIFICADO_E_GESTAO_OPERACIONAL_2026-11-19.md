# Encontre um Técnico — cadastro integrado e gestão operacional

**Decisão do proprietário (Henrique Rodrigues), 19/11/2026.** Documento vivo de produto, execução e aceite. Referência para o cadastro do técnico, a área do técnico, a área do cliente, a administração e o perfil público. GitHub `main` é a fonte de código; este texto não comprova execução nem substitui testes reais.

## 1. Visão do produto

O portal deve combinar **facilidade de cadastro e oportunidade de negócio** de plataformas de serviços com a **qualidade de apresentação profissional** de redes como LinkedIn e a **autonomia editorial/operacional** que o proprietário conhecia no WordPress. Não copiar telas ou marcas e não copiar modelos comerciais incompatíveis.

Um único cadastro canônico alimenta **quatro visões relacionadas**:

| Visão | Necessidade | Mesmo dado, permissão diferente |
|---|---|---|
| Técnico autenticado | Cadastrar, salvar, editar, anexar foto, definir serviços/cobertura e acompanhar pedidos/indicações | Edición apenas do próprio perfil e contatos privados |
| Cliente autenticado | Encontrar e entender o profissional, abrir/acompanhar solicitação e obter contato somente pelo fluxo permitido | Somente informações públicas e seus próprios pedidos |
| Proprietário administrador | Criar, ler, corrigir, suspender, reativar, bloquear, conciliar, auditar e gerir conteúdos/serviços/pedidos/contatos | Operações amplas, porém autorizadas no servidor e registradas |
| Visitante | Descobrir profissionais elegíveis por serviço e município, conhecer experiências e orientações | Nunca recebe telefone privado nem dados administrativos |

**Não são quatro cadastros.** A interface deve editar e projetar a mesma ficha, com identificadores estáveis, sem duplicação entre orgânico, WordPress e importações. Não apresentar origem ao público. Uma alteração confirmada deve refletir nas visões pertinentes após reconsulta, sem criar dados fictícios.

## 2. Regras aprovadas que não podem regredir

1. **Henrique é o único administrador proprietário.** Contatos da lista técnica são técnicos, não administradores. Nunca conceder papel admin por formulário, metadados do cliente ou importação.
2. Técnico legitimamente cadastrado nasce **habilitado por padrão**; não impor aprovação manual ou reivindicação como condição geral de novos perfis. Suspensões, bloqueios e banimentos são controles excepcionais auditáveis. **Preservar os dois contatos já suspensos** e demais restrições.
3. Cadastro do técnico é gratuito. Contratação do serviço é direta entre cliente e profissional, sem leilão, sem comissão sobre o serviço e sem avaliação pública até decisão posterior específica.
4. Receita prevista do portal é o acesso controlado ao contato do técnico, conforme regras comerciais vigentes; não alterar cobrança, limites ou checkout nesta rodada.
5. Telefone completo é **privado ao público**. O proprietário autenticado pode vê-lo e editá-lo no painel conforme contratos já auditados. Nunca incluir contatos privados em HTML/SSR público, sitemap, SEO, analytics ou logs.
6. Município-base e cobertura usam catálogo IBGE. GPS/CEP são sugestões, não substituem confirmação. Especialidades e serviços devem pertencer ao catálogo atual.
7. Dados reais, RLS, auditoria, histórico WordPress, mídias e rotas legadas são patrimônio do projeto. Sem SQL ou migração automática, sem novo Supabase, sem Lovable Max, sem deploy redundante.

## 3. Estado verificável em código e pendência real (19/11)

| Capacidade | Evidência existente | Estado/limite |
|---|---|---|
| Entrada e escolha de papel | `src/routes/cadastro.tsx`, `/entrar` | Existe; login e retomada reais exigem homologação de sessão |
| Cadastro guiado | `src/routes/area-tecnico.tsx`, `technician-registration-wizard.ts` | Três etapas: localidade, serviços, revisão. **Relato do proprietário:** edição/gravação falham e fichas ficam incompletas. Prioridade P0, ainda sem causa-raiz de produção confirmada |
| Persistência do perfil profissional | RPC `eut_publish_my_technician` no formulário | Tentativa de publicação existe. Rascunho pré-publicação fica apenas na sessão do navegador, **não é salvamento durável entre dispositivos** |
| Município e cobertura | `MunicipalityPicker`, `TechnicianCoverageEditor` | Base IBGE na ficha; cobertura fica em aba própria, liberada após publicação |
| Foto profissional | `TechnicianAvatarEditor` | Upload consentido com armazenamento específico; fica em aba própria e exige perfil já publicado. **Não faz parte do cadastro inicial** |
| Contato do técnico | `TechnicianPrivateContact` | Aba privada separada, não faz parte das três etapas iniciais; falta mostrar claramente completude no percurso |
| Painel técnico | `/area-tecnico` | Perfil, foto, cobertura, solicitações, indicações, contato; módulos separados sem jornada única de conclusão |
| Painel cliente | `/area-cliente` e componentes de solicitações | Entrada de pedidos e acompanhamento existentes; provar relação com ficha atualizada e estados reais |
| Administração | `/admin`, `admin-technician-360-sheet`, `admin-technician-record-editor`, diretório unificado | CRUD, ficha 360°, contatos, e-mail e endereço constam em entregas anteriores; **ainda não são prova de controle integral nem de gravação E2E** |
| Dados administrativos privados | `docs/releases/2026-11-18-admin-email-endereco-published.md` e `...admin-campos-cadastrais-visiveis.md` | Releases documentadas. Confirmar cada campo na sessão autorizada antes de marcar homologado |
| Produção | Vercel `msolus/encontreumtecnico` | Deployment READY em `5fad116b` visto em 19/11; READY **não comprova cadastro funcional** |

**Atenção:** o código que detecta uma resposta positiva da RPC pode não provar que todos os campos efetivamente persistiram. É necessário reler a ficha após a gravação, comparar os campos, preservar rascunho quando não for possível confirmar e exibir erro acionável sem vazar mensagens SQL.

## 4. Contrato de cadastro do técnico — experiência-alvo

### Etapa A: começar sem atrito

- Escolher **Sou técnico** → autenticar/retomar mesma conta → reconhecer eventual perfil existente → abrir o editor já preenchido.
- Nunca criar técnico duplicado por repetição de clique, retorno OAuth, recarregamento ou troca de dispositivo.
- Mostrar progresso real, o que é obrigatório/optativo, erros junto aos campos e estado **Salvando / Salvo no servidor / Pendente / Erro**.
- Permitir salvar edição sem obrigar a publicar imediatamente; rascunho protegido e durável exige operação do servidor/RLS apropriada, a validar antes de implementar. Não confundir `sessionStorage` com gravação no banco.

### Etapa B: identidade e presença profissional

- Nome profissional; nome comercial/empresa quando aplicável, apresentação sem contatos externos e categoria/especialidade/serviços canônicos.
- Foto real e autorizada, corte/otimização simples, prévia e troca. Não usar foto falsa de IA nem publicar foto Google sem consentimento explícito.
- Portfólio de serviços executados, imagens próprias autorizadas e experiências relevantes como evolução posterior, com política de moderação de mídia.
- Visualização do próprio perfil público em prévia antes de concluir; medidor privado de completude com ações concretas, **sem inventar certificação, avaliação ou selo**.

### Etapa C: localização e contato

- UF, município oficial IBGE, bairro/áreas atendidas e até os limites de cobertura autorizados; CEP/GPS apenas como ajuda optativa.
- Telefone normalizado e validado no fluxo **privado**. O campo não aparece publicamente, nem a edição pode contornar pagamento/consentimento.
- E-mail de contato, endereço detalhado e outros dados privados aparecem somente onde há permissão e finalidade; não misturar endereço residencial com local público de atendimento.
- Diferenciar **habilitado operacionalmente**, **perfil completo**, **elegível para busca pública**, **contato disponível** e **suspenso**. Habilitação por padrão não significa divulgar perfil sem informações válidas.

### Etapa D: concluir e continuar no painel

- Ao salvar, confirmar no servidor e reler os campos; confirmar que o técnico vê a edição após sair/entrar novamente.
- Perfil, foto, cobertura, disponibilidade, solicitações e indicações acessíveis a partir do mesmo painel e com chamadas de ação contextuais.
- Se campos faltarem, orientar **o próprio técnico** e destacar administrativamente a incompletude, sem apagar conteúdo antigo nem criar fichas duplicadas.

## 5. Integração operacional das visões

| Evento | Técnico | Cliente | Administrador |
|---|---|---|---|
| Técnico conclui cadastro | Vê o registro confirmado e o que falta | Pode encontrar **apenas** perfil elegível na busca | Vê ficha 360° atualizada, completude e histórico |
| Técnico muda foto/serviços/cidade | Vê confirmação e prévia atualizada | Vê apenas versão pública permitida após atualização | Consegue ver, corrigir e auditar campos válidos |
| Cliente abre pedido | Vê se compartilhado/autorizado para ele | Vê protocolo/status reais | Vê fila, origem e trajetória auditável |
| Contato é liberado legitimamente | Não há exposição pública generalizada | Recebe somente acesso contratado/autorizado | Pode auditar operação e gerir incidentes |
| Administrador suspende técnico | Vê estado restrito e orientação | Perfil/contato deixam de aparecer conforme regra | Preserva ficha, motivo, histórico e reversibilidade |

Todos usam contratos de backend definidos; nenhuma permissão crítica pode depender só de esconder botões. O proprietário deve ter visão e **poder operacional completo** sobre recursos do portal, inclusive gerir usuários e conteúdo, com autenticação forte, confirmação de ações sensíveis e rastreabilidade. Não significa expor editor SQL irrestrito no navegador: mudanças estruturais devem passar por migrações versionadas e validação de segurança.

## 6. Administração no estilo WordPress, mantendo segurança

**Objetivo de usabilidade:** o proprietário altera itens comuns pelo painel, sem abrir GitHub, Supabase ou solicitar código.

1. Central única de usuários: técnicos/clientes, dados atuais e históricos, contatos, perfil, origem apenas para reconciliação interna se indispensável, filtros/paginação/ordenação, edição individual e em lote.
2. Ficha 360° configurável: identidade, documentos quando necessários, contato, endereço, categorias, serviços, áreas, mídia, pedidos, interações e auditoria; salva e mostra confirmação real.
3. Editor editorial: Home, seções, CTA, FAQ, banners, categorias, serviços, regiões e páginas institucionais administráveis, com rascunho, prévia e publicação controlada.
4. Módulos operacionais: solicitações, mensagens, acompanhamento de atendimento, patrocinadores/anúncios, indicações, contatos, cobrança e relatórios — integrados por identidade e evento, não por painéis desconexos.
5. Ações em massa com escopo explícito, amostra prévia, confirmação, resultado por registro, auditoria e recuperação. Jamais reativar os suspensos como efeito colateral.
6. Design utilizável a 390/1440, teclado, leitores de tela, foco, contraste, dark/light e movimento reduzido.

## 7. Benchmark de inspiração — adaptar, não copiar

| Referência | O que observar | Aplicação compatível ao EUT | Não adotar automaticamente |
|---|---|---|---|
| [LinkedIn](https://www.linkedin.com/help/linkedin/answer/a546838?lang=pt-BR) | Perfil com foto, sobre, competências, projetos e seções incrementais; [medidor de completude](https://www.linkedin.com/help/linkedin/answer/a594698/como-visualizar-o-seu-medidor-de-forca-do-perfil?lang=pt) | Ficha viva, mídia real, competências, progresso privado, prévia e edição contínua | Rede social, recomendações ou avaliações públicas não aprovadas |
| [GetNinjas](https://blog.getninjas.com.br/como-se-cadastrar-no-getninjas-como-profissional/) | Cadastro por categorias/serviços, informações profissionais e fotos; [fluxo de pedidos](https://www.getninjas.com.br/) | Entrada curta, catálogo guiado, demanda organizada, perfil útil | Compra de leads pelos técnicos, moedas, leilão, modelo comercial diferente |
| [Triider](https://www.triider.com.br/seja-um-profissional) | Jornada pelo celular, etapas claras, oportunidades e detalhes do pedido | Onboarding direto, acompanhamento, contextualização no painel | Aprovação manual geral, intermediação de serviço, comissão e pagamento de execução |
| [Zaask (Portugal)](https://www.zaask.pt/como-funciona) | Gestão integrada do pedido até conclusão | Acompanhamento consistente de status entre cliente, técnico e admin | Avaliação pública antes de decisão do proprietário |
| [Fixando (Portugal)](https://www.fixando.pt/) | Descoberta por serviço e localidade | Categorias/municipalidade claras e perfil detalhado | Replicar modelo de aquisição e cobrança sem análise específica |

## 8. Sequência de execução com definição de pronto

### P0.1 — Gravação e edição reais do cadastro (primeira prioridade)

- [ ] Reproduzir falha em conta autorizada, com dados sintéticos; registrar código seguro de erro sem PII.
- [ ] Confrontar parâmetros/retorno de `eut_publish_my_technician` com contrato **real** no Supabase, inclusive permissões e vínculo de usuário.
- [ ] Criar/editar nome, UF/cidade IBGE, bairro, região, apresentação, especialidades e serviços; reler imediatamente do servidor.
- [ ] Reabrir a área após navegação/logout/login e verificar persistência, inclusive no painel administrativo e na projeção pública elegível.
- [ ] Preservar rascunho se qualquer campo falhar; nunca mostrar sucesso antes de confirmar persistência.
- [ ] Testar falha de conexão, RPC ausente, categoria desativada, sessão expirada, duplicidade, perfil suspenso e privacidade.
- [ ] Passar gates direcionados, CI e homologação autenticada antes de merge/publicação.

### P0.2 — Cadastro completo e sem fragmentação

- [ ] Incluir descoberta/andamento de foto, contato privado e cobertura na mesma jornada do técnico, sem exigir pesquisa manual por abas.
- [ ] Melhorar retomada de cadastro, estado salvo no servidor e feedback por campo.
- [ ] Mostrar ficha incompleta ao técnico e ao administrador com ações de conclusão e sem exposição pública inadequada.

### P1 — Interligação dos três painéis

- [ ] Ações administrativas editam e reconsultam a mesma ficha visível ao técnico; gestão de clientes/pedidos se reflete na área do cliente.
- [ ] Ficha 360° consistente em mobile/desktop, com catálogo, mídia, localidade, contato, histórico e gestão editorial.
- [ ] Fluxos de solicitação e disponibilidade com estados coerentes e auditoria.

### P2 — Vitalidade visual e Home compacta

- [ ] Reduzir altura e redundância da Home; hero com proposta clara, busca por localidade/serviço, dois caminhos (cliente/técnico), provas **reais**, fotos autorizadas e CTA visível.
- [ ] Cards/profissionais reais, hierarquia visual forte, microinterações leves, sem dados inventados, sem bibliotecas pesadas nem sacrificar SSR/LCP/SEO.
- [ ] Testar 390/1440, teclado, foco, contraste e `prefers-reduced-motion`.

**Critério de encerramento do P0:** um técnico real autorizado consegue cadastrar, editar e salvar; os dados sobrevivem a uma nova sessão; o proprietário vê a mesma ficha e pode geri-la; o cliente só vê a projeção permitida. Se isso não foi demonstrado, **não declarar o cadastro finalizado**, mesmo com PR integrada ou Vercel READY.

## 9. Coordenação e limites de evidência

- Este documento consolida **contexto e decisões disponíveis** em 19/11, documentos e código do repositório. **Não equivale à leitura integral de todos os chats**: transcrições indisponíveis devem ser adicionadas com fonte quando surgirem, sem inventar decisões.
- A fila de branches antigas não equivale à fila de PRs abertas. Revisões históricas ficam referenciadas sem bloquear P0; só excluir branches após prova individual de ausência de commits exclusivos e autorização.
- Não abrir outra frente grande até concluir cada micro-rodada de cadastro. Não repetir QA histórico nem criar workflows redundantes.
- Manter status em quatro valores: **relatado**, **verificado em código**, **comprovado em produção**, **pendente**. Toda conclusão deve citar PR, SHA, checks e deployment se houver.
