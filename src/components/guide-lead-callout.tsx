import { Link } from "@tanstack/react-router";
import { openFreeHelp } from "@/lib/free-search-help";
import type { PublicGuide } from "@/lib/public-guides";

function requestHelpForGuide(guide: PublicGuide): void {
  openFreeHelp({
    mode: "managed",
    guideSlug: guide.slug,
    service: ({
      cftv: "CFTV e segurança",
      computadores: "Computadores e notebooks",
      redes: "Redes e Wi-Fi",
      impressoras: "Impressoras",
      software: "Sistemas e software",
      climatizacao: "Climatização",
      automacao: "Automação",
      comunicacoes: "Comunicações e telefonia",
    } as Record<string, string>)[guide.categorySlug] ?? guide.categoryName,
  });
}

/** One compact additional conversion point; uses the very same persisted funnel. */
export function GuideInlineHelpButton({ guide }: { guide: PublicGuide }) {
  return (
    <button type="button" onClick={() => requestHelpForGuide(guide)}
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      Descrever meu problema →
    </button>
  );
}

export function GuideLeadCallout({ guide, compact = false }: { guide: PublicGuide; compact?: boolean }) {
  return (
    <aside aria-label="Solicitar atendimento nesta especialidade"
      className={"overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-brand-navy to-primary p-5 text-white shadow-lg sm:p-7 " + (compact ? "my-6" : "mt-10")}>
      <p className="text-xs font-bold uppercase tracking-[.16em] text-teal-100">Atendimento guiado · Sem pagamento antecipado</p>
      <h2 className="mt-3 text-xl font-extrabold leading-snug text-white sm:text-2xl">
        Precisa de um técnico em {guide.categoryName.toLocaleLowerCase("pt-BR")}?
      </h2>
      <p className="mt-3 text-sm leading-6 text-white/90">
        Conte o problema, a urgência e a região. O portal registra o pedido primeiro e permite continuar com
        a equipe pelo WhatsApp usando uma mensagem pronta. A disponibilidade depende do profissional.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button"
          onClick={() => requestHelpForGuide(guide)}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-extrabold text-blue-950 hover:bg-teal-50">
          Solicitar atendimento agora →
        </button>
        <Link to="/tecnicos" search={{ especialidade: guide.categorySlug, cidade: "", regiao: "" }}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/40 px-4 text-sm font-bold text-white hover:bg-white/10">
          Ver profissionais cadastrados
        </Link>
      </div>
      <p className="mt-3 text-xs leading-5 text-white/75">
        Sem GPS obrigatório nem liberação de telefone privado. A mensagem somente chega ao WhatsApp
        se o visitante confirmar o envio no aplicativo.
      </p>
    </aside>
  );
}
