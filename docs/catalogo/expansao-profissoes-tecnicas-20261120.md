# Proposta auditável de ampliação das especialidades técnicas

Data: 20/11/2026. **Proposta não ativada**; este documento não altera o banco, a interface pública nem cadastros.

## Fonte de verdade e limites

- Catálogo oficial verificado por leitura no Supabase dedicado: **10 categorias e 25 serviços ativos**, com RLS habilitada. O Wizard e a página `/servicos` leem esse catálogo; a administração já dispõe de formulários de criação, sem exigir nova infraestrutura.
- Preservar integralmente os 10 slugs atuais (`computadores`, `software`, `redes`, `impressoras`, `cftv`, `automacao`, `eletrica`, `climatizacao`, `comunicacoes`, `design-grafico`) e seus 25 serviços. Nenhuma conversão, substituição, exclusão ou alteração de perfis existentes.
- **Categoria** = família de atendimento; **serviço** = trabalho que o técnico declara executar; **profissão/formação** = informação diferente, declarada pelo profissional e nunca presumida por seleção. Não declarar que a plataforma certificou cursos, CREA/CFT, licença de rádio, NR-10 ou outras habilitações.
- Os nomes abaixo foram deduplicados contra os slugs oficiais ativos, usando a mesma normalização do painel (`serviceSlug`). O slug do painel é derivado do nome; não editar slugs existentes.
- A inclusão futura é uma operação **administrativa auditada**, item a item, na seção `/admin/catalogo`, em sessão autorizada. Não aplicar SQL, não rodar importação nem publicar alterações somente com base nesta proposta.

## Novas famílias e serviços propostos

Cada título é o nome pretendido no formulário administrativo; o identificador entre parênteses é o slug calculado. A descrição poderá ser colada no campo do painel. Os serviços são exemplos de atuação, não anúncio de profissionais existentes.

### 1. Celulares e tablets (`celulares-e-tablets`)

Diagnóstico, manutenção de aparelhos móveis e recuperação de funcionamento, conforme escopo declarado.

- Troca de tela de celular (`troca-de-tela-de-celular`)
- Troca de bateria de celular (`troca-de-bateria-de-celular`)
- Reparo de conector de carga de celular (`reparo-de-conector-de-carga-de-celular`)
- Diagnóstico de placa de celular (`diagnostico-de-placa-de-celular`)
- Manutenção de tablet (`manutencao-de-tablet`)
- Transferência assistida de dados de celular (`transferencia-assistida-de-dados-de-celular`)

### 2. Televisores e vídeo (`televisores-e-video`)

Manutenção de televisores, projetores e equipamentos de exibição de imagem.

- Diagnóstico de TV LED ou OLED (`diagnostico-de-tv-led-ou-oled`)
- Reparo de iluminação de TV (`reparo-de-iluminacao-de-tv`)
- Reparo de placa de TV (`reparo-de-placa-de-tv`)
- Reparo de entrada HDMI de TV (`reparo-de-entrada-hdmi-de-tv`)
- Configuração de TV inteligente (`configuracao-de-tv-inteligente`)
- Manutenção de projetor de vídeo (`manutencao-de-projetor-de-video`)

### 3. Áudio e rádio (`audio-e-radio`)

Diagnóstico e reparo de equipamentos de áudio e recepção de rádio, sem presumir licença de transmissão.

- Manutenção de rádio AM ou FM (`manutencao-de-radio-am-ou-fm`)
- Reparo de amplificador de áudio (`reparo-de-amplificador-de-audio`)
- Reparo de caixa de som (`reparo-de-caixa-de-som`)
- Reparo de mesa de som (`reparo-de-mesa-de-som`)
- Reparo de home theater (`reparo-de-home-theater`)
- Diagnóstico de equipamento de radiocomunicação (`diagnostico-de-equipamento-de-radiocomunicacao`)

### 4. Eletrônica e circuitos (`eletronica-e-circuitos`)

Reparo de circuitos, fontes, sensores e placas eletrônicas em bancada.

