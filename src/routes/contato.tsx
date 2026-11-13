import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, Headset, LifeBuoy, LockKeyhole, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/page-placeholder";
import { pageHead } from "@/components/text-page";
import { openFreeHelp, portalHelpContext } from "@/lib/free-search-help";

export const Route = createFileRoute("/contato")({
  head: () => pageHead(
    "Central de ajuda do portal",
    "Atendimento guiado e seguro para cadastro, acesso, solicitações e privacidade, sem telefones e e-mails públicos como atalhos.",
    "/contato",
  ),
  component: ContactPage,
});

function ContactPage() {
  return (
    <PageShell>
      <section className="bg-gradient-to-b from-brand-navy via-brand-navy to-background px-4 pb-12 pt-10 md:pb-16 md:pt-16">
        <div className="mx-auto max-w-6xl">
          <div className="eut-soft-arrival relative isolate overflow-hidden rounded-3xl border border-brand-glow/25 bg-brand-navy p-7 text-brand-navy-foreground shadow-[0_26px_64px_-25px_rgba(5,20,44,.6)] sm:p-10">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-brand-glow/15 blur-3xl" />
            <span className="relative inline-flex items-center gap-2 rounded-full border border-brand-glow/30 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white">
              <LifeBuoy className="h-4 w-4" aria-hidden="true" /> Central de ajuda
            </span>
            <h1 className="relative mt-5 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">Conte com a equipe do portal.</h1>
            <p className="relative mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-lg">
              Um caminho seguro para tirar dúvidas, pedir orientação ou acompanhar uma solicitação.
              O atendimento começa pelo funil e não pela exposição de telefones ou e-mails.
            </p>
            <button type="button" onClick={() => openFreeHelp(portalHelpContext("contato"))}
              className="group relative mt-6 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-brand-navy shadow-lg transition-transform hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transform-none">
              <Headset className="h-5 w-5" aria-hidden="true" />
              Pedir ajuda ao portal
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
            </button>
            <p className="relative mt-3 text-xs text-white/70">A mensagem inicial já indica que você está na página de contato.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="contact-paths-title" className="mx-auto max-w-6xl px-4 pb-16">
        <h2 id="contact-paths-title" className="text-2xl font-extrabold text-foreground">Encontre o caminho certo</h2>
        <p className="mt-2 text-sm text-muted-foreground">Cada opção direciona a uma função existente, sem liberar dados de prestadores.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <button type="button" onClick={() => openFreeHelp(portalHelpContext("contato"))}
            className="eut-card-lift group flex min-h-48 flex-col items-start rounded-2xl border border-primary/30 bg-card p-6 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Headset className="h-6 w-6" aria-hidden="true" /></span>
            <strong className="mt-4 text-lg text-card-foreground">Preciso de orientação</strong>
            <span className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">Descreva o que aconteceu e registre seu pedido com a equipe.</span>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary">Abrir atendimento <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
          </button>
          <Link to="/ajuda-acesso"
            className="eut-card-lift group flex min-h-48 flex-col items-start rounded-2xl border border-border bg-card p-6 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><LockKeyhole className="h-6 w-6" aria-hidden="true" /></span>
            <strong className="mt-4 text-lg text-card-foreground">Cadastro ou acesso</strong>
            <span className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">Orientações para entrar, confirmar a conta e recuperar o cadastro.</span>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary">Resolver acesso <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
          </Link>
          <Link to="/area-cliente"
            className="eut-card-lift group flex min-h-48 flex-col items-start rounded-2xl border border-border bg-card p-6 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="h-6 w-6" aria-hidden="true" /></span>
            <strong className="mt-4 text-lg text-card-foreground">Já tenho uma solicitação</strong>
            <span className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">Entre na sua área para consultar as solicitações disponíveis.</span>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary">Acessar minhas solicitações <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
          </Link>
        </div>
      </section>

      <section className="border-t border-border bg-muted/60 px-4 py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-6 w-6" aria-hidden="true" /></span>
            <div>
              <h2 className="text-lg font-bold text-card-foreground">Privacidade também é atendimento</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Para dúvidas ou solicitações sobre seus dados, use o atendimento guiado sem pagamento. Nunca envie senhas, códigos ou informações bancárias. Consulte também a <Link to="/privacidade" className="font-semibold text-primary underline underline-offset-4">Política de Privacidade</Link>.</p>
            </div>
          </div>
          <button type="button" onClick={() => openFreeHelp(portalHelpContext("contato", "privacidade"))}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Pedir ajuda com dados
          </button>
        </div>
      </section>
    </PageShell>
  );
}
