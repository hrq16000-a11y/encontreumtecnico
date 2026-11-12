import type { PublicGuide } from "./public-guides";

/**
 * Original content written FOR service-category pages, not new /guias URLs.
 * Each topic requires substantive guidance, a transparent hiring checklist and
 * a real matching directory category. No invented professionals or locations.
 */
export const SPECIALTY_CONTENT: readonly PublicGuide[] = [
  {
    slug: "automacao-residencial-comercial-planejamento",
    title: "Automação residencial e comercial: como organizar dispositivos, rotinas e instalação",
    description: "Informações práticas para definir o escopo de automação, compatibilidade, conectividade, privacidade e manutenção antes de solicitar um prestador.",
    categorySlug: "automacao",
    categoryName: "Automação",
    publishedAt: "2026-11-11",
    updatedAt: "2026-11-11",
    introduction: "Automação útil não começa pela compra de sensores. Começa pela necessidade: acender luzes em determinado horário, controlar equipamentos autorizados, receber alertas ou integrar dispositivos já instalados. Na contratação, compreender infraestrutura, limites de conectividade, segurança de acesso e quem fará a manutenção ajuda a evitar sistemas difíceis de usar. A seção abaixo reúne decisões práticas para explicar o projeto a um profissional que declare atender automação.",
    sections: [
      {
        heading: "Transforme a necessidade em uma lista de ambientes e funções",
        paragraphs: [
          "Descreva o resultado esperado em cada ambiente, sem começar por marcas. Uma rotina pode exigir apenas agendamento; outra pode depender de sensores, comando manual, rede local e autorização de várias pessoas. Distinguir o que é essencial do que seria apenas conveniente ajuda a comparar propostas com a mesma finalidade.",
          "Informe quantos ambientes serão atendidos, onde os dispositivos já existem e quem os utilizará. Uma loja precisa considerar horários de funcionamento e operação por funcionários; uma residência pode precisar de controles simples para pessoas com níveis diferentes de familiaridade tecnológica. Não presuma que todo equipamento aceita integração só porque tem Wi-Fi."
        ],
        checklist: ["Listar locais e objetivos em linguagem simples", "Separar necessidades obrigatórias de extras", "Anotar dispositivos e controles já instalados", "Definir quem poderá administrar as rotinas"]
      },
      {
        heading: "Verifique compatibilidade e comportamento sem internet",
        paragraphs: [
          "Peça ao prestador que identifique quais equipamentos, controladoras, aplicativos e protocolos serão utilizados e quais dependem de serviços de terceiros. Alguns cenários funcionam com controle local; outros precisam de acesso à internet ou conta externa. A diferença afeta confiabilidade, custos futuros, privacidade e suporte.",
          "Pergunte o que acontece se a internet cair, se o aplicativo deixar de funcionar ou se trocar de roteador. Um projeto bem explicado define como utilizar comandos manuais, recuperar configurações e manter funções importantes disponíveis. Evite promessas genéricas de compatibilidade universal; a confirmação depende dos modelos e versões reais."
        ],
        checklist: ["Confirmar marcas, modelos e interfaces disponíveis", "Perguntar sobre dependência de nuvem e assinaturas", "Definir comportamento durante falha de conexão", "Documentar forma de recuperar a configuração"]
      },
      {
        heading: "Proteja contas, dados e permissões de acesso",
        paragraphs: [
          "Dispositivos inteligentes podem coletar hábitos de uso e permitir controle remoto. O responsável pela instalação deve explicar quais permissões são necessárias e como retirar o acesso técnico após a entrega. Priorize contas individuais, autenticação adicional quando disponível e configuração adequada de atualizações de segurança.",
          "Não envie senhas pessoais, códigos de autenticação ou credenciais bancárias pela solicitação do portal. Combine como o profissional trabalhará com acesso temporário ou acompanhado, quando isso for tecnicamente possível. Em espaços comerciais e compartilhados, defina previamente quem autoriza mudanças e quem responde por incidentes."
        ],
        checklist: ["Verificar quem é o proprietário da conta principal", "Solicitar procedimento de revogação de acesso", "Proteger dados e credenciais no atendimento", "Definir responsáveis por mudanças futuras"]
      },
      {
        heading: "Planeje instalação física e limites de segurança",
        paragraphs: [
          "Uma instalação pode envolver rede, fixações, alimentação elétrica e integração com outros sistemas. Antes de executar alterações físicas, o profissional deve avaliar as condições reais e verificar se a atividade exige habilitação específica ou autorização do imóvel. Comandos relacionados a portões, fechaduras e equipamentos de risco requerem atenção adicional à segurança das pessoas.",
          "Não improvisar ligações elétricas ou contornar proteções existentes é uma decisão de segurança. O cliente pode documentar os pontos de uso, fotografar equipamentos acessíveis e informar restrições do local, mas intervenções técnicas precisam ser executadas por quem tenha competência adequada à atividade."
        ],
        checklist: ["Identificar necessidades de rede e alimentação", "Verificar regras do imóvel e autorização de obras", "Manter comandos manuais e proteções essenciais", "Solicitar orientação de uso e segurança na entrega"]
      },
      {
        heading: "Compare orçamentos pelo escopo e suporte entregue",
        paragraphs: [
          "Uma proposta útil diferencia equipamentos, instalação, configuração, testes, treinamento, garantia e suporte. Pergunte quem mantém as senhas, contas, rotinas e integrações; se há serviços recorrentes cobrados por terceiros; e que documentação será entregue ao final. Valores e prazos devem depender da avaliação do local.",
          "Para solicitar atendimento, informe município, tipo de imóvel, funcionalidades desejadas, quantidade aproximada de dispositivos e existência de rede. Não é necessário revelar endereço exato nem credenciais em uma descrição pública. Consulte os perfis aprovados que declararam automação e confirme diretamente suas condições."
        ],
        checklist: ["Pedir orçamento detalhado por atividade", "Confirmar custos recorrentes, se existirem", "Solicitar demonstração das rotinas entregues", "Combinar manutenção e acesso após conclusão"]
      }
    ],
    finalAdvice: "Procure profissionais da categoria Automação que declarem atuar no tipo de sistema desejado. Descreva a finalidade, os equipamentos existentes e a cidade pelo funil; a plataforma não verifica certificações, nem garante que todos os prestadores executem todas as integrações."
  },
  {
    slug: "interfonia-telefonia-ip-comunicacoes-planejamento",
    title: "Interfonia e telefonia IP: o que conferir antes de instalar ou contratar manutenção",
    description: "Orientações para interfone, ramais, chamadas VoIP, rede e privacidade, com roteiro de solicitação e comparação de escopos.",
    categorySlug: "comunicacoes",
    categoryName: "Comunicações e telefonia",
    publishedAt: "2026-11-11",
    updatedAt: "2026-11-11",
    introduction: "Interfones, ramais e telefonia sobre rede podem parecer soluções semelhantes, mas exigem levantamentos diferentes. A comunicação entre salas, portaria e clientes depende de equipamentos, cabeamento ou rede, alimentação, operadora e permissões de acesso. Esta página ajuda a organizar informações para solicitar uma instalação ou manutenção sem prometer compatibilidade, cobertura ou diagnóstico sem vistoria.",
    sections: [
      {
        heading: "Defina quem precisa falar com quem",
        paragraphs: [
          "Uma instalação residencial com poucos pontos é diferente de um condomínio, escritório ou comércio com horários, grupos de atendimento e vários ramais. Antes de escolher equipamentos, registre quantos usuários e ambientes precisam se comunicar, quais chamadas devem chegar de fora e quais funções são essenciais.",
          "Informe se já há central, interfone, porteiro eletrônico, ramais ou contrato de operadora. Sistemas existentes podem impor limitações de compatibilidade. Identificar o objetivo ajuda o prestador a separar manutenção de infraestrutura, configuração de ramais e eventual substituição de componentes."
        ],
        checklist: ["Mapear ramais, ambientes e destinatários", "Informar equipamentos e central existentes", "Distinguir chamadas internas e externas", "Indicar horários e prioridades de atendimento"]
      },
      {
        heading: "Avalie rede, cabos e pontos de alimentação",
        paragraphs: [
          "A telefonia IP depende da qualidade da rede usada pelos dispositivos. Atrasos, perdas de pacotes, Wi-Fi instável ou configuração inadequada podem prejudicar a experiência de chamada. Uma vistoria pode identificar necessidades de rede cabeada, roteador, switch, energia e proteção do equipamento.",
          "No caso de interfonia, o profissional deve identificar a tecnologia do sistema existente antes de propor adaptações. Não realize ligações ou alterações no cabeamento sem conhecer suas especificações. Em imóveis compartilhados, confirme a autorização do responsável pelo sistema coletivo."
        ],
        checklist: ["Informar se os pontos usam cabo, Wi-Fi ou central", "Relatar quedas, ruídos e chamadas interrompidas", "Indicar disponibilidade de tomadas e rede", "Confirmar responsabilidade por infraestrutura compartilhada"]
      },
      {
        heading: "Entenda dependências de internet e operadora",
        paragraphs: [
          "Em soluções VoIP, serviços externos podem ser necessários para chamadas fora da organização. Pergunte ao prestador e à operadora quais funções dependem da internet, de uma conta ativa ou de contratos específicos. Não presuma que qualquer número existente pode ser migrado ou que todas as funções continuarão sem conexão.",
          "Se a comunicação for crítica, converse sobre contingência adequada ao contexto: como contatar pessoas quando a rede estiver indisponível, quem prestará suporte e o que precisa ser monitorado. O desenho correto depende do funcionamento real do local e do serviço contratado."
        ],
        checklist: ["Identificar prestadores e contas envolvidos", "Confirmar limitações de portabilidade e serviço", "Definir procedimento durante indisponibilidade", "Registrar contatos de suporte autorizados"]
      },
      {
        heading: "Proteja conversas, gravações e configurações",
        paragraphs: [
          "Centrais, aplicativos e gravações podem conter dados pessoais e informações de clientes. Peça que o responsável explique permissões de administração, políticas de armazenamento e acesso remoto, observando as regras aplicáveis ao local. Evite compartilhar senhas de centrais, códigos de operadora ou dados de chamadas com desconhecidos.",
          "Após a instalação, confira quem ficou com credenciais administrativas, como retirar acessos temporários e se o sistema está recebendo atualizações compatíveis. Em empresas e condomínios, a política sobre gravação e retenção de chamadas deve ser definida por quem tem legitimidade para isso."
        ],
        checklist: ["Definir usuários e administradores autorizados", "Revisar acesso remoto e revogação de credenciais", "Ajustar configurações de gravação quando aplicável", "Solicitar documentação sem expor segredos"]
      },
      {
        heading: "Prepare um pedido de atendimento objetivo",
        paragraphs: [
          "Para comparar propostas, informe a cidade, tipo de imóvel, quantidade aproximada de ramais ou pontos, problema observado e se já existe infraestrutura instalada. Um orçamento deve indicar instalação, configuração, testes, treinamento, responsabilidades e eventual dependência de contrato externo.",
          "No catálogo, selecione Comunicações e telefonia e confira os serviços declarados pelos profissionais aprovados. O registro do perfil não comprova especialização e a disponibilidade precisa ser confirmada com o prestador. O funil pode organizar a demanda sem publicar números privados nem mensagens com credenciais."
        ],
        checklist: ["Descrever sintomas e objetivo da comunicação", "Informar quantidade aproximada de pontos", "Pedir escopo de testes e suporte", "Confirmar garantia e condições antes de contratar"]
      }
    ],
    finalAdvice: "Na categoria Comunicações e telefonia, procure prestadores que declarem experiência em interfonia, ramais ou telefonia IP conforme seu caso. Use o formulário para registrar necessidade e cidade, sem revelar senhas, números privados ou gravações."
  },
];

/** Semantic navigation, not arbitrary cross-links or artificial news pages. */
export const SPECIALTY_RELATED_CATEGORIES: Record<string, readonly string[]> = {
  automacao: ["cftv", "redes", "eletrica"],
  comunicacoes: ["redes", "cftv", "automacao"],
};

export function getSpecialtyContent(categorySlug: string): PublicGuide | null {
  return SPECIALTY_CONTENT.find(topic => topic.categorySlug === categorySlug) ?? null;
}
