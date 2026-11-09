import { createFileRoute } from "@tanstack/react-router";
import { TextPage, TextSection, pageHead } from "../components/text-page";

export const Route = createFileRoute("/termos")({
  head: () => pageHead("Termos de uso", "Condições de uso do portal Encontre um Técnico."),
  component: () => (
    <TextPage title="Termos de uso" intro="Condições para usar o portal.">
      <TextSection title="1. O serviço">
        <p>O portal aproxima clientes e técnicos. O serviço técnico é combinado diretamente entre as partes.</p>
      </TextSection>
      <TextSection title="2. Cadastro">
        <p>As informações fornecidas devem ser verdadeiras. Perfis de técnicos passam por aprovação antes de serem publicados.</p>
      </TextSection>
      <TextSection title="3. Conduta">
        <p>É proibido publicar conteúdo falso, ofensivo ou que viole direitos de terceiros. Cadastros podem ser suspensos.</p>
      </TextSection>
      <TextSection title="4. Alterações">
        <p>Estes termos podem ser atualizados; a versão vigente estará sempre nesta página.</p>
      </TextSection>
    </TextPage>
  ),
});
