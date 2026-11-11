import type { PublicGuide } from "@/lib/public-guides";
import { getGuideFaqs } from "@/lib/guide-faqs";
import { GuideInlineHelpButton } from "@/components/guide-lead-callout";

export function GuideReadingNavigation({ guide }: { guide: PublicGuide }) {
  return (
    <nav aria-label="Assuntos desta especialidade" className="mt-7 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-bold text-foreground">Explore os assuntos desta especialidade</h2>
      <ol className="mt-3 grid gap-1 sm:grid-cols-2">
        {guide.sections.map((section, index) => (
          <li key={section.heading}>
            <a href={"#secao-" + index}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm leading-5 text-primary hover:bg-muted/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{index + 1}.</span>
              <span>{section.heading}</span>
            </a>
          </li>
        ))}
        <li>
          <a href="#perguntas-frequentes"
            className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-muted/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Perguntas frequentes ↓
          </a>
        </li>
        <li>
          <a href="#guias-relacionados"
            className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-muted/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Leituras relacionadas ↓
          </a>
        </li>
      </ol>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
          Já sabe qual ajuda precisa? O formulário registra sua solicitação antes de qualquer encaminhamento.
        </p>
        <GuideInlineHelpButton guide={guide} />
      </div>
    </nav>
  );
}

/** Native details/summary is indexable, keyboard accessible and requires no client-side state. */
export function GuideFrequentlyAskedQuestions({ guide }: { guide: PublicGuide }) {
  const faqs = getGuideFaqs(guide.slug);
  if (!faqs.length) return null;
  return (
    <section aria-labelledby="perguntas-frequentes" className="mt-10 scroll-mt-28">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Dúvidas comuns</p>
        <h2 id="perguntas-frequentes" className="mt-2 scroll-mt-28 text-2xl font-extrabold text-foreground">
          Perguntas frequentes sobre {guide.categoryName.toLocaleLowerCase("pt-BR")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Respostas informativas para orientar sua decisão. Não substituem inspeção, diagnóstico ou orçamento de profissional habilitado.
        </p>
      </div>
      <div className="mt-6 space-y-3">
        {faqs.map((faq) => (
          <details key={faq.question} className="group rounded-xl border border-border bg-card px-4 py-1 sm:px-6">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-left text-sm font-semibold leading-6 text-foreground marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-base">
              <span>{faq.question}</span>
              <span aria-hidden="true" className="shrink-0 text-xl font-normal text-primary group-open:rotate-45">+</span>
            </summary>
            <p className="border-t border-border pb-5 pt-4 text-sm leading-7 text-muted-foreground sm:text-base">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-4">
        <p className="max-w-md text-sm leading-6 text-foreground">
          Seu caso não está aqui? Explique o equipamento, a necessidade e a cidade no atendimento guiado.
        </p>
        <GuideInlineHelpButton guide={guide} />
      </div>
    </section>
  );
}
