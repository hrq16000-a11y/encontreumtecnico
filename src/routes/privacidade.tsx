import { createFileRoute } from "@tanstack/react-router";
import { TextPage, TextSection, pageHead } from "../components/text-page";

export const Route = createFileRoute("/privacidade")({
  head: () => pageHead("Política de privacidade", "Como o Encontre um Técnico trata seus dados pessoais, conforme a LGPD."),
  component: () => (
    <TextPage title="Política de privacidade" intro="Como tratamos seus dados, conforme a LGPD.">
      <TextSection title="Dados coletados">
        <p>Nome, e-mail e informações de perfil fornecidas no cadastro, além das solicitações de atendimento.</p>
      </TextSection>
      <TextSection title="Uso dos dados">
        <p>Usamos os dados para operar o portal, conectar clientes e técnicos e melhorar o serviço.</p>
      </TextSection>
      <TextSection title="Compartilhamento">
        <p>Dados pessoais não são divulgados sem sua autorização.</p>
      </TextSection>
      <TextSection title="Seus direitos">
        <p>Você pode pedir acesso, correção ou exclusão dos seus dados pela página de contato.</p>
      </TextSection>
    </TextPage>
  ),
});
