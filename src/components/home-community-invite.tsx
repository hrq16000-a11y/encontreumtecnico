import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, Handshake, ShieldCheck, UsersRound, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { asApprovedSponsoredCard } from "@/components/sponsored-public-slot";

export const COMMUNITY_INVITE_URL = "https://chat.whatsapp.com/DVfSXlJR5YG16VtNtYcf5p";
const SEEN_KEY = "eut-community-invite-home-v1";
const db = supabase as unknown as SupabaseClient;
type ApprovedCard = NonNullable<ReturnType<typeof asApprovedSponsoredCard>>;

function advertisingConsent(): boolean {
  try { return JSON.parse(localStorage.getItem("eut-cookie-consent") || "{}").advertising === true; }
  catch { return false; }
}

/** Marketing invitation only; service leads still stay inside the protected funnel. */
export function HomeCommunityInvite() {
  const [showPopup, setShowPopup] = useState(false);
  const [approvedCard, setApprovedCard] = useState<ApprovedCard | null>(null);
  const [popupCard, setPopupCard] = useState<ApprovedCard | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      if (!advertisingConsent()) {
        setApprovedCard(null);
        setPopupCard(null);
        return;
      }
      void Promise.resolve(db.rpc("eut_ads_public_slot", { _slot_key: "home.content_1", _route_path: "/" }))
        .then(({ data, error }) => {
          if (active) setApprovedCard(error || !advertisingConsent() ? null : asApprovedSponsoredCard(data, "home.content_1"));
        }).catch(() => { if (active) setApprovedCard(null); });
    };
    load();
    window.addEventListener("eut-consent-changed", load);
    return () => { active = false; window.removeEventListener("eut-consent-changed", load); };
  }, []);

  useEffect(() => {
    // The persistent, accessible banner is always available, including mobile.
    // The optional responsive popup is non-modal: it cannot erase a draft, block
    // navigation or steal focus from the search form.
    let alreadyShown = true;
    try { alreadyShown = sessionStorage.getItem(SEEN_KEY) === "1"; }
    catch { return; } // Storage blocked: avoid repeated interruptions.
    if (alreadyShown) return;

    const timer = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      const focused = document.activeElement;
      if (focused instanceof HTMLElement &&
        (focused.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(focused.tagName))) return;
      try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { return; }
      setPopupCard(advertisingConsent() ? approvedCard : null);
      setShowPopup(true);
    }, 11000);
    return () => window.clearTimeout(timer);
  }, [approvedCard]);

  return (
    <>
      <section id="comunidade-de-tecnicos" aria-labelledby="comunidade-titulo"
        className="border-y border-primary/20 bg-gradient-to-br from-brand-navy to-primary px-4 py-12 text-white sm:py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
              <UsersRound className="h-4 w-4" aria-hidden="true" /> Para profissionais de tecnologia
            </p>
            <h2 id="comunidade-titulo" className="mt-4 max-w-xl text-2xl font-extrabold leading-tight text-white sm:text-4xl">
              Você não precisa trabalhar isolado. Participe da comunidade de técnicos.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">
              Converse com outros profissionais, compartilhe experiências e conheça a rede.
              O cadastro no portal é gratuito e separado do ingresso no grupo.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-white/90">
              <span className="inline-flex items-center gap-1.5"><Handshake className="h-4 w-4" aria-hidden="true" /> Troca de experiências</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Contatos de clientes protegidos</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-5 shadow-xl sm:p-6">
            <p className="text-sm font-bold text-white">Dois caminhos para participar</p>
            <a href={COMMUNITY_INVITE_URL} target="_blank" rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-center text-sm font-bold text-brand-navy transition-colors hover:bg-white/90">
              Entrar na comunidade <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link to="/cadastro"
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/40 px-4 text-center text-sm font-bold text-white transition-colors hover:bg-white/15">
              Criar meu perfil gratuito <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <p className="mt-3 text-xs leading-5 text-white/80">
              A comunidade abre no WhatsApp em outra aba. Nenhuma contratação é iniciada pelo grupo.
            </p>
          </div>
        </div>
      </section>

      {showPopup && (
        <aside aria-label={popupCard ? "Campanha publicitária aprovada" : "Convite para profissionais participarem da comunidade"}
          className="fixed bottom-24 left-3 right-3 z-40 mx-auto w-auto max-w-[342px] rounded-2xl border border-primary/20 bg-card p-4 text-card-foreground shadow-2xl lg:bottom-44 lg:left-auto lg:right-6 lg:mx-0 lg:p-5">
          <button type="button" aria-label={popupCard ? "Dispensar campanha" : "Dispensar convite da comunidade"}
            onClick={() => setShowPopup(false)}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          {popupCard ? <>
            <span className="text-xs font-bold uppercase tracking-wide text-primary">Publicidade · {popupCard.brand_name}</span>
            <h3 className="mt-2 pr-6 text-lg font-extrabold text-foreground">{popupCard.headline}</h3>
            {popupCard.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{popupCard.description}</p>}
            <a href={popupCard.destination_url} target="_blank" rel="sponsored noopener noreferrer"
              onClick={() => setShowPopup(false)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90">
              Conhecer anunciante <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <p className="mt-2 text-xs text-muted-foreground">Anúncio aprovado. Não representa certificação técnica.</p>
          </> : <>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
              <UsersRound className="h-4 w-4" aria-hidden="true" /> Comunidade nacional
            </span>
            <h3 className="mt-2 pr-6 text-lg font-extrabold leading-snug text-foreground lg:mt-3 lg:text-xl">
              Trabalha com tecnologia?
            </h3>
            <p className="mt-2 hidden text-sm leading-6 text-muted-foreground lg:block">
              Conheça a comunidade de técnicos e troque experiências com outros profissionais.
            </p>
            <a href={COMMUNITY_INVITE_URL} target="_blank" rel="noopener noreferrer"
              onClick={() => setShowPopup(false)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90">
              Participar da comunidade <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link to="/cadastro" onClick={() => setShowPopup(false)}
              className="mt-2 hidden min-h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-accent lg:inline-flex">
              Quero me cadastrar no portal
            </Link>
          </>}
        </aside>
      )}
    </>
  );
}
