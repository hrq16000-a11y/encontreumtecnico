import { createFileRoute, Link } from "@tanstack/react-router";
import { TextPage, TextSection, pageHead } from "../components/text-page";

export const Route = createFileRoute("/contato")({
  head: () => pageHead("Contato", "Fale com a equipe do Encontre um Técnico."),
  component: () => (
    <TextPage title="Contato" intro="Fale com a equipe do portal.">
      <TextSection title="Antes de escrever">
        <p>
          Muitas respostas já estão nas{" "}
          <Link to="/faq" className="text-primary underline">perguntas frequentes</Link>.
        </p>
      </TextSection>
      <TextSection title="Formulário de contato">
        <p>
          O formulário será ativado quando o armazenamento das mensagens estiver pronto, para que nenhum contato se perca.
        </p>
      </TextSection>
    </TextPage>
  ),
});
