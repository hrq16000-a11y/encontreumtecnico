/**
 * Perguntas originais associadas aos seis guias publicados.
 * Renderizadas como conteúdo HTML nativo, sem prometer rich result FAQPage,
 * certificação de profissional ou diagnóstico à distância.
 */
export type GuideFaq = { question: string; answer: string };

export const GUIDE_FAQS: Readonly<Record<string, readonly GuideFaq[]>> = {
  "backup-arquivos-antes-manutencao-computador": [
    {
      question: "Sincronizar uma pasta na nuvem já garante um backup?",
      answer: "Não necessariamente. Em algumas ferramentas, exclusões ou alterações indesejadas também são sincronizadas. Confirme o histórico de versões e mantenha uma cópia independente, acessível e testada dos arquivos essenciais.",
    },
    {
      question: "Posso formatar o computador antes de conferir as cópias?",
      answer: "Não é recomendado. A formatação pode apagar dados e não corrige defeitos físicos de armazenamento. Antes de autorizar o procedimento, confira a integridade da cópia e combine com o técnico quais arquivos precisam ser preservados.",
    },
    {
      question: "O que fazer quando o disco está fazendo ruídos ou desaparecendo?",
      answer: "Evite reinicializações e tentativas repetidas de copiar grandes volumes. Uma unidade com falha pode piorar durante o uso. Pare os testes agressivos e solicite avaliação especializada, informando que a recuperação dos dados tem prioridade.",
    },
    {
      question: "Preciso fornecer minha senha pessoal para o técnico?",
      answer: "Não compartilhe senhas bancárias, códigos de autenticação ou acesso irrestrito. Combine um procedimento de acesso temporário, quando necessário, e siga as políticas de TI se o aparelho for corporativo.",
    },
  ],
  "ar-condicionado-nao-gela-verificacoes-seguras": [
    {
      question: "Ar-condicionado que liga, mas não resfria, precisa de gás?",
      answer: "Não é possível concluir isso apenas pelos sintomas. Modo inadequado, filtros, circulação de ar, falhas elétricas e outros problemas podem afetar o resfriamento. O circuito de refrigeração deve ser avaliado por profissional qualificado.",
    },
    {
      question: "É seguro abrir o aparelho para procurar o defeito?",
      answer: "Não abra painéis técnicos, não toque em componentes elétricos nem manipule tubulações ou refrigerante. Verificações de usuário devem respeitar o manual e limitar-se a controles e partes acessíveis de forma segura.",
    },
    {
      question: "Quando devo interromper o uso do ar-condicionado?",
      answer: "Interrompa o uso diante de cheiro de queimado, ruídos anormais, disjuntor desarmando, gelo persistente ou água vazando em local inadequado. Não improvise reparos; procure assistência habilitada.",
    },
    {
      question: "Quais dados ajudam a solicitar manutenção?",
      answer: "Informe marca e modelo visíveis, quando o problema começou, se o fluxo de ar diminuiu e quando houve manutenção anterior. Descreva cidade e urgência; a causa e o preço dependem de avaliação.",
    },
  ],
  "wifi-caindo-sinal-fraco-como-identificar": [
    {
      question: "Wi-Fi fraco significa que preciso contratar mais velocidade?",
      answer: "Não necessariamente. Paredes, distância e interferências podem prejudicar a cobertura sem fio mesmo com um plano rápido. Compare a conexão perto do roteador e, quando possível, por cabo antes de concluir.",
    },
    {
      question: "Devo apertar o botão de reset do roteador?",
      answer: "Evite restaurar as configurações de fábrica sem orientação. O reset pode apagar nome da rede, senha e parâmetros da operadora, interrompendo o acesso de todos os dispositivos.",
    },
    {
      question: "Como diferenciar falha da operadora e falha do Wi-Fi?",
      answer: "Observe se a rede continua visível e se aparelhos por cabo também ficam sem internet. Compare dois dispositivos e confira comunicados oficiais da operadora. Essas observações ajudam, mas não substituem diagnóstico.",
    },
    {
      question: "O que informar ao pedir um técnico de redes?",
      answer: "Descreva em quais cômodos a conexão falha, os horários, os aparelhos afetados e a existência de repetidores ou cabos. Não envie senhas ou credenciais administrativas no formulário.",
    },
  ],
  "impressora-offline-fila-travada-o-que-fazer": [
    {
      question: "Impressora ligada pode aparecer como offline?",
      answer: "Sim. O equipamento pode estar ligado e não se comunicar com o computador devido a rede, cabo, configuração ou fila. Observe a mensagem exata e teste outros dispositivos autorizados, quando disponíveis.",
    },
    {
      question: "É seguro cancelar todos os documentos presos na fila?",
      answer: "Antes de cancelar, verifique se a fila é compartilhada e se os documentos são seus. Um trabalho confidencial pode ser impresso depois que a conexão voltar. Em empresas, siga a orientação do responsável.",
    },
    {
      question: "Preciso reinstalar o driver imediatamente?",
      answer: "Não. Comece pela mensagem do visor, disponibilidade de papel, conexão e fila. Reinstalar drivers sem avaliar o problema pode remover uma configuração funcional sem corrigir a causa.",
    },
    {
      question: "Que informações devo fornecer ao profissional?",
      answer: "Informe modelo, mensagem de erro, tipo de conexão, quando surgiu o problema e se outros computadores imprimem. Não compartilhe documentos confidenciais, senhas administrativas ou números de série completos.",
    },
  ],
  "computador-lento-o-que-verificar": [
    {
      question: "Formatar é sempre a melhor solução para computador lento?",
      answer: "Não. Pouco espaço, aplicativos, aquecimento e falhas de armazenamento exigem abordagens diferentes. A formatação pode apagar dados e não resolver problemas físicos; confirme a causa antes de autorizar.",
    },
    {
      question: "Como saber se o problema é o computador ou a internet?",
      answer: "Observe se o equipamento também demora para abrir arquivos e programas que funcionam sem conexão. Se a dificuldade ocorre apenas em sites, informe isso ao profissional e compare a rede de forma segura.",
    },
    {
      question: "É seguro instalar programas que prometem acelerar o PC?",
      answer: "Desconfie de ferramentas que solicitam permissões amplas ou prometem solução instantânea. Priorize recursos do próprio sistema e evite remover arquivos desconhecidos ou alterar configurações avançadas sem orientação.",
    },
    {
      question: "O que preciso salvar antes de entregar o notebook?",
      answer: "Faça e teste uma cópia dos arquivos essenciais quando o equipamento estiver estável. Se houver sinais de defeito físico no disco, interrompa testes repetidos e informe que preservar os dados é prioridade.",
    },
  ],
  "instalacao-cameras-seguranca-como-planejar": [
    {
      question: "Uma única câmera consegue identificar todas as pessoas de um ambiente?",
      answer: "Não há garantia. Distância, lente, altura, iluminação e ângulo influenciam os detalhes captados. Explique ao profissional o objetivo do monitoramento e quais áreas precisam de maior definição.",
    },
    {
      question: "As imagens ficam gravadas por quantos dias?",
      answer: "O período depende da capacidade de armazenamento, resolução, quantidade de câmeras e configuração de gravação. Peça que o orçamento especifique a retenção prevista e o comportamento quando o espaço se esgota.",
    },
    {
      question: "Devo compartilhar minha senha para instalar acesso remoto?",
      answer: "Evite compartilhar senhas principais e códigos de autenticação. Combine credenciais individuais ou temporárias, autenticação adicional quando disponível e revogação do acesso do instalador após a entrega.",
    },
    {
      question: "Posso apontar câmeras para qualquer área vizinha?",
      answer: "Não presuma essa permissão. O monitoramento deve considerar privacidade de terceiros, regras do imóvel e proteção de dados quando aplicável. Planeje enquadramentos que respeitem espaços compartilhados e áreas íntimas.",
    },
  ],
};

export function getGuideFaqs(slug: string): readonly GuideFaq[] {
  return GUIDE_FAQS[slug] ?? [];
}
