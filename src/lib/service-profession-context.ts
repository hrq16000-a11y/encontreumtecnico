import type { ServiceCategory } from "./service-catalog";

/** Informações editoriais sobre a profissão, nunca qualificações de um prestador.
 * Entradas somente para as categorias canônicas publicadas no catálogo.
 * Cursos e conhecimentos são pontos de conferência, não certificações presumidas.
 */
export type ServiceProfessionContext = {
  professionalRoles: readonly string[];
  typicalRequests: readonly string[];
  knowledgeAreas: readonly string[];
  trainingHint: string;
};

export const SERVICE_PROFESSION_CONTEXT: Record<ServiceCategory["slug"], ServiceProfessionContext> = {
  climatizacao: {
    professionalRoles: ["Instalador de ar-condicionado", "Técnico de manutenção em climatização"],
    typicalRequests: ["Instalação e avaliação do local", "Limpeza e manutenção preventiva", "Diagnóstico de falhas de refrigeração"],
    knowledgeAreas: ["Dimensionamento e condições de instalação", "Componentes elétricos e mecânicos", "Rotinas de manutenção e cuidados com o equipamento"],
    trainingHint: "Pergunte sobre cursos de climatização ou refrigeração, experiência com o modelo e cuidados de segurança pertinentes ao serviço solicitado.",
  },
  automacao: {
    professionalRoles: ["Integrador de automação residencial", "Técnico de automação comercial"],
    typicalRequests: ["Integração de sensores e dispositivos", "Configuração de controles e rotinas", "Diagnóstico de comunicação entre equipamentos"],
    knowledgeAreas: ["Compatibilidade de protocolos e fabricantes", "Redes e controles locais", "Permissões de acesso e continuidade das rotinas"],
    trainingHint: "Peça exemplos de projetos semelhantes e pergunte sobre formação em automação, eletrônica ou redes, além dos limites de suporte de cada fabricante.",
  },
  cftv: {
    professionalRoles: ["Instalador de câmeras de segurança", "Técnico de sistemas de CFTV"],
    typicalRequests: ["Planejamento de pontos de câmera", "Instalação de gravadores e cabeamento", "Configuração de gravação e acesso autorizado"],
    knowledgeAreas: ["Posicionamento e alimentação de câmeras", "Armazenamento e conectividade", "Privacidade e controle de acessos"],
    trainingHint: "Confira cursos ou prática em CFTV, referências de instalações similares e capacidade de explicar quem acessará as imagens e gravações.",
  },
  computadores: {
    professionalRoles: ["Técnico de manutenção de computadores", "Técnico de notebooks"],
    typicalRequests: ["Diagnóstico de lentidão e falhas", "Troca ou atualização de componentes", "Montagem, limpeza e recuperação de funcionamento"],
    knowledgeAreas: ["Hardware e compatibilidade", "Diagnóstico de alimentação e armazenamento", "Preservação de dados antes de intervenções"],
    trainingHint: "Pergunte sobre cursos de manutenção de hardware, experiência com o equipamento e procedimentos para proteger arquivos antes de qualquer reparo.",
  },
  comunicacoes: {
    professionalRoles: ["Técnico de interfonia", "Instalador de telefonia IP e ramais"],
    typicalRequests: ["Instalação ou reparo de interfone", "Configuração de ramais e centrais", "Análise de falhas em chamadas e conectividade"],
    knowledgeAreas: ["Cabeamento e infraestrutura de comunicação", "Rede IP e qualidade de chamadas", "Permissões de centrais e dependência de operadoras"],
    trainingHint: "Verifique experiência no sistema e pergunte sobre cursos de telecomunicações, redes ou interfonia adequados à tecnologia instalada.",
  },
  eletrica: {
    professionalRoles: ["Eletricista de instalações", "Profissional de manutenção elétrica"],
    typicalRequests: ["Diagnóstico de circuitos e pontos", "Instalação ou substituição de componentes", "Inspeção de quadro e dispositivos de proteção"],
    knowledgeAreas: ["Circuitos, cargas e dimensionamento", "Proteção e identificação de falhas", "Procedimentos de trabalho seguro"],
    trainingHint: "Antes de contratar, confira formação, experiência e comprovações pertinentes ao risco e à atividade elétrica específica. Não presuma habilitação apenas pelo cadastro.",
  },
  "design-grafico": {
    professionalRoles: ["Designer gráfico", "Profissional de produção de peças gráficas"],
    typicalRequests: ["Criação ou adaptação de identidade visual", "Preparação de materiais para impressão", "Ajustes de arquivos e formatos de entrega"],
    knowledgeAreas: ["Composição, tipografia e cores", "Formatos e resolução de arquivos", "Direitos de uso e materiais de origem"],
    trainingHint: "Avalie portfólio autorizado, domínio das ferramentas de criação e estudos ou cursos pertinentes ao tipo de peça que será produzida.",
  },
  impressoras: {
    professionalRoles: ["Técnico de manutenção de impressoras", "Técnico de impressão em rede"],
    typicalRequests: ["Diagnóstico de falhas de impressão", "Configuração de impressora compartilhada", "Limpeza ou substituição de componentes"],
    knowledgeAreas: ["Tecnologias e suprimentos compatíveis", "Drivers e conexão em rede", "Manutenção adequada à marca e ao modelo"],
    trainingHint: "Pergunte sobre cursos técnicos ou treinamento do fabricante e experiência com o modelo, sem tratar o registro no portal como credenciamento.",
  },
  redes: {
    professionalRoles: ["Técnico de redes de computadores", "Instalador de rede cabeada e Wi-Fi"],
    typicalRequests: ["Melhoria de cobertura Wi-Fi", "Instalação de pontos de rede", "Diagnóstico de quedas e lentidão"],
    knowledgeAreas: ["Topologia, cabeamento e sinal", "Configuração de roteadores e pontos de acesso", "Segurança de rede e separação de acessos"],
    trainingHint: "Confira experiência em redes do porte do seu ambiente e formação em conectividade; peça explicação do diagnóstico e dos testes de entrega.",
  },
  software: {
    professionalRoles: ["Técnico de suporte em sistemas", "Profissional de instalação e recuperação de software"],
    typicalRequests: ["Instalação e configuração de programas", "Remoção de problemas de inicialização", "Preparação de backup antes de formatação"],
    knowledgeAreas: ["Sistemas operacionais e compatibilidade", "Segurança digital e atualização", "Cópias de segurança e recuperação de dados"],
    trainingHint: "Pergunte sobre conhecimentos no sistema utilizado, cursos de suporte e procedimentos de cópia segura; nunca entregue senhas pessoais em texto público.",
  },
};

export function getServiceProfessionContext(categorySlug: ServiceCategory["slug"]): ServiceProfessionContext {
  return SERVICE_PROFESSION_CONTEXT[categorySlug];
}
