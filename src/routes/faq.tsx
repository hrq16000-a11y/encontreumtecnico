import { createFileRoute } from "@tanstack/react-router";
import { TextPage, pageHead } from "../components/text-page";
import { FAQ } from "../lib/faq";

export const Route = createFileRoute("/faq")({
  head: () => pageHead("Perguntas frequentes", "Respostas para as dúvidas mais comuns de clientes e técnicos.", "/faq"),
  component: () => (
    <TextPage title="Perguntas frequentes" intro="Dúvidas comuns de clientes e técnicos.">
      {FAQ.map((item) => (
        <details key={item.q} className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer font-medium text-card-foreground">{item.q}</summary>
          <p className="mt-2">{item.a}</p>
        </details>
      ))}
<p className="mx-auto my-5 w-full max-w-6xl px-4 text-sm leading-7 text-muted-foreground">Para escolher um profissional, veja <a href="/como-funciona" className="font-semibold text-primary underline underline-offset-2">como funciona o atendimento</a> e consulte os <a href="/servicos" className="font-semibold text-primary underline underline-offset-2">serviços por especialidade</a>. Se a dúvida for sobre o seu cadastro, acesse a <a href="/ajuda-acesso" className="font-semibold text-primary underline underline-offset-2">ajuda para entrar no portal</a>.</p>
    </TextPage>
  ),
});
