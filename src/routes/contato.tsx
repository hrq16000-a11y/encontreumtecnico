import { createFileRoute, Link } from "@tanstack/react-router";
import { ContactForm } from "../components/contact-form";
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
      <TextSection title="Informações de contato">
        <p>
          Telefone / WhatsApp:{" "}
          <a href="tel:+5541997452053" className="text-primary underline">(41) 9 9745-2053</a>
        </p>
        <p>
          Privacidade e dados pessoais:{" "}
          <a href="mailto:dpo@encontreumtecnico.com" className="text-primary underline">dpo@encontreumtecnico.com</a>
        </p>
      </TextSection>
      <TextSection title="Formulário de contato">
        <ContactForm />
      </TextSection>
    </TextPage>
  ),
});
