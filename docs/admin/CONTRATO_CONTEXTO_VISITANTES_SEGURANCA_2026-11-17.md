# Encontre um Técnico — contrato de contexto, visitas, indicações e segurança

Data: 17/11/2026. Estado: **especificação para implantação incremental; não representa serviço ativo**.

## Objetivo confirmado pelo proprietário

O portal deve **antecipar escolhas úteis**, sem inundar o visitante de solicitações.
Uma pessoa anônima pode voltar dias ou meses depois e se tornar cliente ou técnico.
A experiência, os cadastros, os dashboards e a administração devem compartilhar o mesmo
vocabulário de localidade, atribuição, histórico e segurança. A inspiração funcional dos
painéis do *Preciso de Um* e do *Empório Lelecute* é **aditiva**: não substituir a gestão,
os contratos nem as permissões já existentes no Encontre um Técnico.

## 1. Experiência de localização: silenciosa, aproximada e corrigível

1. Na entrada, **sem solicitar GPS**, a aplicação pode obter somente a indicação aproximada
   de município e UF já fornecida pela infraestrutura da requisição (se disponível).
2. Pré-selecionar localidade provável no contexto da busca/cadastro. Identificá-la como
   **sugestão**, nunca como endereço comprovado; não sobrepor escolha salva/confirmada.
3. Validar UF e município no catálogo oficial de municípios (IBGE), de preferência com
   `municipio_ibge_id`. A busca pode receber texto, mas **não gravar nome livre como cidade
   definitiva**: selecionar opção canônica e permitir alterar a seleção.
4. **Um único convite discreto**, cerca de dez segundos *depois* da decisão inicial sobre
   cookies (aceitar, personalizar ou rejeitar): "Encontramos uma região aproximada. Quer
   confirmar seu endereço ou continuar com a região sugerida?". Não abrir popup de GPS;
   oferecer confirmação em cartão discreto, não modal, sem interromper a navegação.
5. O convite deve ser adiável/dispensável, não reaparecer a cada página ou visita e respeitar
   sessão, preferência anterior, navegação e acessibilidade.
6. Endereço preciso **não pode ser deduzido de IP**. Só sugerir logradouro com informação
   adicional fornecida pelo usuário, como CEP, e fonte adequada de endereço; número e
   complemento ficam sujeitos a confirmação. GPS é opcional e nunca pré-requisito.
7. Reutilizar o mesmo componente para visitantes, clientes, técnicos, cadastro, dashboards
   e painel administrativo. Bairro não é inferido de cabeçalhos IP ou do nome da cidade.

## 2. Registro e finalidade: separar quatro classes de evento

| Classe | Finalidade | Campos mínimos ou permitidos | Regra de tratamento |
| --- | --- | --- | --- |
| A. Acesso técnico | Segurança e guarda legal aplicável | IP de origem recebido no servidor, data/hora com fuso UTC, identificador de aplicação, resultado técnico e prazo de guarda | Ambiente restrito; nunca expor em página pública, analytics nem console do navegador; conferir incidência do art. 15 do Marco Civil da Internet |
| B. Segurança e autenticação | Detectar abuso/fraude e investigar incidente | Rota/classe de operação, resultado, conta autenticada quando houver, risco agregado, identificador de correlação; dados de agente de usuário estritamente úteis e justificados | Base legal e prazo próprios, minimização, acesso restrito, justificativa de consulta e auditoria |
| C. Navegação e campanhas opcionais | Medir páginas, funil e eficiência das indicações | UTM validado, página de entrada, origem referenciadora permitida, identificador pseudônimo rotativo, eventos de conversão estritamente definidos | Ativar apenas com fundamento legal adequado e controles específicos de consentimento quando exigidos; respeitar revogação |
| D. Cadastro e relação de serviço | Perfil, pedidos, suporte e vínculo da indicação | IDs internos de cliente/técnico, data do cadastro, convite verificado e histórico de atendimentos autorizados | Contratos e permissões de cada módulo; não converter navegação anônima em dossiê pessoal sem transparência e base legítima |

### Retenção

- O **art. 15 da Lei 12.965/2014** prevê, para provedores de aplicações abrangidos pela
  regra, guarda **por seis meses de registros de acesso à aplicação**, caracterizados no
  art. 5º, VIII, como data/hora de uso a partir de IP. **Não exige** reter cada página
  vista, bateria, torre, deslocamento, endereço exato ou modelo detalhado de aparelho.
- Cada outra classe exige **prazo próprio** documentado conforme necessidade e base legal;
  não aplicar automaticamente seis meses a tudo. Implementar expurgo programado, suspensão
  de expurgo por preservação legal fundamentada, e registro de acesso administrativo.