- Diagnóstico de placa eletrônica (`diagnostico-de-placa-eletronica`)
- Microssolda de componentes eletrônicos (`microssolda-de-componentes-eletronicos`)
- Reparo de fonte chaveada (`reparo-de-fonte-chaveada`)
- Teste de componentes eletrônicos (`teste-de-componentes-eletronicos`)
- Reparo de circuito de controle (`reparo-de-circuito-de-controle`)
- Diagnóstico de sensor eletrônico (`diagnostico-de-sensor-eletronico`)

### 5. Videogames e consoles (`videogames-e-consoles`)

Reparo e manutenção de consoles, controles e acessórios eletrônicos de jogos.

- Diagnóstico de console de videogame (`diagnostico-de-console-de-videogame`)
- Reparo de HDMI de console (`reparo-de-hdmi-de-console`)
- Manutenção térmica de videogame (`manutencao-termica-de-videogame`)
- Reparo de controle de videogame (`reparo-de-controle-de-videogame`)
- Reparo de placa de console (`reparo-de-placa-de-console`)

### 6. Antenas e recepção (`antenas-e-recepcao`)

Instalação e manutenção de antenas e sistemas de recepção de sinais.

- Instalação de antena digital de TV (`instalacao-de-antena-digital-de-tv`)
- Ajuste de recepção de televisão (`ajuste-de-recepcao-de-televisao`)
- Manutenção de antena de rádio (`manutencao-de-antena-de-radio`)
- Configuração de receptor de TV (`configuracao-de-receptor-de-tv`)
- Instalação de cabeamento coaxial (`instalacao-de-cabeamento-coaxial`)

### 7. Eletrodomésticos (`eletrodomesticos`)

Diagnóstico e manutenção de aparelhos domésticos, respeitando riscos elétricos e de alta tensão.

- Diagnóstico de forno de micro-ondas (`diagnostico-de-forno-de-micro-ondas`)
- Reparo de máquina de lavar roupas (`reparo-de-maquina-de-lavar-roupas`)
- Manutenção de lava e seca (`manutencao-de-lava-e-seca`)
- Reparo de forno elétrico doméstico (`reparo-de-forno-eletrico-domestico`)
- Reparo de cafeteira elétrica (`reparo-de-cafeteira-eletrica`)
- Manutenção de aspirador de pó (`manutencao-de-aspirador-de-po`)

### 8. Refrigeração (`refrigeracao`)

Manutenção de refrigeradores e sistemas de refrigeração doméstica e comercial.

- Manutenção de geladeira (`manutencao-de-geladeira`)
- Reparo de freezer (`reparo-de-freezer`)
- Manutenção de câmara fria (`manutencao-de-camara-fria`)
- Diagnóstico de bebedouro refrigerado (`diagnostico-de-bebedouro-refrigerado`)
- Reparo de expositor refrigerado (`reparo-de-expositor-refrigerado`)

### 9. Nobreaks e energia de reserva (`nobreaks-e-energia-de-reserva`)

Diagnóstico e manutenção de proteção e alimentação de energia para equipamentos.

- Diagnóstico de nobreak (`diagnostico-de-nobreak`)
- Substituição de bateria de nobreak (`substituicao-de-bateria-de-nobreak`)
- Manutenção de estabilizador de tensão (`manutencao-de-estabilizador-de-tensao`)
- Reparo de carregador de bateria (`reparo-de-carregador-de-bateria`)
- Diagnóstico de inversor de energia (`diagnostico-de-inversor-de-energia`)

### 10. Energia solar (`energia-solar`)

Serviços técnicos de sistemas fotovoltaicos, exigindo habilitação conforme atividade.

- Instalação de sistema fotovoltaico (`instalacao-de-sistema-fotovoltaico`)
- Manutenção de inversor solar (`manutencao-de-inversor-solar`)
- Monitoramento de geração fotovoltaica (`monitoramento-de-geracao-fotovoltaica`)
- Inspeção elétrica de sistema solar (`inspecao-eletrica-de-sistema-solar`)
- Diagnóstico de módulo fotovoltaico (`diagnostico-de-modulo-fotovoltaico`)

