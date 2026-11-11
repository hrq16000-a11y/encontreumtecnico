/** Conteúdo editorial original. Datas só mudam após revisão substancial.
 * Uma nova entrada publicada gera link no índice e no sitemap, sem inserir URL à mão.
 * Não armazena dados privados, números, perfis inventados ou promessas de disponibilidade.
 */
export type PublicGuide = {
  slug: string;
  title: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  publishedAt: string;
  updatedAt: string;
  introduction: string;
  sections: readonly {
    heading: string;
    paragraphs: readonly string[];
    checklist?: readonly string[];
  }[];
  finalAdvice: string;
};

export const GUIDES: readonly PublicGuide[] = [
  {
    slug: "computador-lento-o-que-verificar",
    title: "Computador lento: o que verificar antes de solicitar manutenção",
    description: "Checklist para identificar lentidão, proteger arquivos e descrever os sintomas ao técnico sem fazer reparos arriscados.",
    categorySlug: "computadores",
    categoryName: "Computadores e notebooks",
    publishedAt: "2026-11-11",
    updatedAt: "2026-11-11",
    introduction: "Lentidão pode ocorrer por muitos motivos: pouco espaço disponível, excesso de programas abertos, atualizações, superaquecimento ou problemas de armazenamento. Antes de contratar uma manutenção, algumas observações simples ajudam a explicar o defeito e reduzem tentativas desnecessárias. Este guia é de triagem inicial, não substitui diagnóstico presencial.",
    sections: [
      {
        heading: "Identifique quando a lentidão aparece",
        paragraphs: [
          "Observe se o computador já demora para iniciar, se trava apenas ao abrir programas específicos ou se fica lento quando várias abas estão abertas. São situações diferentes e essa distinção orienta a primeira conversa com quem fará o atendimento.",
          "Anote há quanto tempo o problema começou e se houve mudança recente, como instalação de um aplicativo, queda de energia, atualização ou transporte do equipamento. Não é preciso adivinhar a causa: relatar o que realmente aconteceu é mais útil."
        ],
        checklist: [
          "Sistema operacional e modelo do equipamento, se souber.",
          "Se a lentidão ocorre ao iniciar, navegar, trabalhar ou em todas essas situações.",
          "Mensagens de erro visíveis, sem expor senhas ou dados pessoais.",
          "Se o aparelho desliga, reinicia, esquenta muito ou produz ruídos incomuns."
        ]
      },
      {
        heading: "Verificações simples que não exigem desmontagem",
        paragraphs: [
          "Salve os trabalhos abertos e reinicie o computador pelo procedimento normal. Verifique, nas configurações do sistema, se o armazenamento está quase cheio. Feche programas que não esteja usando; muitos aplicativos iniciados automaticamente podem consumir memória.",
          "Se o equipamento estiver atualizando, evite desligá-lo à força. Trabalhe em uma superfície que não bloqueie as saídas de ventilação. Caso apareça cheiro de queimado, fumaça ou aquecimento anormal, desligue o aparelho com segurança e pare de utilizá-lo até a avaliação técnica."
        ],
        checklist: [
          "Espaço livre na unidade principal, sem apagar arquivos desconhecidos.",
          "Quantidade de aplicativos abertos ao notar a lentidão.",
          "Estado da ventilação e temperatura percebida.",
          "Se o problema também ocorre quando o computador está sem internet."
        ]
      },
      {
        heading: "Proteja seus dados antes do atendimento",
        paragraphs: [
          "Se o computador ainda funciona e seus dados estão acessíveis, faça uma cópia dos arquivos importantes em um destino confiável. Confirme que consegue abrir alguns dos arquivos copiados. Sincronização em nuvem não é necessariamente um backup independente, especialmente quando exclusões e alterações também são sincronizadas.",
          "Não compartilhe códigos de autenticação, senhas bancárias ou acesso irrestrito a contas. Se for necessário um acesso temporário para diagnóstico, combine o procedimento com o prestador e remova as permissões depois. Equipamentos corporativos devem seguir as regras de TI da organização."
        ],
        checklist: [
          "Documentos, fotografias e arquivos de trabalho prioritários identificados.",
          "Existência e legibilidade de uma cópia de segurança, quando possível.",
          "Contas pessoais encerradas ou protegidas adequadamente.",
          "Autorização para qualquer procedimento que possa apagar dados."
        ]
      },
      {
        heading: "O que evitar quando há suspeita de falha física",
        paragraphs: [
          "Não formate o computador como primeira tentativa para qualquer tipo de lentidão. Uma formatação pode apagar informações sem resolver problemas de disco, aquecimento ou energia. Também evite ferramentas que prometem acelerar o sistema com um clique ou exigem permissões excessivas sem explicar o que fazem.",
          "Estalos repetitivos, travamentos frequentes durante a leitura de arquivos ou desaparecimento de unidades podem indicar necessidade de avaliação especializada. Se os arquivos são importantes, insistir em reinicializações e testes agressivos pode piorar a situação. Informe ao técnico que preservar dados é prioridade."
        ]
      },
      {
        heading: "Como solicitar um orçamento com informações úteis",
        paragraphs: [
          "Descreva os sintomas, quando começaram, o que você já testou e se há arquivos que não podem ser perdidos. Pergunte o que está incluído no diagnóstico, se haverá custo de deslocamento, quais procedimentos exigem autorização e se o reparo é realizado no local ou depende de retirada do equipamento.",
          "A avaliação técnica pode indicar soluções simples ou substituição de componentes, mas não é possível afirmar a causa apenas pelos sintomas. Compare o escopo e as condições do orçamento, não só o menor preço. A disponibilidade e a competência profissional precisam ser verificadas diretamente pelo cliente."
        ]
      }
    ],
    finalAdvice: "Na busca do portal, selecione Computadores e notebooks e depois informe sua cidade. Os profissionais publicam suas áreas e serviços declarados; o contato privado não é exibido automaticamente."
  },
  {
    slug: "instalacao-cameras-seguranca-como-planejar",
    title: "Instalação de câmeras de segurança: como preparar seu pedido",
    description: "Orientações práticas para explicar ambientes, cobertura desejada, gravação, energia e privacidade antes de solicitar CFTV.",
    categorySlug: "cftv",
    categoryName: "Câmeras e segurança eletrônica",
    publishedAt: "2026-11-11",
    updatedAt: "2026-11-11",
    introduction: "Antes de solicitar a instalação de um sistema de câmeras, vale organizar quais áreas precisam ser monitoradas, qual resultado você espera das imagens e onde o equipamento será instalado. Um pedido bem explicado ajuda o prestador a avaliar possibilidades e limitações sem prometer cobertura ou qualidade de imagem à distância.",
    sections: [
      {
        heading: "Defina a finalidade do monitoramento",
        paragraphs: [
          "Você quer acompanhar a entrada de pessoas, identificar movimentações no portão, visualizar um corredor ou ter registros de ocorrências? Cada objetivo exige uma escolha diferente de ângulo, lente, iluminação e local de instalação. Uma câmera que mostra uma área ampla pode não oferecer detalhes suficientes para identificar alguém à distância.",
          "Faça uma lista de áreas prioritárias e de locais que não precisam ser filmados. Considere variações de luz durante o dia e a noite, obstáculos, vegetação, reflexos e pontos que possam gerar contraluz."
        ],
        checklist: [
          "Ambientes internos e externos que precisam de cobertura.",
          "Distâncias aproximadas e objetivos para cada posição.",
          "Condições de iluminação de dia e à noite.",
          "Áreas que devem ficar fora do enquadramento por privacidade."
        ]
      },
      {
        heading: "Explique a estrutura disponível",
        paragraphs: [
          "Informe se há energia elétrica próxima, possibilidade de passagem de cabos, conexão de rede estável e local protegido para equipamentos de gravação. Sistemas com câmeras IP e sistemas com gravadores próprios têm exigências distintas. Não escolha apenas pela promessa de resolução: estabilidade da instalação, armazenamento e manutenção também importam.",
          "Se houver câmeras ou gravador antigos, anote as marcas e modelos, quando possível. Não publique credenciais, números de série completos, endereços IP externos nem fotografias que revelem pontos sensíveis da segurança da residência ou da empresa."
        ]
      },
      {
        heading: "Pense na gravação e no acesso remoto",
        paragraphs: [
          "Converse sobre quanto tempo as imagens precisam ficar armazenadas e quem poderá consultá-las. A duração depende de capacidade, qualidade, movimento e quantidade de câmeras; não existe prazo único que sirva para qualquer instalação. Peça que o orçamento especifique a solução de armazenamento e o que acontece quando ele fica cheio.",
          "Para acesso remoto, solicite configuração com senhas únicas, atualizações e autenticação adicional quando disponível. Evite compartilhar senhas administrativas entre várias pessoas. Combine como revogar o acesso de um instalador depois da entrega."
        ],
        checklist: [
          "Período de retenção desejado, sem presumir garantia.",
          "Pessoas autorizadas a visualizar as imagens.",
          "Acesso por celular ou somente na rede local.",
          "Plano de manutenção, atualização e recuperação de acesso."
        ]
      },
      {
        heading: "Respeite a privacidade e os espaços compartilhados",
        paragraphs: [
          "O posicionamento das câmeras deve respeitar a privacidade de terceiros e as regras aplicáveis ao imóvel, condomínio ou local de trabalho. Evite registrar ambientes íntimos e não pressuponha que a instalação permite captar qualquer área vizinha. Quando houver coleta de imagens de pessoas identificáveis, verifique obrigações de proteção de dados conforme a finalidade e o contexto.",
          "Em condomínios ou empresas, confirme previamente quem pode autorizar a instalação e se existem procedimentos internos. Esse planejamento reduz retrabalho e evita discussões após o equipamento estar fixado."
        ]
      },
      {
        heading: "Peça um orçamento que deixe o escopo claro",
        paragraphs: [
          "Informe número estimado de pontos, se há infraestrutura existente e se o trabalho exigirá passagem de cabos, configuração de rede, armazenamento, orientação de uso ou manutenção. Pergunte sobre deslocamento, equipamentos, garantia contratual, necessidade de autorização de obras e suporte após a instalação.",
          "O profissional precisa avaliar as condições reais antes de confirmar viabilidade, prazo e preço. A publicação no diretório indica somente especialidades informadas pelo prestador; não equivale a certificação ou endosso."
        ]
      }
    ],
    finalAdvice: "Ao buscar Câmeras e segurança eletrônica no portal, refine pela cidade e confira os serviços específicos declarados pelo técnico. Descreva suas necessidades pelo atendimento guiado, sem divulgar senhas ou detalhes sensíveis do imóvel."
  }
];

export function getPublishedGuide(slug: string): PublicGuide | null {
  return GUIDES.find(guide => guide.slug === slug) ?? null;
}

export const GUIDE_PATHS = [
  "/guias",
  ...GUIDES.map(guide => "/guias/" + guide.slug),
] as const;
