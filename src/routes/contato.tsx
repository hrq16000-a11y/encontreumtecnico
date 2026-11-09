import { createFileRoute, Link } from "@tanstack/react-router";
import { ContactForm } from "@/components/contact-form";
import { TextPage, TextSection, pageHead } from "@/components/text-page";

export const Route = createFileRoute("/contato")({
  head: () => pageHead("Contato e atendimento", "Canais para dúvidas sobre o portal, privacidade, cobrança e suporte ao acesso."),
  component: () => (
    <TextPage title="Contato e atendimento" intro="Atendimento sobre a plataforma, seus dados e seus direitos.">
      <TextSection title="Dúvidas e pedidos de privacidade">
        <p>
          Solicitações de acesso a dados, correções, segurança, reclamações de consumo sobre o serviço digital e dúvidas
          de pagamento podem ser feitas sem adquirir o contato de um prestador.
        </p>
        <p>Canal de privacidade: <a href="mailto:dpo@encontreumtecnico.com" className="font-medium text-primary underline">dpo@encontreumtecnico.com</a>.</p>
        <p>
          Consulte também as <Link to="/faq" className="font-medium text-primary underline">perguntas frequentes</Link> e a{" "}
          <Link to="/politicas" className="font-medium text-primary underline">central de políticas</Link>.
        </p>
      </TextSection>
      <TextSection title="Ajuda na busca por prestadores">
        <p>
          Se não encontrar um prestador em sua região, o auxílio específico para localizar alternativas está
          vinculado à aquisição de acesso oferecida na plataforma, quando a funcionalidade de pagamento estiver ativa.
          Esse apoio não garante disponibilidade nem substitui a negociação direta entre as partes.
        </p>
      </TextSection>
      <TextSection title="Fale com a equipe">
        <p>Não envie senhas, códigos de autenticação, números completos de cartão ou dados sensíveis desnecessários pelo formulário.</p>
        <ContactForm />
      </TextSection>
    </TextPage>
  ),
});
