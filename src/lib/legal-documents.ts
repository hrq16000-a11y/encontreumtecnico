export type LegalDocumentKey = "termos" | "privacidade" | "cookies" | "pagamentos" | "prestadores" | "responsabilidades" | "seguranca" | "direitos";
export type LegalDocumentData = {
  title: string;
  description: string;
  intro: string;
  sections: Array<{ title: string; paragraphs: string[] }>;
};
export const LEGAL_UPDATED_AT = "9 de novembro de 2026";
export const legalDocuments: Record<LegalDocumentKey, LegalDocumentData> = {
  "termos": {
    "title": "Termos e condições de uso",
    "description": "Condições de cadastro livre, busca e acesso remunerado a contatos no Encontre um Técnico.",
    "intro": "Leia antes de criar uma conta, publicar um perfil ou adquirir acesso ao contato de um prestador.",
    "sections": [
      {
        "title": "1. Natureza do serviço",
        "paragraphs": [
          "O Encontre um Técnico oferece um diretório digital, ferramentas de busca e conveniência para aproximar pessoas que procuram serviços de profissionais que se cadastram livremente. O portal não executa os serviços anunciados e não define orçamento, preço de mão de obra, prazo ou forma de pagamento negociados pelas partes.",
          "A busca e o cadastro podem ser gratuitos. O acesso a dados privados de contato pode exigir o pagamento da conveniência informado antes da contratação."
        ]
      },
      {
        "title": "2. Participação livre e cadastro",
        "paragraphs": [
          "A participação é voluntária. Técnicos não pagam cadastro, mensalidade nem taxa para manter um perfil no portal. O usuário deve fornecer informações verdadeiras, manter seus dados atualizados e preservar suas credenciais.",
          "O cadastro é livre e a exibição pública depende de requisitos objetivos de completude, segurança e disponibilidade técnica da plataforma. A publicação não significa verificação, certificação, recomendação técnica ou avaliação da qualidade do prestador."
        ]
      },
      {
        "title": "3. Acesso ao contato e valores",
        "paragraphs": [
          "O cliente paga pelo serviço digital de conveniência e liberação controlada de contato, não pela execução de trabalho técnico. A regra comercial prevista é R$ 9,99 no horário das 9h às 18h e R$ 29,99 fora dessa janela, segundo o horário indicado na oferta e na confirmação do pagamento.",
          "Cada compra permite acessar um contato principal, podendo existir até dois contatos no mesmo dia quando essa possibilidade for expressamente indicada na oferta e estiver disponível. A quantidade efetivamente adquirida, eventuais limites e o preço total devem aparecer antes do pagamento. Não há promessa de contratação ou de atendimento."
        ]
      },
      {
        "title": "4. Relação direta entre as partes",
        "paragraphs": [
          "O cliente decide com quem conversar e negocia diretamente com o prestador, que decide se aceita o serviço. Orçamentos, visita, execução, garantias da atividade profissional e eventual pagamento ao técnico são combinados entre as partes, fora da cobrança de conveniência do portal.",
          "O portal não faz leilão de menor preço, não impõe preços a prestadores e não cobra comissão pela contratação direta. Permanece responsável pelos deveres legais relativos ao próprio serviço digital, inclusive informação clara, proteção de dados e atendimento a reclamações cabíveis."
        ]
      },
      {
        "title": "5. Segurança, conduta e visibilidade",
        "paragraphs": [
          "É proibido usar a plataforma para fraude, intimidação, spam, revenda ou raspagem de contatos, coleta automatizada não autorizada, perfis falsos e divulgação de conteúdo ilícito. A plataforma pode limitar, ocultar ou suspender cadastros por motivos operacionais e de segurança, sem afirmar que verificou a habilitação profissional.",
          "Indicadores como disponibilidade declarada, perfil completo, localização informada, participação e convites podem influenciar a ordem de exibição quando implementados, sem garantia de classificação ou de contratação. Atividade online declarada não garante resposta imediata."
        ]
      },
      {
        "title": "6. Suporte e ausência de prestadores",
        "paragraphs": [
          "Na ausência de profissional listado na região, clientes que tenham adquirido acesso poderão solicitar auxílio da equipe para encontrar alternativas. Esse apoio não representa garantia de que será encontrado um prestador nem transferência da negociação ao portal.",
          "Dúvidas cadastrais, privacidade, exercício de direitos legais e reclamações sobre o próprio serviço digital podem ser encaminhadas à página Contato, sem exigir pagamento."
        ]
      },
      {
        "title": "7. Pagamentos, cancelamento e direitos",
        "paragraphs": [
          "Os valores, limites, comprovantes, hipóteses de falha de entrega, cancelamento e reembolso são detalhados na Política de pagamentos e reembolsos. Nenhuma disposição destes termos exclui direitos previstos no Código de Defesa do Consumidor ou outras normas aplicáveis.",
          "A plataforma poderá atualizar as condições, com indicação da versão publicada e comunicação adequada quando as mudanças afetarem direitos ou contratos em andamento."
        ]
      }
    ]
  },
  "privacidade": {
    "title": "Política de privacidade",
    "description": "Dados pessoais, localização, cadastro, migração WordPress e direitos de titulares no Encontre um Técnico.",
    "intro": "Explicamos que informações podem ser tratadas, para quê, com quem são compartilhadas e como exercer seus direitos.",
    "sections": [
      {
        "title": "1. Responsável e contato",
        "paragraphs": [
          "O Encontre um Técnico é o serviço digital ao qual esta política se aplica. O canal para solicitações de privacidade e informações sobre a identificação do operador é dpo@encontreumtecnico.com, também disponível na página Contato. A identificação empresarial completa deve ser confirmada e publicada antes da ativação comercial de pagamentos.",
          "Esta política é específica do domínio encontreumtecnico.com e não deve ser confundida com políticas de outras marcas ou portais."
        ]
      },
      {
        "title": "2. Dados tratados",
        "paragraphs": [
          "Conforme o uso, poderão ser tratados nome, e-mail, identificador da conta, dados de autenticação administrados pelo provedor, cidade, UF, bairro, regiões atendidas, categorias e serviços declarados, apresentação profissional, foto enviada, dados de solicitações, registros de contato, prevenção a abuso e histórico de atendimento.",
          "Na contratação da conveniência, poderão ser tratados identificadores da transação, situação do pagamento, comprovantes e histórico de acessos liberados. Dados completos de cartão devem ser tratados pelo provedor de pagamento habilitado, e não expostos nos perfis.",
          "A geolocalização precisa, se utilizada, deverá depender da permissão do dispositivo; endereço IP e sinais técnicos podem servir a segurança, localização aproximada e controle de fraude, quando necessários."
        ]
      },
      {
        "title": "3. Finalidades e bases legais",
        "paragraphs": [
          "Os dados são usados para cadastro e autenticação, publicação de informações profissionais escolhidas pelo titular, busca por região e serviço, triagem de solicitações, controle do acesso pago, atendimento de solicitações, prevenção de fraudes, exercício de direitos e cumprimento de obrigações legais.",
          "O tratamento observa as hipóteses legais cabíveis da LGPD, como execução de contrato, cumprimento de obrigação legal, exercício regular de direitos, legítimo interesse quando aplicável e consentimento específico quando exigido. O simples acesso ao site não significa consentimento irrestrito para todos os usos."
        ]
      },
      {
        "title": "4. Visibilidade de dados e contatos",
        "paragraphs": [
          "Informações de perfil profissional destinadas à divulgação podem ficar públicas conforme a configuração de visibilidade do sistema. Telefone e dados de contato privados não devem ser expostos livremente; sua liberação ao cliente exige as condições de acesso da plataforma.",
          "O cliente que recebe um contato deve utilizá-lo apenas para a finalidade declarada, sem revendê-lo ou compartilhá-lo de maneira abusiva. O técnico é responsável pelo que escolhe informar no perfil e pode solicitar correções."
        ]
      },
      {
        "title": "5. Migração do WordPress",
        "paragraphs": [
          "Registros anteriormente cadastrados no WordPress podem ser preservados em área de migração protegida para continuidade do serviço e associação de contas. A existência de um registro antigo não significa que sua titularidade foi comprovada ou que o perfil esteja ativo.",
          "A associação de conta antiga deve usar comprovação de identidade, sem reutilizar senhas antigas; dados e fotos que não estejam prontos para publicação permanecem sujeitos a revisão de integridade, minimização e segurança."
        ]
      },
      {
        "title": "6. Compartilhamento e operadores",
        "paragraphs": [
          "Serviços técnicos de hospedagem, banco de dados, autenticação, análises autorizadas e processamento de pagamento poderão atuar como operadores de dados conforme a sua função, com acesso restrito ao necessário. Contatos são compartilhados com clientes apenas nas condições comunicadas na aquisição.",
          "Não comercializamos uma base irrestrita de contatos de prestadores. Eventuais transferências internacionais ligadas à infraestrutura devem observar as exigências aplicáveis da LGPD."
        ]
      },
      {
        "title": "7. Segurança, armazenamento e retenção",
        "paragraphs": [
          "Empregamos controles de acesso e medidas proporcionais de segurança. Nenhum sistema é completamente imune a incidentes; ocorrências serão avaliadas e comunicadas quando exigido pela legislação.",
          "Os dados são mantidos pelo tempo necessário às finalidades informadas e às obrigações legais, incluindo registros que precisem ser conservados por motivos de segurança, prova de transação ou atendimento de direitos. Encerramento de conta não exige eliminação imediata de dados sujeitos a guarda legal."
        ]
      },
      {
        "title": "8. Direitos dos titulares",
        "paragraphs": [
          "Você pode solicitar confirmação de tratamento, acesso, correção, informações sobre compartilhamento, portabilidade quando aplicável, anonimização, bloqueio ou eliminação de dados excessivos e demais direitos previstos no art. 18 da LGPD, observadas as hipóteses legais.",
          "Para solicitar seus direitos, utilize dpo@encontreumtecnico.com ou a página Contato. Podemos pedir comprovação de identidade para não entregar dados a terceiros. Pedidos sobre o uso de cookies podem ser tratados nas preferências de cookies."
        ]
      },
      {
        "title": "9. Crianças e terceiros",
        "paragraphs": [
          "O serviço de contratação e oferta profissional é destinado a pessoas capazes de assumir essas relações. Não é destinado ao uso autônomo de crianças. Qualquer tratamento envolvendo menores deve observar a legislação aplicável, o melhor interesse e as salvaguardas exigidas.",
          "Sites, mensageiros e serviços de terceiros possuem políticas próprias. O envio voluntário de dados por canais externos após o acesso ao contato passa a envolver diretamente as pessoas e empresas que recebem esses dados."
        ]
      },
      {
        "title": "10. Alterações",
        "paragraphs": [
          "Esta versão substitui textos antigos que apontavam para outros domínios ou responsáveis não confirmados deste portal. Mudanças materiais serão divulgadas de maneira adequada, sem suprimir direitos adquiridos ou garantias legais."
        ]
      }
    ]
  },
  "cookies": {
    "title": "Política de cookies",
    "description": "Conheça os cookies e suas preferências de privacidade no Encontre um Técnico.",
    "intro": "Você pode aceitar ou rejeitar cookies opcionais e voltar às preferências a qualquer momento.",
    "sections": [
      {
        "title": "1. O que são cookies",
        "paragraphs": [
          "Cookies e recursos semelhantes permitem guardar escolhas no navegador, reconhecer sessões, preservar preferências e, quando autorizado, produzir análises agregadas de navegação."
        ]
      },
      {
        "title": "2. Categorias",
        "paragraphs": [
          "Necessários: essenciais para segurança, sessão, funcionamento de áreas autenticadas e registro das escolhas de privacidade. Não dependem de consentimento quando estritamente necessários.",
          "Funcionais: lembram configurações opcionais e podem melhorar o uso do portal. Analíticos: podem medir o uso agregado e a eficácia das páginas; somente devem ser ativados quando houver base legal válida e, quando necessário, consentimento."
        ]
      },
      {
        "title": "3. Escolhas e revogação",
        "paragraphs": [
          "O aviso de cookies permite rejeitar opcionais, aceitar todos ou personalizar categorias. A escolha é gravada localmente no navegador e pode ser alterada pela opção Preferências de cookies no rodapé.",
          "Rejeitar cookies opcionais não impede o uso das funções essenciais. As integrações de terceiros que dependerem de consentimento devem respeitar as preferências registradas; sua presença e finalidade precisam ser avaliadas antes da ativação."
        ]
      },
      {
        "title": "4. Serviços de terceiros",
        "paragraphs": [
          "Autenticação, hospedagem, conteúdo incorporado ou ferramentas de medição podem utilizar tecnologias próprias. Caso haja integrações opcionais, suas finalidades e provedores devem ser comunicados antes do tratamento correspondente. A política não autoriza coleta irrestrita por terceiros."
        ]
      },
      {
        "title": "5. Controle no dispositivo",
        "paragraphs": [
          "Além das preferências do portal, você pode bloquear ou apagar cookies pelo navegador. Bloquear dados de sessão necessários pode impedir login e algumas funcionalidades.",
          "Dúvidas ou solicitações relacionadas a privacidade podem ser enviadas à página Contato ou ao canal indicado na Política de privacidade."
        ]
      }
    ]
  },
  "pagamentos": {
    "title": "Pagamentos, cancelamentos e reembolsos",
    "description": "Valores de acesso ao contato, limites de liberação, falhas, arrependimento e reembolsos.",
    "intro": "O valor informado é pago pelo serviço digital de conveniência e acesso ao contato, não pela execução do trabalho técnico.",
    "sections": [
      {
        "title": "1. Valores e horário",
        "paragraphs": [
          "A oferta prevista é de R$ 9,99 das 9h às 18h e R$ 29,99 fora do horário comercial. O horário de referência, o preço total e a regra exata do período devem constar da oferta/checkout antes de o cliente confirmar o pagamento. Não há mensalidade ou taxa cobrada do prestador.",
          "Ainda que o valor seja descrito como simbólico ou de conveniência, é um preço cobrado do cliente pelo serviço digital e deve ser tratado com transparência."
        ]
      },
      {
        "title": "2. O que é adquirido",
        "paragraphs": [
          "Uma aquisição dá direito ao contato principal informado na oferta. Se o produto permitir um segundo contato, esse benefício, a disponibilidade e a limitação máxima de até dois contatos no mesmo dia deverão ser explicitados antes de pagar. Não existe acesso ilimitado, direito a extração da base ou revenda dos números.",
          "O pagamento não contrata o profissional, não inclui visita, mão de obra, peças ou deslocamento e não assegura retorno da pessoa contatada. Essas condições são negociadas diretamente entre cliente e prestador."
        ]
      },
      {
        "title": "3. Confirmação e proteção",
        "paragraphs": [
          "Antes de efetuar o pagamento, o cliente deve visualizar resumo claro com valor, horário aplicável, quantidade de contatos, identificação do fornecedor, limitações, meios de suporte e condições de cancelamento. A confirmação e o comprovante devem poder ser consultados pelo cliente.",
          "A entrega do contato depende de transação confirmada por meio seguro. O portal deve evitar liberações duplicadas, acesso anônimo e exposição pública dos números."
        ]
      },
      {
        "title": "4. Falha na entrega ou cobrança incorreta",
        "paragraphs": [
          "Se houver pagamento confirmado sem a disponibilização do benefício adquirido, cobrança em duplicidade, valor divergente ou outro defeito do serviço digital, o cliente poderá solicitar análise, correção ou reembolso pelos canais de atendimento. A plataforma avaliará o problema e dará solução conforme a legislação aplicável."
        ]
      },
      {
        "title": "5. Arrependimento e cancelamento",
        "paragraphs": [
          "Nas contratações online de consumo aplicam-se os direitos previstos no Código de Defesa do Consumidor, inclusive o direito de arrependimento quando cabível. A existência de liberação digital imediata não implica, por si só, renúncia automática a direitos legais.",
          "Pedidos de cancelamento e reembolso poderão ser encaminhados pela página Contato, com a identificação da transação. Não serão impostas renúncias genéricas à proteção legal do consumidor."
        ]
      },
      {
        "title": "6. Atendimento e ausência de técnicos",
        "paragraphs": [
          "Quando não houver profissional na região, o cliente que tenha adquirido um acesso pode solicitar auxílio na busca de alternativas dentro das condições comunicadas. Esse auxílio não garante encontrar alguém nem altera os direitos relacionados a defeitos do serviço digital.",
          "Pedidos de privacidade, informações sobre cobrança e reclamações sobre o próprio serviço da plataforma não ficam condicionados ao pagamento para serem recebidos."
        ]
      }
    ]
  },
  "prestadores": {
    "title": "Condições para prestadores",
    "description": "Cadastro gratuito, responsabilidade pelos dados e regras de visibilidade dos profissionais.",
    "intro": "O técnico pode se cadastrar livremente, sem pagar para participar da rede.",
    "sections": [
      {
        "title": "1. Participação gratuita",
        "paragraphs": [
          "Não há cobrança de cadastro, mensalidade, comissão por negociação direta ou taxa de manutenção do perfil ao técnico. Participar é opcional; o profissional pode encerrar a participação nos termos da legislação e das condições da plataforma."
        ]
      },
      {
        "title": "2. Cadastro livre e autoexibição",
        "paragraphs": [
          "A plataforma não avalia habilitação técnica, certificações, qualidade, preços ou histórico profissional antes da divulgação como uma chancela de confiança. Os dados são fornecidos pelo próprio prestador, que responde por sua veracidade e atualização.",
          "A entrada no diretório poderá ser automática após requisitos objetivos de completude e segurança. O portal poderá ocultar cadastros incompletos, suspeitos, inativos ou que violem as regras, sem que a exposição pública signifique validação profissional."
        ]
      },
      {
        "title": "3. Local de atendimento, especialidades e contato",
        "paragraphs": [
          "O prestador informa serviços efetivamente realizados, UF, município, bairros e regiões de atendimento, disponibilidade e contato próprio. Não deve indicar habilidades, certificações ou áreas de cobertura falsas.",
          "O número não deve ficar em páginas públicas de livre extração. Sua liberação controlada ao cliente seguirá as condições de acesso do portal, com medidas para reduzir spam e uso indevido."
        ]
      },
      {
        "title": "4. Missões, participação e indicação",
        "paragraphs": [
          "Permanecer disponível no aplicativo, completar o perfil, atualizar horários, responder solicitações e convidar outros profissionais por um link de referência poderão compor programas de atividade quando implantados.",
          "As missões e os sinais de presença poderão ajudar na ordenação das sugestões por região e pertinência, sem garantia de posição, número de clientes ou faturamento. Indicações não autorizam spam, coleta indevida de contatos nem condutas enganosas."
        ]
      },
      {
        "title": "5. Contratação direta e autonomia",
        "paragraphs": [
          "O profissional decide livremente se atende, como negocia o orçamento e como presta o serviço. Não há leilão de menor preço nem vínculo empregatício automático criado pelo simples cadastro no diretório. Cada profissional deve observar as exigências legais de sua atividade.",
          "O cliente paga à plataforma exclusivamente pela conveniência de acesso ao contato; eventual pagamento pelo trabalho do técnico ocorre diretamente entre as partes."
        ]
      },
      {
        "title": "6. Suspensão e correção de dados",
        "paragraphs": [
          "A visibilidade poderá ser interrompida por denúncia fundamentada, indícios de fraude, desatualização relevante ou segurança do sistema. O prestador poderá solicitar correção e revisão por meio de Contato. A suspensão não deverá ser apresentada como julgamento da competência técnica."
        ]
      }
    ]
  },
  "responsabilidades": {
    "title": "Responsabilidades e transparência",
    "description": "O que cabe ao portal, ao cliente e ao prestador nas negociações diretas.",
    "intro": "A separação de responsabilidades não retira direitos legais dos usuários.",
    "sections": [
      {
        "title": "1. O que a plataforma oferece",
        "paragraphs": [
          "O Encontre um Técnico disponibiliza cadastro, busca, visibilidade, triagem e acesso controlado a contatos, além de suporte limitado ao funcionamento do próprio sistema. O pagamento do cliente é pela conveniência digital disponibilizada, não pela mão de obra prestada por terceiros."
        ]
      },
      {
        "title": "2. O que cabe ao prestador",
        "paragraphs": [
          "Os prestadores são independentes e responsáveis pelas informações profissionais que publicam, suas condições de atendimento, orçamento, obrigações legais, prestação do trabalho e garantias relacionadas à contratação direta."
        ]
      },
      {
        "title": "3. O que cabe ao cliente",
        "paragraphs": [
          "O cliente escolhe o prestador, avalia a proposta, negocia valores e condições diretamente, toma precauções razoáveis e não compartilha nem revende dados de contato obtidos mediante acesso pessoal."
        ]
      },
      {
        "title": "4. Ausência de certificação",
        "paragraphs": [
          "O cadastro é livre. Expressões como ativo, online ou em destaque descrevem sinais operacionais ou dados informados pelo usuário, não certificação, investigação de antecedentes, vistoria profissional ou garantia de desempenho.",
          "O mecanismo de sugestão poderá considerar proximidade, correspondência de serviços, disponibilidade informada e atividade de perfil, conforme regras divulgadas, sem afirmar que um prestador é tecnicamente superior."
        ]
      },
      {
        "title": "5. Obrigações da plataforma",
        "paragraphs": [
          "A plataforma continua responsável por suas próprias obrigações legais, como informação verdadeira sobre preços e condições, proteção de dados, meios de atendimento, controles de segurança proporcionais e correção de defeitos do serviço digital.",
          "Nenhum texto deste portal pretende afastar responsabilidade que a lei atribua de forma obrigatória, impedir reclamações ou restringir direitos indisponíveis."
        ]
      },
      {
        "title": "6. Ajuda quando não houver cobertura",
        "paragraphs": [
          "Após adquirir o benefício informado na oferta, o cliente poderá pedir assistência na busca de alternativas onde não haja prestador cadastrado. Esse suporte é um auxílio de localização, sem promessa de contratação, garantia de disponibilidade ou condução da negociação."
        ]
      }
    ]
  },
  "seguranca": {
    "title": "Segurança e uso responsável",
    "description": "Prevenção a fraudes, acesso controlado a contatos, denúncias e boas práticas.",
    "intro": "O portal organiza o acesso a contatos, mas a segurança também depende de condutas responsáveis de todos.",
    "sections": [
      {
        "title": "1. Dados privados",
        "paragraphs": [
          "Números de telefone e dados privados de contato não devem ficar livremente expostos para visitantes. A liberação requer autenticação e o direito de acesso correspondente à aquisição, quando esse fluxo estiver operacional.",
          "Limitar o número de contatos por aquisição e por dia ajuda a reduzir raspagem, spam e tentativas de uso abusivo, mas nenhuma medida isolada elimina fraudes."
        ]
      },
      {
        "title": "2. Proteção de contas",
        "paragraphs": [
          "Utilize senha exclusiva, confirme os endereços oficiais do portal e nunca compartilhe códigos de acesso ou recuperação. Contatos que solicitem transferências fora de um fluxo de pagamento identificado devem ser tratados com cautela."
        ]
      },
      {
        "title": "3. Negociação direta",
        "paragraphs": [
          "Antes de contratar, peça descrição escrita do serviço, orçamento, peças, deslocamento, prazo e condições de pagamento. O prestador pode aceitar ou recusar solicitações e o cliente pode escolher outro profissional.",
          "A plataforma não garante experiência, certificação, antecedentes, solvência, atendimento imediato ou resultados dos prestadores cadastrados."
        ]
      },
      {
        "title": "4. Denúncias e abuso",
        "paragraphs": [
          "É proibido criar contas falsas, usar robôs para coletar telefones, revender contatos, enviar spam, ameaçar usuários ou tentar contornar limites de acesso. Denúncias podem ser enviadas pela página Contato, com informações objetivas e sem divulgar dados de terceiros desnecessariamente.",
          "A plataforma poderá restringir contas e preservar evidências necessárias para segurança, atendimento de direitos ou cumprimento legal, observando a LGPD."
        ]
      },
      {
        "title": "5. Localização e disponibilidade",
        "paragraphs": [
          "Estar online é um sinal operacional de presença e não garantia de resposta. A posição do usuário pode ser aproximada ou decorrer de uma localização fornecida voluntariamente; geolocalização precisa somente mediante permissão do dispositivo."
        ]
      }
    ]
  },
  "direitos": {
    "title": "Direitos sobre seus dados",
    "description": "Como solicitar acesso, correção, eliminação e outras medidas previstas na LGPD.",
    "intro": "Você pode falar com a plataforma sobre seus dados, mesmo sem adquirir acesso pago.",
    "sections": [
      {
        "title": "1. Solicitações disponíveis",
        "paragraphs": [
          "Você pode pedir informação sobre existência de tratamento, acesso aos seus dados, correção de informações inexatas, informações sobre compartilhamento, revisão de situações legalmente aplicáveis, portabilidade quando cabível e bloqueio, anonimização ou eliminação nas hipóteses previstas na LGPD."
        ]
      },
      {
        "title": "2. Como solicitar",
        "paragraphs": [
          "Use a página Contato ou escreva para dpo@encontreumtecnico.com, indicando que se trata de pedido de privacidade. Forneça somente os elementos necessários para localizar sua conta ou registro antigo. Para sua segurança, poderemos verificar sua identidade antes de revelar ou alterar dados."
        ]
      },
      {
        "title": "3. Cadastro antigo do WordPress",
        "paragraphs": [
          "Se você identifica uma ficha antiga relacionada a você, pode solicitar correção, atualização, ocultação ou associação ao novo cadastro. A plataforma não deve atribuir automaticamente a você o controle de um cadastro apenas pela indicação de um nome ou ID."
        ]
      },
      {
        "title": "4. Retenção e resposta",
        "paragraphs": [
          "Dados podem precisar ser conservados para obrigações legais, prova de pagamento, registros de segurança ou exercício de direitos, mesmo após encerramento de conta. A resposta observará os prazos e condições aplicáveis e será fornecida por canal apropriado."
        ]
      },
      {
        "title": "5. Cookies e reclamações",
        "paragraphs": [
          "As preferências de cookies opcionais podem ser alteradas pelo controle no rodapé. Se a sua solicitação não for resolvida, você poderá utilizar os canais de defesa do consumidor ou da autoridade de proteção de dados competentes, conforme o caso."
        ]
      }
    ]
  }
};
