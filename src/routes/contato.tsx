import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import { openFreeHelp } from "@/lib/free-search-help";
import { TextPage, TextSection, pageHead } from "@/components/text-page";

export const Route = createFileRoute("/contato")({
  head: () => pageHead("Contato e atendimento", "Atendimento guiado para encontrar técnicos, solicitar gestão ou resolver dúvidas.", "/contato"),
  component: () => (
    <TextPage title="Contato e atendimento" intro="Escolha a melhor forma de resolver sua necessidade em poucos passos.">
      <TextSection title="Precisou de ajuda?">
        <p>Não é necessário preencher um formulário genérico. O funil guiado identifica o serviço desejado, a urgência e sua região aproximada, quando disponível.</p>
        <button type="button" onClick={() => openFreeHelp()}
          className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground shadow-sm hover:bg-primary/90">
          <LifeBuoy className="h-5 w-5" aria-hidden="true" /> Iniciar atendimento guiado
        </button>
      </TextSection>
      <TextSection title="Duas maneiras de solicitar">
        <p><strong>Contato direto:</strong> seu interesse é registrado no funil, sem pagamento ou validação de compra por enquanto. Os contatos privados permanecem protegidos até existir integração financeira confirmada.</p>
        <p><strong>Gestão assistida:</strong> informe a necessidade para a equipe orientar a busca e o atendimento, sem taxa antecipada. Qualquer valor de serviço será informado e combinado separadamente.</p>
      </TextSection>
      <TextSection title="Privacidade e segurança">
        <p className="flex gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /> Nenhum telefone privado de técnico é exibido pelo funil. Não envie senhas, dados bancários ou documentos sensíveis.</p>
        <p>Para acesso, correção ou exclusão de dados pessoais, utilize <a href="mailto:dpo@encontreumtecnico.com" className="font-semibold text-primary underline">dpo@encontreumtecnico.com</a>. Veja também as <Link to="/faq" className="text-primary underline">perguntas frequentes</Link> e a <Link to="/politicas" className="text-primary underline">central de políticas</Link>.</p>
      </TextSection>
    </TextPage>
  ),
});
