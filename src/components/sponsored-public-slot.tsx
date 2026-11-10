import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AdPlacement =
  | { slotKey: "home.content_1"; routePath: "/" }
  | { slotKey: "search.top"; routePath: "/tecnicos" }
  | { slotKey: "services.content_1"; routePath: "/servicos" };

type PublicCard = {
  label: "Publicidade";
  brand_name: string;
  headline: string;
  description: string;
  destination_url: string;
  creative_type: "sponsored_card";
  slot_key: string;
};

const db = supabase as unknown as SupabaseClient;

// The public RPC projects only approved fields; validate them again in-browser
// so no unexpected payload can become a click destination.
export function asApprovedSponsoredCard(raw: unknown, expectedSlot: string): PublicCard | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (value["label"] !== "Publicidade" ||
      value["creative_type"] !== "sponsored_card" ||
      value["slot_key"] !== expectedSlot) return null;
  for (const key of ["brand_name", "headline", "description", "destination_url"]) {
    if (typeof value[key] !== "string") return null;
  }
  const destination = value["destination_url"] as string;
  if (destination.length > 2048 ||
      !/^https:\/\/[^\s]+$/i.test(destination)) return null;
  const brand = value["brand_name"] as string;
  const headline = value["headline"] as string;
  const description = value["description"] as string;
  if (!brand.trim() || brand.length > 120 || !headline.trim() ||
      headline.length > 150 || description.length > 400) return null;
  return {
    label: "Publicidade",
    brand_name: brand,
    headline,
    description,
    destination_url: destination,
    creative_type: "sponsored_card",
    slot_key: expectedSlot,
  };
}

export function SponsoredPublicSlot({ slotKey, routePath }: AdPlacement) {
  const [card, setCard] = useState<PublicCard | null>(null);
  useEffect(() => {
    let active = true;
    const getAd = () => {
      void Promise.resolve(db.rpc("eut_ads_public_slot", {
        _slot_key: slotKey, _route_path: routePath,
      })).then(({ data, error }) => {
        if (active) setCard(error ? null : asApprovedSponsoredCard(data, slotKey));
      }).catch(() => { if (active) setCard(null); });
    };
    getAd();
    // Refresh after returning to a tab; a paused/expired ad must disappear
    // without requiring the visitor to keep an old cached card.
    const visibility = () => { if (document.visibilityState === "visible") getAd(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { active = false; document.removeEventListener("visibilitychange", visibility); };
  }, [slotKey, routePath]);

  return (
    <aside data-ad-slot={slotKey}
      aria-label="Espaço de publicidade"
      className="mx-auto w-full max-w-6xl px-4 py-4">
      <div className="flex min-h-[156px] flex-col justify-center rounded-xl border border-border bg-muted/30 px-5 py-4 sm:px-7">
        <span className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Publicidade
        </span>
        {card ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-muted-foreground">{card.brand_name}</p>
              <h2 className="mt-1 text-lg font-bold text-foreground">{card.headline}</h2>
              {card.description && <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                Conteúdo de anunciante. Não representa certificação ou recomendação do profissional.
              </p>
            </div>
            <a href={card.destination_url} target="_blank" rel="sponsored noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              Conhecer anunciante
            </a>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-foreground">Sua marca pode aparecer aqui</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Conheça as oportunidades de patrocínio do Encontre um Técnico.
              </p>
            </div>
            <a href="/contato" className="inline-flex min-h-11 items-center rounded-lg border border-input px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-accent">
              Anunciar no portal
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
