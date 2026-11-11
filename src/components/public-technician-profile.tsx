import { Link } from "@tanstack/react-router";
import { openFreeHelp } from "@/lib/free-search-help";
import {
  ArrowLeft, ArrowRight, BadgeInfo, BriefcaseBusiness, Check,
  ChevronRight, Handshake, LockKeyhole, MapPin, Medal,
  MessageSquareText, MonitorCheck, Navigation, Sparkles, Wrench,
} from "lucide-react";
import type { PublicTechnician } from "@/lib/technicians.functions";
import { TechnicianAvatar } from "@/components/technician-avatar";
import { formatPublicLocation, placeKey } from "@/lib/location-labels";
import { categoryLabel, useActiveCategories } from "@/hooks/use-active-categories";
import { serviceLabel, useActiveServices } from "@/hooks/use-active-services";

/** Presentation only: uses fields from the published and sanitized technician
 * profile. Never loads or guesses private contacts, ratings or endorsements.
 */
export function PublicTechnicianProfile({ technician: t }: { technician: PublicTechnician }) {
  const { categories } = useActiveCategories();
  const { services } = useActiveServices();
  const location = formatPublicLocation(t);
  const additionalCities = (t.coverage_cities ?? []).filter((c, i, all) =>
    (placeKey(c.name) !== placeKey(t.city) || c.uf !== t.state_uf) &&
    all.findIndex(x => placeKey(x.name) === placeKey(c.name) && x.uf === c.uf) === i);
  const topCategories = t.specialties.slice(0, 4);
  const extraCategories = Math.max(0, t.specialties.length - topCategories.length);

  return (
    <div className="relative min-h-screen overflow-clip bg-gradient-to-b from-accent/60 via-background to-background pb-28 lg:pb-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-dot-grid text-primary/[0.055] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pt-9">
        <nav aria-label="Caminho de navegação" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-primary">Início</Link>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          <Link to="/tecnicos" className="transition-colors hover:text-primary">Técnicos</Link>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          <span className="max-w-[220px] truncate font-medium text-foreground" aria-current="page">{t.display_name}</span>
        </nav>

        <section aria-labelledby="tecnico-nome" className="relative isolate overflow-hidden rounded-[28px] bg-brand-navy p-6 text-brand-navy-foreground shadow-[0_24px_70px_-24px_rgba(7,28,57,.5)] sm:p-9 lg:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-[380px] w-[380px] rounded-full bg-primary/25 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 left-1/4 h-[320px] w-[440px] rounded-full bg-brand-glow/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
            <div className="flex min-w-0 flex-col items-start gap-5 sm:flex-row sm:gap-7">
              <TechnicianAvatar name={t.display_name} avatarPath={t.avatar_path}
                className="h-24 w-24 border-white/25 ring-4 ring-white/10 sm:h-28 sm:w-28" loading="eager" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    <MonitorCheck className="h-3.5 w-3.5" aria-hidden="true" /> Perfil profissional publicado
                  </span>
                  {t.pioneer_bronze && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100">
                      <Medal className="h-3.5 w-3.5" aria-hidden="true" /> Pioneiro Bronze
                    </span>
                  )}
                  {t.referral_highlight && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/40 bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-50">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Destaque por indicações
                    </span>
                  )}
                </div>
                <h1 id="tecnico-nome" className="mt-4 break-words text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">{t.display_name}</h1>
                <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-white/85 sm:text-base">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-glow" aria-hidden="true" />
                  <span>{location}</span>
                </p>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/75">Conheça as áreas e serviços informados por este profissional e descreva sua necessidade diretamente pelo portal.</p>
                {t.online_now && <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-200"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-emerald-300" />Atividade recente · disponibilidade não garantida</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-5 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[.17em] text-white/65">Informações do perfil</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div><strong className="block text-3xl font-extrabold text-white">{t.specialties.length}</strong><span className="mt-1 block text-xs text-white/75">Áreas declaradas</span></div>
                <div><strong className="block text-3xl font-extrabold text-white">{t.service_slugs.length}</strong><span className="mt-1 block text-xs text-white/75">Serviços listados</span></div>
              </div>
              <p className="mt-4 border-t border-white/15 pt-3 text-xs leading-5 text-white/70">Dados informados pelo técnico, não avaliações ou certificações emitidas pela plataforma.</p>
            </div>
          </div>
          {topCategories.length > 0 && (
            <div className="relative mt-7 flex flex-wrap gap-2 border-t border-white/15 pt-6" aria-label="Áreas de atuação informadas">
              {topCategories.map((slug) => (
                <span key={slug} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/95">{categoryLabel(slug, categories)}</span>
              ))}
              {extraCategories > 0 && <a href="#especialidades" className="rounded-full border border-brand-glow/40 bg-brand-glow/15 px-3 py-1.5 text-xs font-semibold text-brand-navy-foreground hover:bg-white/20">+{extraCategories} áreas</a>}
            </div>
          )}
        </section>

        <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <section id="especialidades" aria-labelledby="titulo-areas" className="eut-card-lift rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BriefcaseBusiness className="h-5 w-5" aria-hidden="true" /></span>
                <div><p className="text-xs font-bold uppercase tracking-[.17em] text-primary">Áreas de atuação</p><h2 id="titulo-areas" className="mt-1 text-xl font-bold text-card-foreground sm:text-2xl">Especialidades informadas</h2></div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {t.specialties.length ? t.specialties.map(slug => <span key={slug} className="rounded-xl border border-border bg-muted/60 px-3 py-2 text-sm font-medium text-foreground">{categoryLabel(slug, categories)}</span>) : <p className="text-sm text-muted-foreground">Ainda não há especialidades informadas neste perfil.</p>}
              </div>
            </section>
            <section id="servicos" aria-labelledby="titulo-servicos" className="eut-card-lift rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wrench className="h-5 w-5" aria-hidden="true" /></span>
                <div><p className="text-xs font-bold uppercase tracking-[.17em] text-primary">O que este profissional informa realizar</p><h2 id="titulo-servicos" className="mt-1 text-xl font-bold text-card-foreground sm:text-2xl">Serviços disponíveis no perfil</h2></div>
              </div>
              {t.service_slugs.length ? (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {t.service_slugs.map(slug => <li key={slug} className="flex min-h-14 items-start gap-3 rounded-xl border border-border bg-accent/40 p-3.5 text-sm font-medium leading-5 text-foreground"><span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="h-4 w-4" /></span><span>{serviceLabel(slug, services)}</span></li>)}
                </ul>
              ) : <p className="mt-4 text-sm text-muted-foreground">Os serviços específicos ainda não foram detalhados.</p>}
              <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">A descrição dos serviços é responsabilidade do profissional. Confirme os detalhes diretamente antes de contratar.</p>
            </section>
            <section id="atendimento" aria-labelledby="titulo-atendimento"
              className="eut-card-lift rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.17em] text-primary">Cobertura informada pelo profissional</p>
                  <h2 id="titulo-atendimento" className="mt-1 text-xl font-bold text-card-foreground sm:text-2xl">Onde este técnico atende</h2>
                </div>
              </div>
              {t.service_radius_km != null && (
                <p className="mt-3 rounded-xl bg-accent/60 p-3 text-sm font-semibold text-foreground">
                  Raio declarado: até {t.service_radius_km} km em linha reta, aproximadamente, a partir
                  do centro de referência da cidade-base.
                </p>
              )}
              {additionalCities.length > 0 ? (
                <>
                  <h3 className="mt-5 text-sm font-semibold text-foreground">
                    Outros municípios atendidos ({additionalCities.length})
                  </h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {additionalCities.map(city => (
                      <li key={city.id} className="rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
                        {city.name}/{city.uf}
                      </li>
                    ))}
                  </ul>
                </>
              ) : <p className="mt-3 text-sm text-muted-foreground">
                Outros municípios não informados neste perfil.
              </p>}
              <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                Os nomes são selecionados do catálogo de municípios com códigos IBGE. A área é declarada
                pelo técnico, não georreferenciamento de sua residência nem garantia de deslocamento,
                tempo de chegada ou disponibilidade.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <Link to="/tecnicos" search={{ especialidade: "Todas", cidade: t.city, regiao: "", uf: t.state_uf ?? "" }}
                  className="font-semibold text-primary underline-offset-4 hover:underline">
                  Ver outros perfis com esta localidade →
                </Link>
                <Link to="/cobertura" className="font-semibold text-primary underline-offset-4 hover:underline">
                  Explorar cobertura publicada →
                </Link>
              </div>
            </section>
            {t.bio && (
              <section id="sobre" aria-labelledby="titulo-sobre" className="eut-card-lift rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BadgeInfo className="h-5 w-5" aria-hidden="true" /></span>
                  <div><p className="text-xs font-bold uppercase tracking-[.17em] text-primary">Apresentação pessoal</p><h2 id="titulo-sobre" className="mt-1 text-xl font-bold text-card-foreground sm:text-2xl">Sobre o profissional</h2></div>
                </div>
                <p className="mt-5 whitespace-pre-line text-sm leading-7 text-foreground sm:text-base">{t.bio}</p>
                <p className="mt-4 text-xs text-muted-foreground">Texto fornecido pelo titular do perfil.</p>
              </section>
            )}
            <section aria-labelledby="titulo-transparencia" className="rounded-2xl border border-primary/15 bg-accent/60 p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[.17em] text-primary">Confiança é transparência</p>
              <h2 id="titulo-transparencia" className="mt-2 text-xl font-bold text-foreground sm:text-2xl">Saiba como o portal funciona</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div><LockKeyhole className="h-6 w-6 text-primary" aria-hidden="true" /><h3 className="mt-3 text-sm font-bold text-foreground">Contato protegido</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Número privado, não exibido no perfil público.</p></div>
                <div><Handshake className="h-6 w-6 text-primary" aria-hidden="true" /><h3 className="mt-3 text-sm font-bold text-foreground">Negociação direta</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Cliente e técnico definem os detalhes entre si, sem intermediação.</p></div>
                <div><Navigation className="h-6 w-6 text-primary" aria-hidden="true" /><h3 className="mt-3 text-sm font-bold text-foreground">Região declarada</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Localidade informada pelo técnico, sem promessa de distância ou disponibilidade.</p></div>
              </div>
            </section>
          </div>

          <aside id="solicitar" aria-labelledby="titulo-solicitar" className="lg:sticky lg:top-28">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_14px_44px_-26px_rgba(7,28,57,.45)]">
              <div className="bg-gradient-to-r from-primary to-brand-navy p-6 text-white">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/15"><MessageSquareText className="h-5 w-5" aria-hidden="true" /></div>
                <p className="mt-4 text-xs font-bold uppercase tracking-[.16em] text-white/75">Próximo passo</p>
                <h2 id="titulo-solicitar" className="mt-1 text-xl font-bold text-white">Precisa de atendimento?</h2>
                <p className="mt-2 text-sm leading-6 text-white/85">Descreva sua necessidade para organizar o pedido com segurança.</p>
              </div>
              <div className="space-y-3 p-5">
                <Link to="/area-cliente" search={{ tecnico: t.id }} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-center text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md motion-reduce:transform-none">
                  Descrever meu problema <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <button type="button" onClick={() => openFreeHelp({ mode: "direct", technicianId: t.id, technicianName: t.display_name, service: t.service_slugs[0] || "" })} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-accent/50 px-4 text-center text-sm font-semibold text-primary transition-colors hover:bg-accent">
                  Solicitar contato via atendimento <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">A descrição é opcional e depende do consentimento do cliente. Nenhum número é revelado aqui. O pagamento está pausado. O funil registra seu interesse sem liberar telefone privado.</p>
              </div>
            </div>
            <Link to="/tecnicos" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar à busca</Link>
          </aside>
        </div>
      </div>

      <nav aria-label="Ações rápidas deste técnico" className="fixed inset-x-3 bottom-3 z-30 flex gap-2 rounded-2xl border border-border bg-background/95 p-2 shadow-[0_12px_44px_-16px_rgba(7,28,57,.45)] backdrop-blur-xl lg:hidden">
        <Link to="/area-cliente" search={{ tecnico: t.id }} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-center text-xs font-bold text-primary-foreground sm:text-sm">
          <MessageSquareText className="h-4 w-4 shrink-0" aria-hidden="true" /> Descrever problema
        </Link>
        <button type="button" onClick={() => openFreeHelp({ mode: "direct", technicianId: t.id, technicianName: t.display_name, service: t.service_slugs[0] || "" })} className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-primary/25 bg-accent px-3 text-center text-xs font-bold text-primary sm:text-sm">
          <LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" /> Pedir contato
        </button>
      </nav>
    </div>
  );
}
