import { createFileRoute } from "@tanstack/react-router";
import { TextPage, TextSection, pageHead } from "../components/text-page";

// Texto original de encontreumtecnico.com/politica-de-privacidade
const INTRO: string[] = ["Esta Política de Privacidade (“Política”), tem como objetivo informá-lo (“Usuário”) sobre o modo como nós, Ping Soluções / Preciso de um Técnico, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 41.723.708/0001-58 (“Ping Soluções”), utilizamos os dados pessoais e informações coletadas (“Dados”) em nosso site https://www.precisodeumtecnico.com/, além de como eles são tratados, em que situações são compartilhados e quando são excluídos.", "Esta Política se aplica às informações e dados coletados por meio de nosso site, bem como informações oriundas de formulários disponibilizados por nós e redes sociais próprias. Assim, esta política não se aplica a links, produtos, serviços, sites, redes sociais, ou qualquer outro tipo de acesso fora de nossa página de propriedade de terceiros, visto que não controlamos ou fazemos qualquer tipo de gestão dos dados e informações coletadas nessas condições.", "Nossas práticas e Política de Privacidade são atualizadas e aprimoradas com o tempo e as atualizações desta Política entrarão em vigor no momento da sua publicação em nosso site, sendo necessária a sua consulta de tempos em tempos para verificar suas atualizações, e se você continuar usando o nossas plataformas após a publicação de uma versão atualizada da Política, sua aceitação será presumida", "Se possuir cadastro em nosso site, enviaremos para você um aviso informando da atualização de nossa Política de Privacidade."];
const SECTIONS: { title: string; paragraphs: string[] }[] = [
 {
  "title": "1. DEFINIÇÕES",
  "paragraphs": [
   "Para os fins desta Política de Privacidade:",
   "a. “Usuário”: significa toda pessoa física que utilizará ou visitará o(s) Site(s) e/ou Plataforma(s) da Ping Soluções, maior de 18 (dezoito) anos ou emancipada e totalmente capaz de praticar os atos da vida civil ou o absolutamente ou relativamente incapaz devidamente representado ou assistido;",
   "b. “Plataforma”: significa todo o aparato de ensino e suporte oferecido ao Usuário, de forma remota ou presencial, incluindo sites, cursos dos programas de formação, materiais didáticos e a rede de atendimento e relacionamento com os Usuários;",
   "c. “Dados Pessoais”: significa qualquer informação que, direta ou indiretamente, identifique ou possa identificar uma pessoa natural, como por exemplo, nome, CPF, data de nascimento, endereço IP, dentre outros;",
   "d. “Dados Pessoais Sensíveis”: significa qualquer informação que revele, em relação a uma pessoa natural, origem racial ou étnica, convicção religiosa, opinião política, filiação a sindicato ou a organização de caráter religioso, filosófico ou político, dado referente à saúde ou à vida sexual, dado genético ou biométrico;",
   "e. “Tratamento de Dados Pessoais”: significa qualquer operação efetuada no âmbito dos Dados Pessoais, por meio de meios automáticos ou não, tal como a recolha, gravação, organização, estruturação, armazenamento, adaptação ou alteração, recuperação, consulta, utilização, divulgação por transmissão, disseminação ou, alternativamente, disponibilização, harmonização ou associação, restrição, eliminação ou destruição. Também é considerado Tratamento de Dados Pessoais qualquer outra operação prevista nos termos da legislação aplicável;",
   "f. “Leis de Proteção de Dados”: significa todas as disposições legais que regulam o Tratamento de Dados Pessoais, incluindo, porém sem se limitar, a Lei nº 13.709/18, Lei Geral de Proteção de Dados Pessoais (“LGPD”)."
  ]
 },
 {
  "title": "2. CONSENTIMENTO",
  "paragraphs": [
   "Para os fins desta Política de Privacidade:",
   "Ao acessar o site, você deverá ler o conteúdo desta Política. Se estiver de acordo com as condições apresentadas nesta Política e quiser utilizar a Plataforma, precisará manifestar o seu consentimento por meio da seleção da caixa de seleção (checkbox) correspondente à opção “Li e concordo com a Política de Privacidade”. Esse consentimento poderá ser cancelado a qualquer momento, por meio do e-mail dpo@encontreumtecnico.com.",
   "Cancelando o seu consentimento, você compreende que isso poderá restringir ou suspender o seu acesso ao site, bem como serviços, informações e oportunidades enviadas pela Ping Soluções.",
   "Assim que a Ping Soluções receber sua solicitação de cancelamento, seus Dados serão excluídos, exceto nos casos em que o seu armazenamento seja obrigatório por lei.",
   "Atenção: Ao selecionar o checkbox correspondente à opção “Li e concordo com a Política de Privacidade”, você fornece o seu consentimento para que a Ping Soluções e seus eventuais parceiros tratem seus dados coletados por meio da plataforma, inclusive eventuais dados sensíveis, para as finalidades descritas nesta política."
  ]
 },
 {
  "title": "3. DADOS COLETADOS",
  "paragraphs": [
   "O cadastramento é uma forma consentida e voluntária de coleta e armazenamento dos seguintes dados pessoais:",
   "a. Nome completo – precisamos saber com quem estamos falando e como podemos lhe chamar;",
   "b. Data de nascimento – podemos formar turmas para faixas etárias específicas, além de nos ajudar a entender a melhor forma de interação e aprendizado;",
   "c. País de origem – podemos formar turmas para pessoas que possuem origem em um determinado País, conforme alguns programas desenvolvidos com parceiros;",
   "d. Gênero – podemos formar turmas para gêneros específicos, conforme alguns programas desenvolvidos com parceiros;",
   "e. Estado onde vive – nos possibilita saber onde estão as pessoas interessadas em nossas oportunidades para buscar parceiros locais para melhor atender as suas necessidades (sejam oportunidades profissionais, educacionais ou mesmo possibilitar uma infraestrutura de apoio local), além de podermos formar cursos presenciais e/ou destinados a uma determinada região, e isso inclui a cidade em que você vive também;",
   "f. Cidade onde vive;",
   "g. Número de telefone – precisamos ter uma forma de contato com você e isso inclui também o endereço de e-mail;",
   "h. Endereço de e-mail;",
   "A Ping Soluções também coleta alguns Dados automaticamente quando o Usuário acessa e usa a Plataforma, tais como:",
   "a. características do dispositivo de acesso;",
   "b. cookies de navegação;",
   "c. protocolo de Internet (IP, data, hora, minuto e segundo);",
   "d. manifestações e comentários feitos pelos Usuários nos fóruns de dúvida, salas de aula e/ou demais caixas de diálogo disponíveis nas plataformas da Ping Soluções.",
   "Poderão ser oferecidos pela Ping Soluções, ainda, espaços de interação entre Usuários e instrutores, professores, assistentes ou demais representantes da Ping Soluções, nos quais poderão ser compartilhados textos, dúvidas e opiniões, tais como grupos de discussões e salas de bate-papo. Ao se utilizar desses serviços, o Usuário poderá estar enviando Dados à Ping Soluções e demais Usuários que tenham acesso ao conteúdo divulgado."
  ]
 },
 {
  "title": "4. TRATAMENTOS DOS DADOS",
  "paragraphs": [
   "Os Dados que coletamos dos Usuários são arquivados em nossa base de dados e tratados para:",
   "a. cadastrar o Usuário e fornecer avisos sobre o seu cadastro;",
   "b. disponibilizar o acesso à Plataforma, seus conteúdos e recursos interativos ao Usuário;",
   "c. personalizar e adequar o aprendizado do Usuário;",
   "d. comunicar-se com Usuário e responder suas comunicações;",
   "e. notificar o Usuário sobre atualizações de políticas e termos, bem como de quaisquer serviços oferecidos pela Ping Soluções;",
   "f. realizar obrigações e exercer os direitos da Ping Soluções decorrentes de quaisquer relações jurídicas entre ela e o Usuário;",
   "g. melhorar a qualidade dos serviços por meio da análise das características e do comportamento coletivos dos Usuários na Plataforma;",
   "h. administrar cursos, provas, testes, avaliações, exercícios, projetos e outras atividades por meio da Plataforma;",
   "i. compartilhar informações de desempenho do Usuário em cursos, provas, testes, avaliações, exercícios, projetos, outras atividades e outros serviços da Plataforma com os instrutores, professores, assistentes ou com indivíduos designados pela Ping Soluções para auxiliar na criação, modificação ou operação das atividades da Plataforma;",
   "j. mapear cursos e demais atividades ou serviços ofertados na Plataforma que o Usuário acessou;",
   "k. permitir o envio de material promocional e publicitário sobre os serviços e eventos da Ping Soluções que possam ser de interesse do Usuário;",
   "l. e qualquer outro propósito, desde que com o consentimento prévio do Usuário.",
   "O tratamento de dados pessoais para finalidades não previstas nesta Política de Privacidade somente ocorrerá mediante comunicação prévia ao Usuário, de modo que os direitos e obrigações aqui previstos permanecem aplicáveis."
  ]
 },
 {
  "title": "5. COMPARTILHAMENTO DE DADOS",
  "paragraphs": [
   "Nos limites exigidos e autorizados pelas Leis de Proteção de Dados, a Ping Soluções poderá compartilhar os Dados Pessoais coletados a terceiros nas seguintes situações:",
   "a. com empresas parceiras da Ping Soluções, (i) para fins de cadastramento do Usuário em oportunidades profissionais, de acordo com seu perfil, bem como (ii) para avaliar os serviços e melhorar o seu oferecimento pela Ping Soluções;",
   "b. sempre que necessário às atividades comerciais da Ping Soluções e/ou aos propósitos administrativos como pesquisa, planejamento, desenvolvimento de serviços, segurança e gerenciamento de risco;",
   "c. no caso de transações e alterações societárias envolvendo a Ping Soluções, hipótese em que a transferência das informações será necessária para a continuidade dos serviços;",
   "d. com autoridades governamentais (i) para tomar medidas judiciais e administrativas para defender os interesses da Ping Soluções em qualquer tipo de conflito, incluindo ações judiciais, e/ou (ii) para cumprir determinações legais, judiciais e administrativas e também cumprir ofícios de autoridades."
  ]
 },
 {
  "title": "6. DADOS DE MENORES DE IDADE",
  "paragraphs": [
   "Todos os Usuários deverão informar a sua data de nascimento no momento de cadastro na Plataforma. Nós não tratamos intencionalmente de Dados Pessoais de menores de 18 (dezoito) anos sem o prévio e verificável consentimento dos pais ou responsáveis, nem tampouco por meio de outra base legal disponível.",
   "Portanto, aos menores de idade, que assim tenham se declarado, é obrigatório o consentimento dos seus responsáveis a ser encaminhado para dpo@encontreumtecnico.com.",
   "De igual forma, caso você seja responsável por um menor de idade e suspeite que ele esteja acessando a Plataforma e/ou se utilizando dos serviços sem o seu consentimento, por favor, envie um comunicado ao nosso e-mail acima indicado."
  ]
 },
 {
  "title": "7. COOKIES",
  "paragraphs": [
   "Ao acessar nossa Plataforma, cookies ou tecnologias semelhantes poderão verificar sua conta e determinar quando você está conectado. Cookies são pequenos arquivos usados para armazenar informações em navegadores da Web e servem para reconhecer, acompanhar e armazenar a navegação do usuário na Internet.",
   "Você pode alterar as configurações do seu navegador para bloquear cookies ou gerenciar o seu uso, bloqueando cookies de todos os sites ou de sites específicos. É possível que o funcionamento da Plataforma e parte ou a totalidade dos serviços ofertados pela Ping Soluções sejam prejudicados por tal bloqueio. Consulte as instruções do seu navegador para saber mais como configurar o uso de cookies."
  ]
 },
 {
  "title": "8. LINKS DE TERCEIROS",
  "paragraphs": [
   "Para a conveniência do Usuário, nossa plataforma pode conter serviços e produtos oferecidos por terceiros e/ou hiperlinks para sites ou serviços de parceiros, anunciantes e outros.",
   "As partes não têm controle ou influência sobre o conteúdo, sites ou serviços desses terceiros. Políticas de privacidade diferentes podem ser aplicadas ao uso de sites e serviços de terceiros. Esta Política de Privacidade se refere apenas aos dados pessoais que tenham sido obtidos por meio da utilização da Plataforma para os seus próprios fins. A Ping Soluções não possui qualquer responsabilidade pelo conteúdo, práticas ou operação de sites e serviços de terceiros."
  ]
 },
 {
  "title": "9. ARMAZENAMENTOS DE DADOS",
  "paragraphs": [
   "Os Dados Pessoais do Usuário são armazenados pela Ping Soluções durante o período necessário para a prestação do serviço ou o cumprimento das finalidades previstas no presente documento.",
   "O armazenamento se dará em servidores próprios da Ping Soluções ou por ela contratados, que podem estar localizados no Brasil ou em território estrangeiro. Por isso, o Usuário consente que seus Dados sejam transferidos, armazenados e tratados internacionalmente.",
   "Adotamos medidas técnicas e organizativas aptas a proteger os Dados Pessoais de acessos não autorizados e de situações de destruição, perda, alteração, comunicação ou difusão, tais como:",
   "a. métodos e ferramentas de criptografia e proteção dos Dados coletados;",
   "b. software de proteção contra acesso não autorizado aos nossos sistemas;",
   "c. sistema de controle de acesso aos Dados para que somente as pessoas previamente autorizadas tenham acesso a eles, com finalidades específicas;",
   "d. políticas internas de conformidade para assegurar o sigilo e a responsabilidade de seus colaboradores no tratamento dos Dados.",
   "A Ping Soluções se esforça para que não ocorra qualquer incidente de segurança com os seus Dados. No entanto, como nenhuma transmissão de Dados pela Internet é integralmente segura, são possíveis falhas nos mecanismos de proteção. Neste caso, serão adotadas todas as medidas legalmente exigidas para a proteção dos Dados do Usuário, que será notificado do ocorrido, assim como o órgão/agência regulador aplicável."
  ]
 },
 {
  "title": "10. ELIMINAÇÃO DE DADOS",
  "paragraphs": [
   "A Ping Soluções deverá excluir os Dados dos Usuários quando: (i) a finalidade para a qual o Dado foi coletado tenha sido alcançada ou quando os Dados deixarem de ser necessários para o alcance desta finalidade; (ii) quando houver a cancelamento do consentimento dado pelo Usuário para tratamento dos seus Dados; ou (iii) mediante determinação de autoridade competente.",
   "O Usuário poderá solicitar a exclusão dos seus Dados Pessoais por meio de contato com a Ping Soluções pelo e-mail dpo@encontreumtecnico.com, estando ciente, entretanto, de que o acesso à Plataforma poderá ficar impossibilitado diante da ausência de tais Dados. A Ping Soluções reserva para si o direito de manter armazenados todos os Dados necessários ao cumprimento da legislação brasileira vigente, mesmo em caso de requisição de sua exclusão."
  ]
 },
 {
  "title": "11. DIREITOS DO USUÁRIO",
  "paragraphs": [
   "Nos termos da legislação aplicável, o titular do dado poderá a qualquer tempo solicitar:",
   "a. a confirmação da existência de tratamento de seus Dados e o acesso aos seus Dados coletados por meio da Plataforma;",
   "b. a correção de seus Dados, caso estes estejam incompletos, inexatos ou desatualizados;",
   "c. a anonimização, o bloqueio ou a eliminação de Dados desnecessários, excessivos ou tratados em desconformidade com a legislação brasileira aplicável, conforme os recursos técnicos disponíveis à Ping Soluções;",
   "d. a portabilidade de seus Dados, para si ou para terceiro;",
   "e. a eliminação dos Dados tratados com o seu consentimento, desde que não exista hipótese legal de permissão para conservá-los;",
   "f. obtenção de informações sobre entidades públicas ou privadas com as quais a Ping Soluções compartilhou seus Dados;",
   "g. e informações sobre a possibilidade de não fornecer o seu consentimento ao tratamento dos Dados, bem como de ser informado sobre suas consequências, em caso de negativa.",
   "Para que o Usuário exerça estes direitos, basta dirigir o pedido escrito ao e-mail dpo@encontreumtecnico.com"
  ]
 },
 {
  "title": "12. FORO COMPETENTE",
  "paragraphs": [
   "Essa Política de Privacidade será regida, interpretada e executada de acordo com as leis do Brasil, independentemente dos conflitos dessas leis com leis de outros estados ou países, sendo competente o Foro da Comarca do Rio de Janeiro para julgar qualquer controvérsia decorrente desta Política. O Usuário consente, expressamente, com a competência desse juízo e renuncia, neste ato, à competência de qualquer outro, por mais privilegiado que seja ou venha a ser."
  ]
 },
 {
  "title": "13. NOSSO CONTATO",
  "paragraphs": [
   "Se você tiver quaisquer outras dúvidas sobre nossos avisos, proteção de dados e como usamos seus dados pessoais, você também poderá entrar em contato conosco, a qualquer momento, pelo e-mail dpo@encontreumtecnico.com",
   "A Ping Soluções – Henrique Rodrigues o Líder de Privacidade/Encarregado pelo tratamento de dados pessoais, e ele pode ser contatado pelo e-mail dpo@encontreumtecnico.com."
  ]
 }
];

export const Route = createFileRoute("/privacidade")({
  head: () => pageHead("Política de privacidade", "Como a Ping Soluções / Encontre um Técnico coleta, usa e protege seus dados pessoais, conforme a LGPD."),
  component: () => (
    <TextPage title="Política de privacidade" intro="Como tratamos seus dados pessoais, conforme a LGPD.">
      <TextSection title="Apresentação">
        {INTRO.map((p, i) => <p key={i}>{p}</p>)}
      </TextSection>
      {SECTIONS.map((s) => (
        <TextSection key={s.title} title={s.title}>
          {s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </TextSection>
      ))}
    </TextPage>
  ),
});
