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
    slug: "backup-arquivos-antes-manutencao-computador",
    title: "Backup antes da manutenção: como proteger documentos, fotos e arquivos importantes",
    description: "Guia prático para organizar cópias de segurança antes de reparos, formatação ou troca de computador, sem expor senhas ou perder dados.",
    categorySlug: "software",
    categoryName: "Sistemas e software",
    publishedAt: "2026-11-11",
    updatedAt: "2026-11-11",
    introduction: "Antes de formatar um notebook, substituir um disco ou solicitar uma manutenção, vale perguntar: onde está a cópia dos meus arquivos? O backup reduz o risco de perda em procedimentos comuns, mas precisa existir, estar acessível e ser adequado ao problema. Estas orientações ajudam a preparar o atendimento sem desmontar equipamentos, compartilhar senhas ou executar ações que possam piorar uma falha física.",
    sections: [
      {
        heading: "Identifique o que realmente precisa ser preservado",
        paragraphs: [
          "Comece pelos arquivos que você não conseguiria recuperar facilmente: documentos pessoais, trabalhos, fotografias, arquivos de projetos, planilhas e materiais de estudo. Verifique pastas de trabalho, área de trabalho, downloads e diretórios usados por programas específicos. Não presuma que tudo está salvo na pasta Documentos ou na nuvem.",
          "Alguns aplicativos guardam informações em bibliotecas próprias, bancos de dados locais ou perfis do usuário. Se você utiliza software profissional, sistemas de gestão ou arquivos de projetos, consulte o fabricante ou o responsável técnico sobre como exportar uma cópia íntegra. Anote também quais programas e licenças precisarão ser reinstalados, sem divulgar códigos de ativação."
        ],
        checklist: [
          "Documentos, fotos e arquivos de trabalho prioritários identificados.",
          "Pastas e programas que armazenam dados fora dos locais comuns.",
          "Configurações e licenças necessárias para voltar a trabalhar.",
          "Arquivos corporativos separados de conteúdos pessoais quando aplicável."
        ]
      },
      {
        heading: "Entenda a diferença entre sincronização e cópia de segurança",
        paragraphs: [
          "Uma pasta sincronizada pode facilitar o acesso em diferentes dispositivos, mas exclusões, alterações e arquivos corrompidos também podem se propagar. Por isso, sincronização não é automaticamente um backup independente. Verifique se o serviço mantém histórico de versões e qual é o prazo de recuperação antes de depender apenas dele.",
          "Uma estratégia conhecida é manter cópias em mais de um tipo de armazenamento e preservar pelo menos uma delas separada do computador. O formato ideal depende do valor dos arquivos, do espaço disponível e do risco envolvido. Em qualquer opção, confirme se os arquivos estão completos e se você consegue lê-los; apenas ver uma barra de progresso concluída não garante recuperação."
        ],
        checklist: [
          "Destino escolhido com espaço suficiente e acesso autorizado.",
          "Cópia independente que não será alterada junto com o computador.",
          "Histórico de versões verificado quando usar serviços sincronizados.",
          "Dispositivo de backup guardado em local seguro após a cópia."
        ]
      },
      {
        heading: "Faça a cópia sem aumentar o risco de perda",
        paragraphs: [
          "Se o equipamento está estável e os arquivos podem ser abertos, copie primeiro os itens essenciais para um destino confiável e verifique alguns documentos e fotografias no local de destino. Não remova pastas do sistema nem apague a origem depois da cópia. Evite instalar programas de backup desconhecidos que solicitam acesso amplo sem explicar sua finalidade.",
          "Se houver estalos repetitivos, desaparecimento de unidade, travamentos durante a leitura ou sinais de dano físico, pare os testes intensivos. Tentar ler um disco defeituoso repetidamente pode reduzir a possibilidade de recuperação especializada. Nessa situação, descreva os sintomas e informe que preservar os dados tem prioridade sobre deixar o computador funcionando imediatamente."
        ]
      },
      {
        heading: "Proteja a privacidade antes de entregar o equipamento",
        paragraphs: [
          "Combine previamente quais arquivos o profissional precisa acessar para o diagnóstico. Sempre que possível, encerre sessões de contas sensíveis e use meios apropriados de acesso temporário, sem revelar códigos de autenticação, senhas bancárias ou credenciais de outras pessoas. Equipamentos de empresas devem seguir as regras de segurança e autorização do empregador.",
          "Se dados pessoais, financeiros ou de clientes estiverem armazenados no dispositivo, explique a sensibilidade dessas informações e combine como serão tratados os arquivos durante o atendimento. Pergunte sobre retenção de cópias, devolução de mídias e exclusão de dados temporários. Um contrato ou ordem de serviço pode registrar limites importantes."
        ],
        checklist: [
          "Contas sensíveis protegidas sem bloquear o diagnóstico necessário.",
          "Acesso temporário e escopo do técnico previamente combinados.",
          "Informações de clientes e da empresa tratadas conforme as regras aplicáveis.",
          "Procedimento para excluir cópias temporárias ao encerrar o serviço."
        ]
      },
      {
        heading: "Prepare um pedido de manutenção com prioridade aos dados",
        paragraphs: [
          "Ao solicitar suporte, descreva o defeito, o sistema operacional, se o equipamento liga e quais dados são indispensáveis. Informe se existe um backup testado e quando ele foi realizado. Se o computador já apresenta sinais de falha de disco, não autorize formatação, reinstalação ou troca de armazenamento antes de entender as consequências para a recuperação dos arquivos.",
          "Peça que o orçamento discrimine diagnóstico, tentativa de recuperação, substituição de peças e reinstalação, quando necessários. Pergunte se há risco de perda e quem terá acesso aos dados. A presença de um técnico no diretório significa apenas que ele declarou sua especialidade; você deve confirmar capacidade, disponibilidade e condições do atendimento diretamente."
        ]
      }
    ],
    finalAdvice: "Escolha Sistemas e software na busca e explique se precisa de cópia de segurança, reinstalação ou diagnóstico. O funil organiza a solicitação e a prioridade dos arquivos sem liberar contatos privados de profissionais."
  },
  {
    slug: "ar-condicionado-nao-gela-verificacoes-seguras",
    title: "Ar-condicionado não gela: o que verificar com segurança antes de pedir assistência",
    description: "Orientações para observar filtros, modo de operação e sinais de falha sem abrir o aparelho, manipular gás refrigerante ou arriscar choques.",
    categorySlug: "climatizacao",
    categoryName: "Climatização",
    publishedAt: "2026-11-11",
    updatedAt: "2026-11-11",
    introduction: "Quando o ar-condicionado liga, mas não resfria o ambiente, a causa não pode ser determinada apenas pela sensação de temperatura. Configuração inadequada, filtro obstruído, ambiente muito quente, falha elétrica ou necessidade de manutenção são possibilidades diferentes. Este guia traz observações externas e seguras para organizar a solicitação. Reparos elétricos, circuitos de refrigerante e limpeza interna exigem profissional capacitado.",
    sections: [
      {
        heading: "Confira o modo escolhido e as condições do ambiente",
        paragraphs: [
          "Veja se o controle remoto está no modo de resfriamento, quando disponível, e se a temperatura selecionada é inferior à temperatura percebida no ambiente. Modo ventilação apenas movimenta o ar e não oferece o mesmo efeito de resfriamento. Aguarde o tempo recomendado pelo fabricante para avaliar o funcionamento, sem alternar repetidamente entre liga e desliga.",
          "Considere janelas abertas, incidência direta de sol, muitas pessoas no cômodo e portas que ficam abertas. Esses fatores podem dificultar a climatização mesmo quando o equipamento funciona. Anote em que horários o problema aparece e se ocorre em um cômodo específico. Não use essas observações para afirmar que a capacidade do aparelho é suficiente ou insuficiente sem avaliação técnica."
        ],
        checklist: [
          "Modo de funcionamento indicado no controle ou no painel.",
          "Temperatura programada e tempo de funcionamento observado.",
          "Portas, janelas e fontes de calor no ambiente.",
          "Se o problema ocorre sempre ou apenas em alguns horários."
        ]
      },
      {
        heading: "Observe os filtros e a circulação de ar",
        paragraphs: [
          "Filtros sujos podem reduzir a passagem de ar e prejudicar o desempenho. Consulte exclusivamente o manual do seu modelo antes de tentar remover um filtro acessível ao usuário. Se o fabricante permitir limpeza simples, desligue o aparelho pelo procedimento indicado e siga as instruções; não utilize produtos químicos ou água em componentes elétricos.",
          "Verifique visualmente se há objetos, cortinas ou móveis bloqueando a entrada ou a saída de ar. Observe se o jato de ar está muito fraco em comparação ao funcionamento habitual. Não coloque ferramentas, dedos ou objetos nas aletas, não abra painéis técnicos e não tente alcançar partes internas da evaporadora ou condensadora."
        ],
        checklist: [
          "Condições visíveis de filtros acessíveis conforme o manual.",
          "Entrada e saída de ar livres de obstáculos.",
          "Alterações perceptíveis na ventilação habitual.",
          "Necessidade de limpeza profissional quando houver sujeira interna."
        ]
      },
      {
        heading: "Reconheça sinais de falha que exigem assistência",
        paragraphs: [
          "Ruídos incomuns, odor de queimado, desarme de disjuntor, água escorrendo em local inadequado e formação persistente de gelo são sinais para interromper o uso e procurar avaliação. Não tente descongelar componentes com calor intenso, romper tubulações ou improvisar ligações elétricas. Se houver risco de choque ou incêndio, mantenha distância e peça ajuda apropriada.",
          "Apenas um técnico qualificado pode verificar com segurança componentes elétricos e o circuito de refrigeração. Não há motivo para completar gás refrigerante por tentativa: eventual vazamento deve ser identificado e tratado conforme normas e procedimentos. A reposição indiscriminada pode não solucionar a falha e oferece riscos ambientais e operacionais."
        ]
      },
      {
        heading: "Organize o histórico para facilitar o diagnóstico",
        paragraphs: [
          "Anote marca, modelo e capacidade nominal se constarem da identificação visível, além do tempo aproximado de instalação e da última manutenção conhecida. Informe se houve queda de energia, obra, reforma, mudança de local ou limpeza recente. Não remova tampas apenas para localizar uma etiqueta e não divulgue números de série completos ou dados de acesso em campos públicos.",
          "Diga se o equipamento liga normalmente, se o ventilador gira e se a falha foi súbita ou gradual. Em equipamentos de uso comercial, siga regras internas e comunique o responsável pela manutenção antes de testar. Essas informações não substituem medição nem diagnóstico, mas ajudam o profissional a chegar preparado."
        ],
        checklist: [
          "Marca e modelo identificados sem desmontagem.",
          "Histórico de manutenção ou limpeza, quando conhecido.",
          "Quando a falha começou e se houve evento anterior.",
          "Fotos externas seguras, sem mostrar detalhes privados do imóvel."
        ]
      },
      {
        heading: "Solicite um orçamento claro e um serviço seguro",
        paragraphs: [
          "Descreva a ausência de resfriamento, a intensidade do fluxo de ar, a localidade e a urgência. Pergunte o que está incluído na visita de diagnóstico e quais serviços dependerão de orçamento adicional. Acesso à unidade externa, trabalho em altura, materiais, equipamentos de segurança e eventual deslocamento precisam ser discutidos antes da execução.",
          "Confirme a habilitação adequada do profissional para atividades elétricas e de refrigeração, as recomendações do fabricante e o tratamento ambiental do refrigerante quando houver intervenção. Peça registro do serviço e esclarecimento da garantia contratada. O portal organiza perfis e pedidos; ele não pode antecipar a causa, o preço ou a disponibilidade."
        ]
      }
    ],
    finalAdvice: "Selecione Climatização e informe cidade, modelo do aparelho e sintomas observados. Use o atendimento guiado para registrar a solicitação; somente um profissional habilitado poderá confirmar o diagnóstico e os procedimentos indicados."
  },


  {
    slug: "wifi-caindo-sinal-fraco-como-identificar",
    title: "Wi-Fi caindo ou sinal fraco: como identificar o problema antes de chamar um técnico",
    description: "Um roteiro seguro para diferenciar falhas do roteador, da cobertura e da operadora, registrar sintomas e preparar um atendimento de redes.",
    categorySlug: "redes",
    categoryName: "Redes e conectividade",
    publishedAt: "2026-11-11",
    updatedAt: "2026-11-11",
    introduction: "Quando o Wi-Fi cai, nem sempre o motivo é a velocidade contratada: o problema pode estar na conexão com a operadora, na cobertura dentro do imóvel, em um aparelho específico ou no próprio roteador. O objetivo deste guia é ajudar você a observar o comportamento da rede e explicar a situação ao profissional sem alterar configurações avançadas ou expor senhas.",
    sections: [
      {
        heading: "Descubra se é a internet ou somente o Wi-Fi",
        paragraphs: [
          "Observe se os dispositivos continuam conectados ao nome da rede, mas mostram a mensagem de sem internet, ou se deixam de enxergar o Wi-Fi completamente. São situações distintas. Se um computador com cabo de rede funciona enquanto celulares próximos ao roteador perdem a conexão sem fio, isso pode indicar que a falha não atinge toda a ligação externa.",
          "Teste dois aparelhos confiáveis no mesmo ambiente, em horários parecidos, e registre se a falha aparece em ambos. Não é necessário instalar aplicativos desconhecidos para fazer a comparação. Se toda a região parece sem internet e a operadora informou uma interrupção, aguarde as orientações oficiais antes de substituir equipamentos."
        ],
        checklist: [
          "A rede sem fio desaparece ou permanece visível sem acesso à internet?",
          "A falha acontece em todos os dispositivos ou só em um?",
          "Um equipamento conectado por cabo também apresenta instabilidade?",
          "Existe aviso de manutenção ou indisponibilidade da operadora?"
        ]
      },
      {
        heading: "Mapeie os ambientes onde o sinal piora",
        paragraphs: [
          "Caminhe pelos cômodos e observe onde a conexão deixa de funcionar ou passa a oscilar. Paredes, lajes, móveis metálicos e a distância do roteador podem influenciar a cobertura. Uma rede que funciona ao lado do equipamento, mas falha em um quarto distante, pede uma investigação diferente de uma rede que cai em qualquer ponto da casa.",
          "Anote os ambientes mais afetados, sem publicar sua localização residencial completa. Para casas maiores ou espaços comerciais, informe quantos pavimentos precisam de sinal, se há cabeamento e se existem repetidores ou pontos de acesso adicionais. O melhor posicionamento depende do ambiente real, não de uma regra única."
        ],
        checklist: [
          "Cômodos com sinal estável e cômodos com interrupções.",
          "Quantidade de andares e obstáculos relevantes.",
          "Presença de repetidores, roteadores adicionais ou cabeamento existente."
        ]
      },
      {
        heading: "Faça verificações básicas sem perder as configurações",
        paragraphs: [
          "Confira se os cabos visíveis estão bem encaixados e se o equipamento não está coberto por objetos que obstruam a ventilação. Consulte os indicadores luminosos e o manual do roteador. Reiniciar pelo procedimento recomendado pode ajudar a observar o comportamento, mas não repita a ação muitas vezes quando a operadora estiver atualizando ou diagnosticando a linha.",
          "Evite pressionar o botão de restauração de fábrica como tentativa inicial: ele pode apagar nome de rede, senha e parâmetros necessários à conexão. Também não compartilhe senha de administração, código de acesso da operadora nem fotografias de etiquetas que exponham credenciais. Em redes de empresas, siga a orientação da equipe responsável."
        ]
      },
      {
        heading: "Entenda quando o equipamento precisa de avaliação",
        paragraphs: [
          "Desconexões frequentes, aquecimento incomum, fontes de alimentação danificadas e queda recorrente no mesmo horário merecem avaliação. Não abra fontes elétricas nem faça reparos improvisados. Se houver cheiro de queimado, fumaça ou cabo danificado, interrompa o uso em segurança e procure suporte adequado.",
          "Trocar o roteador por um modelo mais caro nem sempre corrige uma interferência, um cabeamento defeituoso ou problemas da operadora. Peça diagnóstico do cenário antes de aprovar equipamentos adicionais. Testes de velocidade isolados não comprovam cobertura integral do imóvel nem estabilidade ao longo do dia."
        ],
        checklist: [
          "Modelo do roteador e equipamentos adicionais, sem dados de acesso.",
          "Quando começaram as falhas e em quais horários acontecem.",
          "Comportamento das luzes de status e aquecimento observado.",
          "Se houve obra, mudança de plano ou inclusão de novos dispositivos."
        ]
      },
      {
        heading: "Prepare um pedido de atendimento de redes completo",
        paragraphs: [
          "Explique em quais cômodos o Wi-Fi falha, quantos aparelhos são afetados, se a internet por cabo funciona e quais tentativas seguras já foram realizadas. Informe a cidade e o bairro aproximado para consultar profissionais que declaram atuar na região. Não envie senhas, CPF ou endereço residencial completo em campos públicos.",
          "Peça ao prestador que esclareça o escopo: avaliação da rede, eventual reposicionamento de equipamentos, passagem de cabos, configuração, documentação e suporte. Confirme custos de deslocamento e peças antes de autorizar serviço. A presença no diretório não garante competência, disponibilidade ou solução antecipada."
        ]
      }
    ],
    finalAdvice: "Abra a busca por Redes e conectividade, informe sua localidade e descreva onde o sinal falha. O funil encaminha a necessidade de forma organizada, sem expor senhas ou contatos privados dos técnicos."
  },
  {
    slug: "impressora-offline-fila-travada-o-que-fazer",
    title: "Impressora offline ou fila travada: verificações seguras antes de solicitar suporte",
    description: "Aprenda a distinguir problemas de conexão, papel, fila de impressão e drivers sem apagar configurações ou comprometer documentos.",
    categorySlug: "impressoras",
    categoryName: "Impressoras",
    publishedAt: "2026-11-11",
    updatedAt: "2026-11-11",
    introduction: "Uma impressora pode aparecer como offline mesmo estando ligada. A causa pode envolver rede, cabo, fila de trabalhos, papel, configuração do computador ou falha mecânica. Em vez de reinstalar tudo imediatamente, organize os sintomas com estas verificações simples e de baixo risco.",
    sections: [
      {
        heading: "Identifique o que o equipamento está informando",
        paragraphs: [
          "Confira o visor e os avisos do computador. Diferencie mensagens como sem papel, tampa aberta, atolamento, tinta ou toner insuficiente e indisponibilidade de conexão. Se a impressora apresenta um erro físico, apenas reiniciar o programa provavelmente não resolverá a causa.",
          "Anote a marca, o modelo e o código de erro exibido, se houver. Evite publicar números de série completos ou fotografias de documentos na bandeja. Se o aparelho fizer ruídos anormais ou apresentar cheiro de queimado, interrompa o uso e procure um profissional."
        ],
        checklist: [
          "Mensagem ou código de erro exatamente como aparece.",
          "Indicadores de papel, porta, toner ou tinta.",
          "Se o defeito ocorre ao copiar, digitalizar ou apenas imprimir.",
          "Se existe barulho incomum, aquecimento ou risco elétrico."
        ]
      },
      {
        heading: "Verifique a conexão USB, rede ou Wi-Fi",
        paragraphs: [
          "Se a impressora usa cabo USB, confira a conexão física sem forçar o conector. Se imprime pela rede, observe se o equipamento está associado à mesma rede autorizada do computador. Uma impressora pode estar ligada e pronta localmente, mas inacessível a um computador após mudança de roteador ou senha Wi-Fi.",
          "Compare o comportamento de dois computadores ou de uma função de impressão nativa já configurada. Isso ajuda a distinguir falha do equipamento de problema em um dispositivo. Evite alterar configurações de IP e roteador sem conhecer o ambiente, especialmente em escritórios com várias estações."
        ],
        checklist: [
          "Tipo de conexão usada: USB, cabo de rede ou Wi-Fi.",
          "Se outros computadores conseguem imprimir.",
          "Se houve troca recente do roteador ou da rede.",
          "Se a função de cópia local funciona, quando existente."
        ]
      },
      {
        heading: "Cuide da fila sem perder documentos importantes",
        paragraphs: [
          "Abra a fila de impressão do sistema operacional e confira se há trabalhos pausados, duplicados ou presos em processamento. Se o documento contém informação confidencial, avalie cuidadosamente antes de reenviá-lo; cópias podem ficar na fila ou sair quando o problema for resolvido.",
          "Se optar por cancelar um trabalho, confirme que não é de outra pessoa e que você possui uma cópia do documento. Não apague pastas do sistema nem interrompa serviços essenciais sem orientação. Em empresas, comunique ao responsável antes de limpar filas compartilhadas."
        ]
      },
      {
        heading: "Avalie papel, suprimentos e manutenção sem improvisos",
        paragraphs: [
          "Confira se o papel colocado corresponde ao formato selecionado e se as guias estão ajustadas sem pressionar a pilha. Ao encontrar papel preso, siga somente o procedimento previsto no manual para o seu modelo e evite puxar folhas com força, pois isso pode danificar sensores ou engrenagens.",
          "Tinta e toner exigem cuidados específicos; não tente misturar produtos ou abrir cartuchos pressurizados. Se houver vazamento, procure as orientações do fabricante. Manchas repetidas, folhas saindo em branco e atolamentos recorrentes podem exigir inspeção técnica e não necessariamente compra imediata de outra impressora."
        ],
        checklist: [
          "Tipo e formato do papel usado.",
          "Ocorrência e localização aparente de atolamentos.",
          "Qualidade das últimas impressões: manchas, falhas ou páginas em branco.",
          "Estado indicado dos suprimentos, se disponível no painel."
        ]
      },
      {
        heading: "Como explicar a falha e pedir orçamento",
        paragraphs: [
          "Descreva qual documento não imprime, se o problema atinge todos os computadores, que mensagem aparece e desde quando ocorre. Informe se é uma impressora de casa ou compartilhada em escritório, sua cidade aproximada e se o diagnóstico pode depender de acesso à rede local.",
          "Confirme se o atendimento inclui avaliação, configuração, testes de página, limpeza, peças e deslocamento. Peça autorização antes da substituição de componentes. Nunca compartilhe senhas administrativas, documentos confidenciais nem acesso remoto irrestrito para tentar resolver uma fila travada."
        ]
      }
    ],
    finalAdvice: "Selecione a especialidade Impressoras, descreva a mensagem exibida e informe a cidade. O pedido pode ser registrado no funil, com orientação da equipe e contatos dos profissionais protegidos."
  },

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

/** Relações editoriais específicas, sem backlinks automáticos para domínios externos. */
const RELATED_GUIDES: Record<string, readonly string[]> = {
  "backup-arquivos-antes-manutencao-computador": ["computador-lento-o-que-verificar"],
  "ar-condicionado-nao-gela-verificacoes-seguras": ["instalacao-cameras-seguranca-como-planejar"],
  "computador-lento-o-que-verificar": ["backup-arquivos-antes-manutencao-computador"],
  "instalacao-cameras-seguranca-como-planejar": ["ar-condicionado-nao-gela-verificacoes-seguras"],
  "wifi-caindo-sinal-fraco-como-identificar": ["computador-lento-o-que-verificar"],
  "impressora-offline-fila-travada-o-que-fazer": ["wifi-caindo-sinal-fraco-como-identificar"],
};

export function getRelatedGuides(slug: string): readonly PublicGuide[] {
  return (RELATED_GUIDES[slug] ?? [])
    .map(related => getPublishedGuide(related))
    .filter((guide): guide is PublicGuide => guide !== null && guide.slug !== slug);
}

export const GUIDE_PATHS = [
  "/guias",
  ...GUIDES.map(guide => "/guias/" + guide.slug),
] as const;
