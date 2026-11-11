import { useEffect, useRef, useState } from "react";
import { LifeBuoy, LockKeyhole, MapPin, MessageCircleQuestion, X } from "lucide-react";
import { ContactForm } from "./contact-form";
import { freeHelpCopy, type FreeHelpContext } from "@/lib/free-search-help";

/** Free first-phase assisted search. Never reveals a private technician number.
 * Uses the pre-existing admin contact_messages form; no payment or client
 * request is created merely by opening the popup.
 */
export function FreeSearchHelp() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<FreeHelpContext>({});
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const data = (event as CustomEvent<FreeHelpContext>).detail;
      setContext(data && typeof data === "object" ? data : {});
      setOpen(true);
    };
    window.addEventListener("eut-open-free-help", onRequest);
    return () => window.removeEventListener("eut-open-free-help", onRequest);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prior;
      window.removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [open]);

  const copy = freeHelpCopy(context);
  return (
    <>
      <button type="button" ref={triggerRef}
        aria-haspopup="dialog" aria-expanded={open} aria-controls="eut-free-help-dialog"
        onClick={() => { setContext({}); setOpen(true); }}
        className="fixed bottom-[calc(10.5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full border border-white/30 bg-brand-navy px-4 py-3 text-sm font-bold text-white shadow-[0_14px_42px_-14px_rgba(7,28,57,.7)] transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none md:bottom-24 md:right-6">
        <LifeBuoy className="h-5 w-5" aria-hidden="true" />
        <span>Ajuda grátis</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section id="eut-free-help-dialog" role="dialog" aria-modal="true" aria-labelledby="eut-help-title"
            aria-describedby="eut-help-intro"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card shadow-2xl sm:max-w-lg sm:rounded-3xl">
            <div className="relative bg-gradient-to-br from-brand-navy to-primary p-6 text-white">
              <button type="button" ref={closeRef} aria-label="Fechar ajuda gratuita" onClick={() => setOpen(false)}
                className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-white/15 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-bold">
                <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" /> Primeira fase · R$ 0,00
              </span>
              <h2 id="eut-help-title" className="mt-4 pr-10 text-2xl font-extrabold leading-tight">Não encontrou um técnico? Podemos ajudar.</h2>
              <p id="eut-help-intro" className="mt-2 text-sm leading-6 text-white/90">Solicite orientação da equipe gratuitamente, sem adquirir contato nem pagar taxa. Não garantimos disponibilidade de profissionais.</p>
              {(context.city || context.uf || context.neighborhood) && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /> Busca em {copy.location}
                </p>
              )}
            </div>
            <div className="p-5 sm:p-6">
              <ContactForm key={copy.message} initialSubject={copy.subject} initialMessage={copy.message} submitLabel="Solicitar ajuda gratuita" />
              <p className="mt-4 flex gap-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Esta solicitação vai somente para a equipe do portal. O telefone de nenhum técnico é liberado ou compartilhado por este formulário.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
