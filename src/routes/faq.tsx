import { createFileRoute } from "@tanstack/react-router";
import { TextPage, pageHead } from "../components/text-page";

const FAQ = [
  { q: "O que é o Encontre um Técnico?", a: "Um portal que conecta clientes a técnicos de tecnologia aprovados em todo o Brasil." },
  { q: "Quanto custa para o cliente?", a: "Buscar técnicos e abrir solicitações é gratuito para o cliente." },
  { q: "Como me cadastro como técnico?", a: "Crie sua conta em Entrar, escolha \"Sou Técnico\" e preencha seu perfil. Ele só aparece publicamente depois de aprovado." },
  { q: "Os técnicos são verificados?", a: "Sim. Apenas perfis aprovados pela administração aparecem na listagem pública." },
  { q: "Meus dados ficam públicos?", a: "Não. Dados pessoais só são compartilhados com sua autorização." },
];

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
