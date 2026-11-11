import { openFreeHelp } from "@/lib/free-search-help";
import capture from "../../data/external-staging/guiafix-paranagua-pr-tecnico-informatica.capture.json";

/**
 * Public bibliographic references, NOT registered technicians, contact entitlements,
 * availability, ratings or invitations. Never assign these records a technician UUID.
 */
export function ParanaguaExternalReferences() {
  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-7"
      aria-labelledby="paranagua-referencias-externas">
      <p className="text-xs font-bold uppercase tracking-wide text-primary">Referências externas · Paranaguá/PR</p>
      <h2 id="paranagua-referencias-externas" className="mt-2 text-xl font-bold text-foreground">
        Nomes citados em diretório público de informática em Paranaguá
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Estes {capture.listings.length} nomes foram citados em uma página pública do GuiaFix consultada por
        cópia indexada. São referências informativas, não contas ou perfis verificados do Encontre um Técnico.
        Não confirmamos vínculo, especialidade atual, disponibilidade ou autorização para receber solicitações.
        Nenhum telefone, avaliação ou contato de terceiros foi importado.
      </p>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2" aria-label="Referências públicas externas não reivindicadas">
        {capture.listings.map(item => (
          <li key={item.public_name} className="rounded-lg border border-border bg-background px-3 py-3">
            <span className="block break-words text-sm font-semibold text-foreground">{item.public_name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Referência externa · não cadastrado neste portal
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        <a href="https://guiafix.com.br/paranagua-pr/tecnico-de-informatica"
          target="_blank" rel="noopener noreferrer" className="font-medium underline">
          Fonte pública: GuiaFix
        </a>. Listagem de origem pode estar desatualizada. Se você representa um dos nomes acima,
        utilize o contato do portal para solicitar correção ou remoção.
      </p>
      <button type="button"
        onClick={() => openFreeHelp({ mode: "managed", service: "Técnico de informática", city: "Paranaguá", uf: "PR" })}
        className="mt-5 min-h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
        Solicitar ajuda para encontrar técnico em Paranaguá
      </button>
      <p className="mt-2 text-xs text-muted-foreground">
        A solicitação é regional e não é enviada automaticamente aos nomes acima. Nenhum contato privado é liberado.
      </p>
    </section>
  );
}