### 11. Eletromecânica (`eletromecanica`)

Manutenção de motores, bombas, ferramentas e equipamentos com partes elétricas e mecânicas.

- Manutenção de motor elétrico (`manutencao-de-motor-eletrico`)
- Diagnóstico de bomba elétrica (`diagnostico-de-bomba-eletrica`)
- Reparo de ferramenta elétrica (`reparo-de-ferramenta-eletrica`)
- Manutenção de portão automático (`manutencao-de-portao-automatico`)
- Manutenção de compressor de ar (`manutencao-de-compressor-de-ar`)

### 12. Automação industrial (`automacao-industrial`)

Diagnóstico e manutenção de comandos, controladores e sensores industriais.

- Diagnóstico de CLP industrial (`diagnostico-de-clp-industrial`)
- Manutenção de sensor industrial (`manutencao-de-sensor-industrial`)
- Configuração de inversor de frequência (`configuracao-de-inversor-de-frequencia`)
- Diagnóstico de painel de comando industrial (`diagnostico-de-painel-de-comando-industrial`)
- Manutenção de circuito de automação industrial (`manutencao-de-circuito-de-automacao-industrial`)

### 13. Equipamentos comerciais (`equipamentos-comerciais`)

Manutenção de dispositivos e máquinas utilizados no comércio e em serviços.

- Manutenção de balança comercial (`manutencao-de-balanca-comercial`)
- Reparo de leitor de código de barras (`reparo-de-leitor-de-codigo-de-barras`)
- Diagnóstico de terminal de ponto de venda (`diagnostico-de-terminal-de-ponto-de-venda`)
- Reparo de equipamento de cozinha profissional (`reparo-de-equipamento-de-cozinha-profissional`)
- Manutenção de máquina seladora (`manutencao-de-maquina-seladora`)

### 14. Eletrônica automotiva (`eletronica-automotiva`)

Diagnóstico de circuitos e acessórios eletrônicos veiculares, sem implicar serviços mecânicos gerais.

- Diagnóstico eletrônico automotivo (`diagnostico-eletronico-automotivo`)
- Reparo de módulo eletrônico veicular (`reparo-de-modulo-eletronico-veicular`)
- Instalação de câmera de ré (`instalacao-de-camera-de-re`)
- Instalação de central multimídia veicular (`instalacao-de-central-multimidia-veicular`)
- Diagnóstico de sensor automotivo (`diagnostico-de-sensor-automotivo`)

### 15. Fotografia e drones (`fotografia-e-drones`)

Reparo de equipamentos de captura de imagem e acessórios eletroeletrônicos.

- Reparo de câmera fotográfica (`reparo-de-camera-fotografica`)
- Diagnóstico de lente fotográfica (`diagnostico-de-lente-fotografica`)
- Diagnóstico técnico de drone (`diagnostico-tecnico-de-drone`)
- Reparo de estabilizador de câmera (`reparo-de-estabilizador-de-camera`)
- Configuração de equipamento de vídeo (`configuracao-de-equipamento-de-video`)

## Ampliações sem abrir categorias duplicadas

As dez categorias já publicadas devem receber especializações adicionais pela mesma ferramenta administrativa, após revisão individual, por exemplo:

| Categoria atual | Serviços para avaliação |
| --- | --- |
| Computadores e notebooks | Recuperação de dados de computador; diagnóstico de placa-mãe de notebook; manutenção de servidor; upgrade de memória e SSD |
| Sistemas e software | Suporte remoto de software; migração de sistema operacional; configuração de backup criptografado; recuperação de sistema operacional |
| Redes e conectividade | Diagnóstico de rede corporativa; configuração de firewall; instalação de ponto de acesso; certificação de cabeamento estruturado |
| Impressoras | Manutenção de impressora térmica; reparo de impressora laser; diagnóstico de scanner |
| Câmeras e segurança eletrônica | Manutenção de sistema CFTV; instalação de controle de acesso; configuração de vídeo porteiro |
| Automação | Integração de dispositivos inteligentes; configuração de sensores residenciais; manutenção de central de automação |
| Elétrica | Diagnóstico de quadro elétrico; instalação de circuito dedicado; inspeção elétrica residencial |
| Climatização | Higienização de ar-condicionado; diagnóstico de ar-condicionado inverter; manutenção de ventilação |
| Comunicações e telefonia | Configuração de PABX IP; manutenção de interfone; instalação de infraestrutura de telecomunicações |
| Serviços gráficos | Preparação de arquivo para impressão; manutenção de fluxo de produção gráfica (rever aderência do serviço à categoria) |