- Apenas logs estritamente necessários à segurança/obrigação legal operam sem consentimento
  opcional; preferências de publicidade, analytics e personalização permanecem independentes.

### Dispositivos e dados indisponíveis

- Nome da operadora/ISP obtido de IP é **estimativa variável**, não prova da operadora móvel.
- Modelo exato de celular, nível de bateria, intensidade do sinal de torre, células próximas
  e deslocamento entre pontos **não são informações garantidamente disponíveis a sites web**.
  **Não tentar contornar permissões nem criar fingerprint persistente oculto**.
- Não coletar coordenadas, CEP, endereço preciso ou histórico de deslocamento silenciosamente.
  Caso exista uma necessidade futura, exigir finalidade específica, mecanismo explícito e
  avaliação de proporcionalidade/privacidade antes de desenvolver.

## 3. Cookies e contratos: não confundir os aceites

- O botão **Aceitar todos** autoriza somente as **categorias descritas no aviso**; não é
  uma autorização genérica para vigilância ou associação retroativa de todos os acessos.
- A decisão de cookies dispara apenas o relógio do convite de localização; **rejeitar
  cookies opcionais não bloqueia a navegação nem o cadastro**.
- Para criar conta ou entrar em área contratual, apresentar **Termos de Uso** e **Política
  de Privacidade** e registrar versão/data do aceite quando pertinente, sem exigir
  consentimento a publicidade, rastreamento opcional ou fingerprint.
- Permitir revisão, revogação do que depende de consentimento e pedidos do titular.

## 4. Convites e visitantes que depois se cadastram

1. Aceitar convites por URL com token opaco e validade; guardar servidor-side quem convidou,
   papel `cliente` ou `tecnico`, campanha e data, com proteção antiautopromoção/duplicidade.
2. Guardar apenas *referrer* confiável e parâmetros UTM permitidos, higienizados e limitados.
   **Nunca** registrar query strings integrais com tokens de recuperação/sessão ou e-mails.
3. Caso a pessoa concorde com a finalidade aplicável, associar eventos permitidos a uma
   chave pseudônima **rotativa** e com prazo/escopo conhecidos. Sem essa base, manter apenas
   métricas agregadas e os logs técnicos legalmente necessários.
4. No cadastro, registrar a conversão e vincular a indicação válida; só associar histórico
   anterior à identidade quando essa associação for previamente informada, necessária e
   juridicamente autorizada. IP compartilhado, navegador ou operadora **não provam identidade**.
5. A ficha 360° deve distinguir **fatos confirmados**, **sugestões aproximadas**, **eventos
   agregados** e **sinais suspeitos**, sem inventar cronologias de uma pessoa.

## 5. Defesa automatizada: regras por ação, não condenação por IP

- Rate limit **no servidor/edge**, escalonado por rota e risco: login, recuperação de senha,
  envio de código, criação de contas, leitura de contato e requisições de alto custo.
- Como requisitos de configuração inicial, considerar alertas progressivos após
  aproximadamente **5, 10 e 13 falhas relevantes em janela curta**, com bloqueios crescentes
  de **2 h, 5 h, 24 h** para reincidência **comprovada**. Números são parâmetros de política,
  não devem ser aplicados indistintamente a visitas normais nem a toda a plataforma.
- Sinais: velocidade/volume anormais, falhas de autenticação, abuso de contatos, padrões
  automatizados, violações específicas. **VPN, proxy, anonimato, operadora, navegador,
  modelo ou IP compartilhado isoladamente não constituem fraude**.
- Em vez de banimento global precipitado, oferecer `429`/backoff, desafio adaptativo e
  bloqueio limitado ao alvo, com janela de expiração. Prevenir negação de serviço contra
  usuários legítimos do mesmo IP; permitir recuperação/contestação, auditar intervenção.
- O painel exibe incidência, motivo, fonte de evidência, controles de revisão e expiração.
  Nunca exibir telefone privado ou token de autenticação em trilha operacional.

## 6. Painel administrativo: contrato de módulos

