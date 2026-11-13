import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BriefcaseBusiness, MapPin, Medal, Radio, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import type { PublicTechnician } from "@/lib/technicians.functions";
import { TechnicianAvatar } from "@/components/technician-avatar";
import { formatPublicLocation, placeKey } from "@/lib/location-labels";
import { useActiveCategories, categoryLabel } from "@/hooks/use-active-categories";
import { useActiveServices, serviceLabel } from "@/hooks/use-active-services";

type Categories = ReturnType<typeof useActiveCategories>["categories"];
type Services = ReturnType<typeof useActiveServices>["services"];

export function TechnicianSearchCard({ technician: t, categories, services, localMatch }: {
  technician: PublicTechnician;
  categories: Categories;
  services: Services;
  localMatch?: string | null;
}) {
  // Only the curated, published technician record feeds this component.
  const specialtyPreview = t.specialties.slice(0, 3);
  const servicePreview = t.service_slugs.slice(0, 3);
  const moreSpecialties = Math.max(0, t.specialties.length - specialtyPreview.length);
  const moreServices = Math.max(0, t.service_slugs.length - servicePreview.length);
  const additionalCities = (t.coverage_cities ?? []).filter((c, i, all) =>
    (placeKey(c.name) !== placeKey(t.city) || c.uf !== t.state_uf) &&
    all.findIndex(x => placeKey(x.name) === placeKey(c.name) && x.uf === c.uf) === i);
  const declaredCities = additionalCities.slice(0, 2);
  const moreCities = Math.max(0, additionalCities.length - declaredCities.length);
  const location = formatPublicLocation(t);

  return (
    <Link to="/tecnicos/$tecnicoId" params={{ tecnicoId: t.public_slug }}
      aria-label={"Ver perfil e serviços de " + t.display_name}
      className="eut-card-lift group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[26px] border border-primary/20 bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/60 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none">
      <div className="relative isolate bg-gradient-to-br from-brand-navy via-[#194467] to-[#0c2d4e] px-5 pb-10 pt-6 text-brand-navy-foreground sm:px-6 sm:pt-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 h-52 w-52 rounded-full bg-brand-glow/20 blur-3xl" />
        <Wrench aria-hidden="true" className="pointer-events-none absolute -right-3 top-6 h-24 w-24 rotate-[-20deg] text-white/10" strokeWidth={1} />
        <div className="relative flex min-w-0 items-start gap-4">
          <TechnicianAvatar name={t.display_name} avatarPath={t.avatar_path}
            className="h-[76px] w-[76px] shrink-0 rounded-2xl border-2 border-white/35 ring-4 ring-white/10 shadow-lg sm:h-[84px] sm:w-[84px]" />
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-white/80">
              <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Perfil profissional
            </span>
            <h2 className="mt-2 break-words text-xl font-extrabold leading-tight tracking-tight text-white sm:text-2xl">{t.display_name}</h2>
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-white/85 sm:text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-glow" aria-hidden="true" />
              <span className="break-words">{location}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="relative -mt-4 flex flex-1 flex-col rounded-t-[22px] bg-card px-5 pb-5 pt-5 sm:px-6">
        <div className="flex flex-wrap gap-1.5">
          {t.online_now && (
            <span title="Atividade recente, sem garantia de disponibilidade" className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
              <Radio className="h-3.5 w-3.5" aria-hidden="true" /> Atividade recente
            </span>
          )}
          {t.pioneer_bronze && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/30 bg-amber-800/10 px-3 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              <Medal className="h-3.5 w-3.5" aria-hidden="true" /> Pioneiro Bronze
            </span>
          )}
          {t.referral_highlight && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Destaque por indicações
            </span>
          )}
          {localMatch && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-3 py-1 text-[11px] font-bold text-primary">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {localMatch}
            </span>
          )}
        </div>

        <div className="mt-4">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.13em] text-muted-foreground">
            <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden="true" /> Áreas declaradas
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {specialtyPreview.map(slug => (
              <li key={slug} className="max-w-full break-words rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 text-xs font-semibold text-foreground">
                {categoryLabel(slug, categories)}
              </li>
            ))}
            {moreSpecialties > 0 && <li className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">+{moreSpecialties} áreas</li>}
            {specialtyPreview.length === 0 && <li className="text-xs text-muted-foreground">Não informadas</li>}
          </ul>
        </div>

        <div className="mt-4">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.13em] text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" /> Serviços informados
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {servicePreview.map(slug => (
              <li key={slug} className="max-w-full break-words rounded-lg border border-primary/15 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary">
                {serviceLabel(slug, services)}
              </li>
            ))}
            {moreServices > 0 && <li className="rounded-lg border border-primary/15 px-2.5 py-1.5 text-xs font-semibold text-primary">+{moreServices} serviços</li>}
            {servicePreview.length === 0 && <li className="text-xs text-muted-foreground">Consulte o perfil para conhecer o atendimento</li>}
          </ul>
        </div>

        {declaredCities.length > 0 && (
          <p className="mt-4 break-words text-xs leading-5 text-muted-foreground">
            <strong className="font-semibold text-foreground">Outros municípios: </strong>
            {declaredCities.map(city => city.name + "/" + city.uf).join(" · ")}
            {moreCities > 0 ? " · +" + moreCities : ""}
            {t.service_radius_km != null ? " · raio informado de " + t.service_radius_km + " km" : ""}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm font-bold text-primary">
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> Contato privado protegido</span>
          <span className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none">
            Ver perfil completo <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