Essas sugestões não estão deduplicadas nem aprovadas para inserção; revisar termos técnicos, escopo e demanda antes do cadastro. A manutenção dos registros atuais tem prioridade.

## Identificação profissional sem credenciais inventadas

- No Wizard, mostrar **família** e **serviços executados**; em etapa própria, permitir ao profissional descrever conhecimentos: diagnóstico de placas, solda SMD/BGA, redes TCP/IP, eletrônica analógica/digital, medições elétricas, sistemas embarcados, CLP, refrigeração, Linux, Windows, reparo de dispositivos móveis etc.
- Formação: técnico em eletrônica, eletrotécnica, informática, telecomunicações, automação industrial, eletromecânica, refrigeração, mecatrônica e cursos específicos — **somente quando declarado pelo titular**. Certificações, registros e autorizações não devem aparecer como “verificados” sem procedimento de validação real.
- Equipamentos, marcas e modelos atendidos podem ser informados em texto próprio, sem atribuir assistência autorizada a uma marca.
- Um profissional pode oferecer serviços de famílias distintas; não inferir atividades a partir do nome da profissão.

## Regras de SEO e experiência

1. `/servicos` exibe **apenas categorias e serviços realmente ativos** no catálogo oficial; filtros de `/tecnicos` sempre devem usar slugs válidos. Não criar resultados falsos nem contas fictícias.
2. Páginas editoriais indexáveis em `/servicos/{categoria}` só devem entrar no sitemap após conteúdo próprio substancial: o que abrange, defeitos frequentes, avaliação antes de contratar, segurança/limites técnicos, FAQ exclusivo, links entre categorias de fato relacionadas e revisão de linguagem.
3. Nas famílias **Celulares e tablets**, **Televisores e vídeo**, **Áudio e rádio** e **Eletrônica e circuitos**, priorizar guias específicos sobre sintomas, tipos de equipamento, prevenção de perda de dados, riscos de choque e perguntas úteis ao profissional. Não prometer preço, conserto ou disponibilidade.
4. SEO local por município deve apoiar-se em municípios oficiais e profissionais realmente publicados; não gerar páginas vazias nem schema.org de avaliação, presença, preço ou certificação não comprovados. Canônicos, robots, breadcrumbs e JSON-LD não podem expor telefones privados.
5. A busca deve oferecer termos equivalentes (ex.: “TV/televisão”, “celular/smartphone”, “computador/PC”, “rádio/transceptor”) **sem transformar sinônimo em serviço fictício**. Verificar compatibilidade com a PR #376 antes de alterar o Wizard.

## Ativação futura em micro-rodadas

1. **Revalidar** sessão administrativa, inventário ativo, políticas de criação, slugs e dependências (não repetir QA histórico). Confirmar escopo do primeiro grupo de inclusão.
2. Cadastrar **uma família por vez**, conferir a linha realmente retornada e seus serviços no painel, revisar RLS e testar leitura pública sem perfis falsos. Não alterar cadastros de terceiros, contatos privados nem contas suspensas.
3. Preparar e validar o conteúdo editorial daquela família em PR própria antes de tornar rota enriquecida indexável. CI, merge e release conforme gates e autorização vigentes.
4. Documentar novas famílias/serviços efetivamente ativados e descartar propostas sem demanda. Nenhuma mudança automática em DNS, pagamentos, OTP, Supabase SQL ou produção.

**Status desta proposta:** 15 famílias novas e 80 serviços candidatos; **zero registros inseridos, zero SQL de escrita, zero deploy**.