| Área | Visão autorizada | Ações administrativas |
| --- | --- | --- |
| Visitas | Agregados por período, canal, município aproximado e tipo de tráfego; **nunca** chamar de "online" sem presença real | Filtrar, comparar e exportar apenas agregados autorizados |
| Acessos técnicos | Logs IP/data/hora sob sigilo, com filtros e motivos registrados | Consulta excepcional por papel competente, auditoria de cada acesso, retenção/expurgo |
| Segurança | Tentativas e alertas, contagem de falhas por rota, desafios e bloqueios temporários | Rever, liberar com justificativa, aplicar prazo e auditar; sem bloquear identidade por heurística isolada |
| Indicações | Convite por cliente/técnico, data, status, campanha e conversão verificável | Ver origem validada, cancelar convite indevido, corrigir atribuição com auditoria |
| Ficha 360° | Histórico **legitimamente associado** à conta, fonte e nível de confiança | Corrigir dados, acesso por papel, ocultar informações sensíveis e atender direitos do titular |
| Preferências | Versão de Termos, consentimentos separados, data e revogação | Ver comprovação, sem forçar novos consentimentos em nome do usuário |

Requisitos transversais: autorização no servidor, RLS adequado, contatos privados protegidos,
paginação, filtros e ordenação, consultas eficientes, acesso móvel 390px/desktop 1440px,
trilha de auditoria e papéis atuais preservados. **Não colocar dados sensíveis em `localStorage`,
logs do navegador, HTML SSR ou mensagens do CI.**

## 7. Estado comprovado na main e etapas para implantar

Auditado no código de `main` `7f7f084b` em 17/11/2026:

- **Existe:** `useRegionalSuggestion` + cabeçalhos Vercel por IP e cache de sessão de 6 h;
  Home e funil usam a sugestão, mas ainda há campos de município livre em alguns fluxos.
- **Existe:** banner de cookies com aceitar/rejeitar/personalizar, consentimento analítico;
  buscas agregadas em `search_events` e seção administrativa de **buscas consentidas**.
- **Existe:** `CustomerLocationButton` com opção GPS (dependente de autorização), que deve
  ficar **secundária e opcional**, sem ser o principal caminho para localizar a pessoa.
- **Não comprovado:** identificação individual persistente de visitante, vínculo histórico
  com contas, logs de acesso de seis meses, origem de convites auditável de ponta a ponta,
  WAF/limites progressivos efetivamente configurados, nova ficha 360° de visitantes.
  **Não anunciar como implantados.**

### Micro-rodadas de entrega — cada uma com PR, testes e homologação independentes

1. **Localidade e UX**: catálogo IBGE canônico para escolhas; sugestão IP e convite único
   após 10 s da decisão de cookies. Corrigir o funil da PR #311 antes do merge e reutilizar
   nos cadastros/dashboards. Não apagar capacidade opcional de localização já presente.
2. **Origem de campanha e indicação**: tokens de convite e eventos de conversão, sem
   associar terceiros por IP. Contratos e testes; persistência só após aprovação de schema.
3. **Logs mínimos e retenção**: desenho de tabela privada, segregação de finalidade,
   auditoria de leitura, política de expurgo, permissões e plano de verificação.
   **Migration/DDL Supabase requer autorização específica**, sem mexer em RLS existente.
4. **Proteção e resposta a abuso**: obter inventário do edge/firewall atual e criar
   limites progressivos proporcionais; testar falso positivo e retorno ao acesso normal.
5. **Admin 360° e dashboards**: novas visões por papel apenas quando os dados reais
   autorizados estiverem disponíveis; não criar demonstrações que aparentem fatos reais.

### Condições de homologação

- 390 e 1440 px; sem popup compulsório/GPS na primeira visita, e convite somente no momento
  prometido; o visitante consegue continuar caso rejeite analytics.
- Município/UF reais do catálogo; sem cidade livre persistida; região aproximada claramente
  marcada; endereço exato somente após fornecimento/confirmação do titular.
- Captura de convite/UTM sem vazamento de parâmetros sensíveis; reentrada de visitante
  sem atribuição falsa; sessão anônima sem associação indevida a pessoa identificada.
- Segurança resistindo a repetição abusiva, com desbloqueio e sem punir usuários legítimos
  por IP, VPN, browser ou ISP; administração auditada e RLS preservados.
- Política pública e bases legais revisadas **antes da ativação de nova coleta**; sem
  pagamentos, dados, dois contatos suspensos, DNS ou produção alterados por acidente.

## 8. Fontes normativas de referência

- [Lei 12.965/2014 — Marco Civil da Internet, arts. 5º, 15 e 16](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm)
- [ANPD — Guia orientativo de Cookies e Proteção de Dados Pessoais](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf)
- [ANPD — Segurança da Informação para Agentes de Tratamento de Pequeno Porte](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/processo-guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte.pdf)

Este documento registra o escopo do produto e guardrails técnicos; não substitui parecer
jurídico específico nem autoriza captura oculta de informações do aparelho.
