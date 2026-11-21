import { getEnrichedServiceCategory } from "@/lib/service-catalog";

const scenarios: Record<string, { title: string; preparation: string; before: string; related: string; anchor: string; after: string }> = {
  "redes": {
    title: "Quando o sinal cai em apenas um cômodo",
    preparation: "Anote em quais ambientes a conexão falha e se outro aparelho funciona no mesmo lugar. Esse contraste ajuda a explicar por que uma visita pode ser mais útil que trocar o roteador por tentativa.",
    before: "Se apenas um notebook perde a conexão em todas as redes, consulte também a área de ",
    related: "computadores",
    anchor: "reparo de computadores",
    after: " para preparar o histórico desse aparelho.",
  },
  "computadores": {
    title: "Quando o computador liga, mas o trabalho não pode parar",
    preparation: "Informe o modelo e descreva o que aparece na tela ao ligar. Liste os arquivos que precisam ser preservados e combine como autorizar peças ou etapas adicionais depois do diagnóstico.",
    before: "Se a dificuldade está concentrada em um programa, o guia de ",
    related: "software",
    anchor: "sistemas e software",
    after: " ajuda a separar uma falha do aplicativo de um problema do equipamento.",
  },
  "software": {
    title: "Quando a falha começou após uma atualização",
    preparation: "Registre a versão do programa e qual tarefa deixou de funcionar. Para comparar propostas, peça que o orçamento identifique a cópia de segurança, a reinstalação e a conferência dos arquivos recuperados.",
    before: "Se o equipamento também desliga antes de abrir o sistema, descreva esse sintoma ao consultar ",
    related: "computadores",
    anchor: "manutenção de computadores",
    after: ".",
  },
  "impressoras": {
    title: "Quando vários usuários compartilham uma impressora",
    preparation: "Informe o modelo, a conexão e se a impressora consegue fazer uma cópia ou imprimir uma página de teste pelo painel. Conte se o erro aparece para todos ou em apenas uma estação.",
    before: "Se o equipamento imprime localmente e desaparece para vários usuários, as orientações de ",
    related: "redes",
    anchor: "conectividade da rede",
    after: " ajudam a preparar o pedido.",
  },
  "cftv": {
    title: "Quando a câmera grava, mas a imagem some do celular",
    preparation: "Diga se a gravação local continua disponível e se o problema ocorre no Wi-Fi, nos dados móveis ou em ambos. Informe os modelos de câmera e gravador, preservando senhas e imagens particulares.",
    before: "Quando outros dispositivos do local também perdem acesso, descreva a falha usando o guia de ",
    related: "redes",
    anchor: "redes e conectividade",
    after: ".",
  },
  "automacao": {
    title: "Quando um dispositivo funciona sozinho e falha em uma rotina",
    preparation: "Liste a central, os dispositivos e a sequência esperada. Indique qual etapa falhou e se o comando manual ainda funciona. Combine como a rotina será demonstrada na entrega.",
    before: "Se os dispositivos também aparecem desconectados, confira como descrever a ",
    related: "redes",
    anchor: "cobertura do Wi-Fi",
    after: " nos ambientes afetados.",
  },
  "comunicacoes": {
    title: "Quando a chamada chega, mas o áudio funciona em um só sentido",
    preparation: "Registre quais ramais fazem parte da chamada e se o sintoma ocorre em ligações internas, externas ou nas duas. Informe se a instalação utiliza telefonia convencional ou IP.",
    before: "Em ramais IP que também perdem registro, consulte as orientações para ",
    related: "redes",
    anchor: "redes cabeadas e Wi-Fi",
    after: " antes de descrever o ambiente.",
  },
  "climatizacao": {
    title: "Quando o aparelho responde ao controle, mas a sala não esfria",
    preparation: "Informe o modelo, o tamanho aproximado do ambiente e quando a perda de desempenho começou. Ao comparar orçamentos, pergunte o que a visita cobre e quais serviços precisam de autorização à parte.",
    before: "Se a falha ocorre somente em horários programados por uma central, veja como registrar uma rotina de ",
    related: "automacao",
    anchor: "automação",
    after: " para o técnico avaliar.",
  },
  "eletrica": {
    title: "Quando o orçamento envolve mais de um ambiente",
    preparation: "Identifique os cômodos e o que deixou de funcionar em cada um. Informe se a solicitação é de reparo ou de ampliação. Peça que materiais, mão de obra e eventuais acabamentos apareçam separados na proposta.",
    before: "Se o objetivo inclui controles de iluminação por cenário, consulte as possibilidades de ",
    related: "automacao",
    anchor: "automação dos ambientes",
    after: " para definir o escopo.",
  },
  "design-grafico": {
    title: "Quando o arquivo aprovado será enviado para impressão",
    preparation: "Informe o formato final, o material, a tiragem e o prazo. Combine quem prepara o arquivo para a gráfica, quantas revisões estão incluídas e como será feita a aprovação da prova.",
    before: "Se o arquivo já foi aprovado e o defeito aparece apenas na sua máquina, consulte a área de ",
    related: "impressoras",
    anchor: "manutenção de impressoras",
    after: " para descrever o problema de saída.",
  },
};

export function ServiceRequestEditorial({ slug }: { slug: string }) {
  const item = scenarios[slug];
  if (!item) return null;
  return <section className="my-8 rounded-2xl border border-border bg-card p-5 sm:p-7">
    <h2 className="text-xl font-bold">{item.title}</h2>
    <p className="mt-3 leading-7">{item.preparation}</p>
    {getEnrichedServiceCategory(item.related) && <p className="mt-3 leading-7">{item.before}<a className="font-semibold text-primary underline underline-offset-2" href={`/servicos/${item.related}`}>{item.anchor}</a>{item.after}</p>}
  </section>;
}
