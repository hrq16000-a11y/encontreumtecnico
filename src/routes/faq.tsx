import { createFileRoute } from "@tanstack/react-router";
import { TextPage, pageHead } from "../components/text-page";
import { FAQ } from "../lib/faq";

export const Route = createFileRoute("/faq")({
  head: () => pageHead("Perguntas frequentes", "Respostas para as dúvidas mais comuns de clientes e técnicos."),
  component: () => (
    <TextPage title="Perguntas frequentes" intro="Dúvidas comuns de clientes e técnicos.">
      {FAQ.map((item) => (
        <details key={item.q} className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer font-medium text-card-foreground">{item.q}</summary>
          <p className="mt-2">{item.a}</p>
        </details>
      ))}
    </TextPage>
  ),
});
