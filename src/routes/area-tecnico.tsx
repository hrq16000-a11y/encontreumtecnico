import { createFileRoute, Link } from "@tanstack/react-router";
import { useContext, useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageShell, LP2EmbeddedContext } from "../components/page-placeholder";
import { useAuth } from "@/hooks/use-auth";
import { ConnectedGoogleIdentity } from "@/components/connected-google-identity";
import { googleIdentityHint } from "@/lib/google-identity-hint";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { useActiveServices } from "@/hooks/use-active-services";
import { BRAZIL_STATES, validMunicipality } from "@/lib/service-taxonomy";
import { useMunicipalities } from "@/hooks/use-municipalities";
import { MunicipalityPicker } from "@/components/municipality-picker";
import { TechnicianCoverageEditor } from "@/components/technician-coverage-editor";
import { TechnicianAvatarEditor } from "@/components/technician-avatar-editor";
import { LegacyAccountActivation } from "@/components/legacy-account-activation";
import { LegacyProfileImport } from "@/components/legacy-profile-import";
import { TechnicianPresence } from "@/components/technician-presence";
import { TechnicianMissions } from "@/components/technician-missions";
import { TechnicianPrivateContact } from "@/components/technician-private-contact";
import { PioneerPhoneVerification } from "@/components/pioneer-phone-verification";
import { TechnicianDirectRequests } from "@/components/technician-direct-requests";
import { CustomerLocationButton } from "@/components/customer-location-button";
import { suggestTechnicianArea } from "@/lib/customer-location";
import { clearProtectedDraft, readProtectedDraft, saveProtectedDraft } from "@/lib/protected-session-draft";
import { useRegionalSuggestion } from "@/hooks/use-regional-suggestion";
import { canAcceptAccountResult } from "@/lib/account-scoped-queries";
import { registrationStepError, type RegistrationStep } from "@/lib/technician-registration-wizard";
import { TechnicianPanelNavigation } from "@/components/technician-panel-navigation";
import { technicianTabFromHash, technicianTabHref, type TechnicianPanelTab } from "@/lib/technician-panel-navigation";
import { ArrowRight, ShieldCheck, MapPin, UserRound, Inbox, Camera } from "lucide-react";

export const Route = createFileRoute("/area-tecnico")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Área do técnico — Encontre um Técnico" },
      { name: "description", content: "Painel do técnico: cadastro gratuito, confirmação dos dados WordPress e especialidades atendidas." },
      { property: "og:title", content: "Área do técnico — Encontre um Técnico" },
      { property: "og:description", content: "Painel do técnico: cadastro gratuito, confirmação dos dados WordPress e especialidades atendidas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechnicianAreaPage,
});

const STATUS_LABEL = { pendente: "Complete seus dados para publicar", aprovado: "Publicado — visível na busca", rejeitado: "Oculto", suspenso: "Visibilidade suspensa" };
const activationDb = supabase as unknown as SupabaseClient;

export function TechnicianAreaPage() {
  const lp2 = useContext(LP2EmbeddedContext);
  const { user, roles, loading, rolesError, refreshRoles } = useAuth();
  const { categories, loading: catalogLoading, error: catalogError } = useActiveCategories();
  const { services, loading: servicesLoading, error: servicesError } = useActiveServices();
  const [form, setForm] = useState({
    display_name: "", state_uf: "", city: "", neighborhood: "", region: "", bio: "",
    specialties: [] as string[], service_slugs: [] as string[], base_city_ibge_id: null as number | null,
  });
  const [status, setStatus] = useState<keyof typeof STATUS_LABEL | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [savedCoverageIds, setSavedCoverageIds] = useState<number[]>([]);
  const [savedRadius, setSavedRadius] = useState<number | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [profileOwnerId, setProfileOwnerId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<RegistrationStep>(1);
  const [panelTab, setPanelTab] = useState<TechnicianPanelTab>("inicio");
  useEffect(() => {
    // Both canonical and isolated LP2 routes remain functional. Hash changes
    // create deep links without reloading the account or losing form state.
    const syncTab = () => setPanelTab(technicianTabFromHash(window.location.hash));
    syncTab();
    window.addEventListener("hashchange", syncTab);
    return () => window.removeEventListener("hashchange", syncTab);
  }, []);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const loadVersion = useRef(0);
  const draftOwnerRef = useRef<string | null>(null);
  const serverFormBaselineRef = useRef<string>("");
  const currentUserRef = useRef<string | null>(null);
  currentUserRef.current = user?.id ?? null;
  const roleKey = roles.join(",");
  const { area: regionalHint } = useRegionalSuggestion();
  const { cities: officialBaseCities } = useMunicipalities(form.state_uf);
  const baseMunicipality = officialBaseCities.find((city) => city.id === form.base_city_ibge_id) ?? null;
  const currentStatus = roles.includes("tecnico") && profileOwnerId === user?.id ? status : null;
  const profileReady = Boolean(user && roles.includes("tecnico")
    && profileOwnerId === user.id && !profileLoading && !profileError);

  useEffect(() => {
    const version = ++loadVersion.current;
    const initial = {
      display_name: user ? googleIdentityHint(user).fullName.slice(0, 80) : "",
      state_uf: "", city: "", neighborhood: "", region: "", bio: "",
      specialties: [] as string[], service_slugs: [] as string[],
      base_city_ibge_id: null as number | null,
    };
    serverFormBaselineRef.current = JSON.stringify(initial);
    draftOwnerRef.current = null;
    setForm(initial);
    setStatus(null);
    setProfileId(null);
    setProfileSlug(null);
    setSavedCoverageIds([]);
    setSavedRadius(null);
    setAvatarPath(null);
    setProfileOwnerId(null);
    setProfileError(false);
    setMsg(null);
    setSaving(false);
    setStep(1);
    if (!user || !roles.includes("tecnico")) {
      setProfileLoading(false);
      return () => { loadVersion.current++; };
    }

    const owner = user.id;
    setProfileLoading(true);
    let active = true;
    void Promise.resolve(supabase.from("technicians").select("*")
      .eq("user_id", owner).maybeSingle())
      .then(({ data, error }) => {
        if (!active || !canAcceptAccountResult(owner, currentUserRef.current, version, loadVersion.current)) return;
        if (error) {
          setProfileError(true);
        } else if (data) {
          const loadedForm = {
            display_name: data.display_name,
            state_uf: data.state_uf ?? "",
            city: data.city,
            neighborhood: data.neighborhood ?? "",
            region: data.region ?? "",
            bio: data.bio ?? "",
            specialties: data.specialties ?? [],
            service_slugs: data.service_slugs ?? [],
            base_city_ibge_id: null as number | null,
          };
          serverFormBaselineRef.current = JSON.stringify(loadedForm);
          setForm(loadedForm);
          setSavedCoverageIds(data.coverage_city_ids ?? []);
          setSavedRadius(data.service_radius_km ?? null);
          setAvatarPath(data.avatar_path ?? null);
          setStatus(data.status);
          setProfileId(data.id);
          setProfileSlug(data.public_slug);
        }
        setProfileOwnerId(owner);
        setProfileLoading(false);
      }).catch(() => {
        if (!active || !canAcceptAccountResult(owner, currentUserRef.current, version, loadVersion.current)) return;
        setProfileError(true);
        setProfileOwnerId(owner);
        setProfileLoading(false);
      });
    return () => {
      active = false;
      loadVersion.current++;
    };
  }, [user?.id, roleKey, reloadCounter]);

  useEffect(() => {
    if (!user || !roles.includes("tecnico")) {
      draftOwnerRef.current = null;
      return;
    }
    if (profileLoading || profileError || profileOwnerId !== user.id ||
        draftOwnerRef.current === user.id) return;
    const existing = readProtectedDraft<typeof form>("tecnico", user.id);
    draftOwnerRef.current = user.id;
    if (!existing) return;
    const value = existing.form;
    if (typeof value.display_name !== "string" || typeof value.state_uf !== "string" ||
        typeof value.city !== "string" || typeof value.neighborhood !== "string" ||
        typeof value.region !== "string" || typeof value.bio !== "string" ||
        !Array.isArray(value.specialties) || !Array.isArray(value.service_slugs) ||
        !value.specialties.every(item => typeof item === "string") ||
        !value.service_slugs.every(item => typeof item === "string")) return;
    setForm({
      display_name: value.display_name.slice(0, 80),
      state_uf: value.state_uf.slice(0, 2),
      city: value.city.slice(0, 80),
      neighborhood: value.neighborhood.slice(0, 80),
      region: value.region.slice(0, 120),
      bio: value.bio.slice(0, 1000),
      specialties: value.specialties.slice(0, 20),
      service_slugs: value.service_slugs.slice(0, 40),
      base_city_ibge_id: typeof value.base_city_ibge_id === "number" ? value.base_city_ibge_id : null,
    });
    setStep(Math.max(1, Math.min(3, existing.step)) as RegistrationStep);
    setMsg("Rascunho do cadastro recuperado nesta aba. Confira antes de publicar.");
  }, [user?.id, roleKey, profileLoading, profileError, profileOwnerId]);

  useEffect(() => {
    if (!user || loading || !roles.includes("tecnico") || profileLoading ||
        profileError || profileOwnerId !== user.id || draftOwnerRef.current !== user.id) return;
    const fingerprint = JSON.stringify(form);
    if (fingerprint === serverFormBaselineRef.current) return;
    const owner = user.id;
    const timer = window.setTimeout(() => {
      if (currentUserRef.current === owner && draftOwnerRef.current === owner &&
          fingerprint !== serverFormBaselineRef.current)
        saveProtectedDraft("tecnico", owner, form, step);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [user?.id, loading, roleKey, profileLoading, profileError, profileOwnerId, form, step]);

  const catalog = { categories, services, catalogLoading, catalogError: Boolean(catalogError),
    servicesLoading, servicesError: Boolean(servicesError) };
  function moveToStep(next: RegistrationStep) {
    setMsg(null);
    setStep(next);
    // Focus the heading rather than jumping the viewport unexpectedly while typing.
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => stepHeadingRef.current?.focus());
    }
  }
  function advance() {
    const validation = registrationStepError(step, form, catalog);
    if (validation) { setMsg(validation); return; }
    if (step < 3) moveToStep((step + 1) as RegistrationStep);
  }

  useEffect(() => {
    // Only suggest for a brand-new technician profile after loading completes.
    // A known profile, manually selected municipality or existing field always wins.
    if (loading || !user || !roles.includes("tecnico") || profileLoading ||
        profileError || profileId || !regionalHint) return;
    setForm(previous => suggestTechnicianArea(previous, regionalHint, "automatic"));
  }, [loading, user?.id, roleKey, profileLoading, profileError, profileId, regionalHint?.city, regionalHint?.uf]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user || !profileReady || saving) return;
    if (step < 3) { advance(); return; }
    const firstError = registrationStepError(1, form, catalog);
    const serviceError = registrationStepError(2, form, catalog);
    if (firstError || serviceError) { setMsg(firstError || serviceError); return; }
    const savingOwner = user.id;
    if (!validMunicipality(form.state_uf, form.city)) return setMsg("Selecione a UF e informe uma cidade válida para sua área de atendimento.");
    if (catalogLoading || catalogError || !categories.length) return setMsg("O catálogo está indisponível. Não é possível validar especialidades agora.");
    if (form.specialties.length === 0) return setMsg("Escolha pelo menos uma especialidade.");
    if (form.specialties.some((slug) => !categories.some((c) => c.slug === slug))) return setMsg("Selecione apenas categorias ativas do catálogo.");
    if (servicesLoading || servicesError) return setMsg("O catálogo de serviços não está disponível. Tente novamente.");
    if (form.service_slugs.length === 0) return setMsg("Escolha pelo menos um serviço específico que você executa.");
    if (form.service_slugs.some((slug) => !services.some((service) => service.slug === slug && form.specialties.includes(service.category_slug)))) return setMsg("Os serviços precisam pertencer às categorias selecionadas e estar ativos.");
    setSaving(true);
    setMsg(null);
    try {
      // Só a RPC do servidor define o status público; a tela não pode aprovar um perfil incompleto.
      const { data, error } = await activationDb.rpc("eut_publish_my_technician", {
        _display_name: form.display_name.trim(),
        _state_uf: form.state_uf,
        _city: form.city.trim(),
        _neighborhood: form.neighborhood.trim() || null,
        _region: form.region.trim() || null,
        _bio: form.bio.trim() || null,
        _specialties: form.specialties,
        _service_slugs: form.service_slugs,
      });
      if (currentUserRef.current !== savingOwner) return;
      if (error) {
        setMsg("Não foi possível publicar. Confira cidade, categorias e serviços e tente novamente.");
      } else if (data?.state === "bloqueado_por_seguranca") {
        setMsg("Seu perfil tem uma restrição de segurança e não pode ser reativado automaticamente. Entre em contato.");
      } else if (data?.state === "publicado") {
        serverFormBaselineRef.current = JSON.stringify(form);
        clearProtectedDraft("tecnico", savingOwner);
        setStatus("aprovado");
        if (typeof data.technician_id === "string") {
          setProfileId(data.technician_id);
          // Public slug is generated server-side; UUID remains private routing data.
          const { data: published } = await supabase.from("technicians")
            .select("public_slug").eq("id", data.technician_id).maybeSingle();
          if (currentUserRef.current === savingOwner && published?.public_slug) {
            setProfileSlug(published.public_slug);
          }
        }
        setMsg("Perfil publicado automaticamente. Os dados profissionais são declarados por você; não há avaliação técnica do portal.");
      } else {
        setMsg("A publicação não foi concluída. Tente novamente.");
      }
    } catch {
      if (currentUserRef.current === savingOwner) setMsg("Falha de conexão ao publicar. Tente novamente.");
    } finally {
      if (currentUserRef.current === savingOwner) setSaving(false);
    }
  }

  const input = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-7 rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Meu espaço profissional</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Painel do técnico</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Perfil, cobertura, solicitações e indicações organizados por área. Cadastro livre, sem mensalidade e sem intermediação.</p>
        </div>
        {loading ? (
          <div role="status" className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Carregando sua conta com segurança…
          </div>
        ) : !user ? (
          <div className="max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-bold text-card-foreground">Entre para acessar seu painel</h2>
            <p className="mt-2 text-sm text-muted-foreground">Seu painel não fica disponível sem autenticação. Após o Google ou e-mail, sua conta será reconhecida e você poderá continuar o cadastro.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to={lp2 ? "/lp2/entrar" : "/entrar"} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">
                Entrar na minha conta <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/cadastro" className="inline-flex min-h-12 items-center rounded-xl border border-input px-5 py-3 text-sm font-semibold text-foreground">
                Primeiro acesso
              </Link>
            </div>
          </div>
        ) : rolesError ? (
          <div role="alert" className="max-w-2xl rounded-2xl border border-destructive/30 bg-card p-6 shadow-sm">
            <h2 className="text-lg font-bold text-card-foreground">Não conseguimos consultar suas permissões</h2>
            <p className="mt-2 text-sm text-muted-foreground">Sua sessão continua conectada. Não é necessário criar outra conta nem fazer login novamente.</p>
            <button type="button" onClick={() => void refreshRoles()} className="mt-4 min-h-12 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
              Tentar carregar meu painel novamente
            </button>
          </div>
        ) : !roles.includes("tecnico") ? (
          <div className="max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-bold text-card-foreground">Sua conta está conectada</h2>
            <p className="mt-2 text-sm text-muted-foreground">Esta conta ainda não possui uma área de técnico. Não precisa entrar novamente: escolha sua função no cadastro ou abra a área já associada.</p>
            <Link to={roles.includes("admin") ? "/admin" : roles.includes("cliente") ? "/area-cliente" : "/entrar"}
              className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
              {roles.includes("admin") ? "Abrir administração" : roles.includes("cliente") ? "Abrir área do cliente" : "Confirmar meu tipo de conta"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : !profileReady ? (
          <div className="mt-4 rounded-lg border border-border p-4">
            {profileError ? (
              <>
                <p role="alert" className="text-sm text-destructive">
                  Não conseguimos consultar seu cadastro. Nenhuma alteração foi feita.
                </p>
                <button type="button" onClick={() => setReloadCounter((value) => value + 1)}
                  className="mt-3 min-h-11 rounded-md border border-primary px-4 text-sm font-semibold text-primary">
                  Tentar carregar novamente
                </button>
              </>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">Carregando seu cadastro…</p>
            )}
          </div>
        ) : (
          <div className="grid min-w-0 gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
            <TechnicianPanelNavigation active={panelTab} onChange={setPanelTab} />
            <main id={technicianTabHref(panelTab).slice(1)} className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
              aria-label={"Área do técnico: " + panelTab}>
              {panelTab === "inicio" && (
                <div>
                  <ConnectedGoogleIdentity user={user} />
            <p className="mt-2 text-xs text-muted-foreground">Nome e foto são sugestões do provedor de login. Confirme seus dados profissionais antes de publicar; sua foto pública é configurada separadamente.</p>
            {currentStatus && (
              <p className="mt-3 inline-block rounded-md bg-muted px-3 py-1 text-sm text-foreground">
                Situação: <strong>{STATUS_LABEL[currentStatus]}</strong>
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastro gratuito: informe nome, cidade, especialidades e pelo menos um serviço executado. Ao publicar, seu perfil entra na busca automaticamente, sem certificação de capacidade técnica pelo portal.
            </p>
            {currentStatus === "aprovado" && profileId && (
              <Link to="/tecnicos/$tecnicoId" params={{ tecnicoId: profileSlug || profileId }}
                className="mt-3 inline-flex min-h-11 items-center rounded-md border border-primary px-4 text-sm font-semibold text-primary">
                Conferir meu perfil publicado
              </Link>
            )}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {([
                { tab: "perfil", title: "Meu perfil profissional", detail: "Nome, cidade, especialidades e serviços", icon: UserRound },
                { tab: "cobertura", title: "Regiões atendidas", detail: "Até cinco cidades validadas e raio", icon: MapPin },
                { tab: "foto", title: "Foto pública", detail: avatarPath ? "Foto associada ao perfil" : "Adicionar minha foto com consentimento", icon: Camera },
                { tab: "solicitacoes", title: "Solicitações", detail: "Disponibilidade e pedidos autorizados", icon: Inbox },
              ] as const).map((card) => {
                const Icon = card.icon;
                return <a key={card.tab} href={technicianTabHref(card.tab)} onClick={() => setPanelTab(card.tab)}
                  className="group flex min-h-28 gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                  <span><strong className="block text-sm font-bold text-foreground">{card.title}</strong>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{card.detail}</span></span>
                </a>;
              })}
            </div>
            <p className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
              <ShieldCheck className="mr-2 inline h-5 w-5 text-primary" aria-hidden="true" />
              Seu cadastro é gratuito. A publicação depende dos dados profissionais que você confirmar.
              O portal não certifica sua capacidade técnica e não divulga seu contato privado sem autorização.
            </p>
                </div>
              )}
              {panelTab === "recuperacao" && (
            <details open className="mt-2 rounded-xl border border-border bg-muted/20 p-4">
              <summary className="cursor-pointer py-2 text-sm font-semibold text-primary">
                Já tinha cadastro no portal antigo? Recuperar meus dados
              </summary>
              <div className="mt-4 space-y-4">
            <LegacyAccountActivation userId={user.id} role="tecnico" />
            <LegacyProfileImport userId={user.id}
              onUse={(data) => setForm((current) => ({
                ...current,
                display_name: data.display_name || current.display_name,
                bio: data.bio || current.bio,
              }))}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Não encontrou o cadastro que era seu?{" "}
              <Link to="/reivindicar-cadastro" className="font-medium text-primary underline">
                Informar um perfil antigo manualmente
              </Link>
            </p>

              </div>
            </details>
              )}
              {panelTab === "perfil" && (
            <form onSubmit={save} className="mt-2 grid gap-4" noValidate>
              <div className="rounded-2xl border border-primary/20 bg-card p-4 shadow-sm sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Cadastro guiado · Passo {step} de 3</p>
                <div className="mt-3 grid grid-cols-3 gap-2" role="progressbar"
                  aria-label="Progresso do cadastro profissional" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step}>
                  {(["Seus dados", "Serviços", "Revisão"] as const).map((label, index) => (
                    <div key={label} className="min-w-0">
                      <div className={`h-1.5 rounded-full ${index + 1 <= step ? "bg-primary" : "bg-muted"}`} />
                      <span className={`mt-2 block text-center text-xs ${index + 1 === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
                    </div>
                  ))}
                </div>
                <h2 ref={stepHeadingRef} tabIndex={-1} className="mt-5 text-xl font-bold text-foreground outline-none sm:text-2xl">
                  {step === 1 ? "Seu nome e onde você atende" : step === 2 ? "Quais serviços você realiza?" : "Revise e publique seu perfil"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step === 1 ? "Informe apenas a região de atendimento. Você pode usar o GPS para sugerir cidade e bairro, sem publicar sua posição exata."
                    : step === 2 ? "Selecione categorias e pelo menos um serviço que você realmente executa. Sem certificação automática."
                    : "Confira tudo antes de publicar. Somente o servidor pode autorizar seu perfil público."}
                </p>
              </div>
              {step === 1 && (
                <div className="grid gap-4">
              <label className="text-sm font-medium text-foreground">Nome público
                <input required minLength={2} maxLength={80} className={input} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </label>
              {regionalHint && <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                 <strong className="text-foreground">Região aproximada: {regionalHint.city}/{regionalHint.uf}.</strong>
                 {" "}Não é automaticamente sua área de atendimento. Confirme sua cidade real antes de publicar.
               </p>}
              <CustomerLocationButton
                purpose="technician"
                autoIfGranted={!profileId && !form.state_uf && !form.city.trim() && !form.neighborhood.trim()}
                onLocated={(area, source) => {
                  setForm((current) => suggestTechnicianArea(current, area, source));
                }}
              />
              <p className="text-xs text-muted-foreground">
                O GPS é apenas uma sugestão da sua localização atual. Confira a cidade
                e informe as regiões onde você realmente atende antes de publicar.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-foreground">Estado (UF)
                  <select required className={input} value={form.state_uf} onChange={(e) => setForm({ ...form, state_uf: e.target.value, city: "", base_city_ibge_id: null })}>
                    <option value="">Selecione o estado</option>
                    {BRAZIL_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </label>
                <MunicipalityPicker uf={form.state_uf} selectedId={form.base_city_ibge_id}
                  currentCityName={form.city}
                  onSelect={(city) => setForm((current) => ({
                    ...current, city: city.name, base_city_ibge_id: city.id,
                  }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-foreground">Bairro de referência (opcional)
                  <input maxLength={80} className={input} value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
                </label>
                <label className="text-sm font-medium text-foreground">Regiões e outros bairros atendidos
                  <input maxLength={120} className={input} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                </label>
              </div>
                </div>
              )}
              {step === 2 && (
                <div className="grid gap-4">
              <fieldset>
                <legend className="text-sm font-medium text-foreground">Especialidades</legend>
                {catalogLoading && <p className="mt-2 text-sm text-muted-foreground">Carregando categorias…</p>}
                {catalogError && <p role="alert" className="mt-2 text-sm text-destructive">Não foi possível carregar o catálogo. Recarregue a página.</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const on = form.specialties.includes(c.slug);
                    return (
                      <button type="button" key={c.slug} aria-pressed={on}
                        onClick={() => setForm({ ...form, specialties: on ? form.specialties.filter((s) => s !== c.slug) : [...form.specialties, c.slug], service_slugs: on ? form.service_slugs.filter((slug) => services.find((service) => service.slug === slug)?.category_slug !== c.slug) : form.service_slugs })}
                        className={`min-h-11 rounded-full border px-4 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground"}`}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-medium text-foreground">Serviços que você realmente executa</legend>
                <p className="mt-1 text-xs text-muted-foreground">Selecione os serviços que você realmente executa dentro das categorias. Seu perfil completo pode ser publicado automaticamente; o portal não certifica competência técnica.</p>
                {servicesLoading && <p className="mt-2 text-sm text-muted-foreground">Carregando serviços…</p>}
                {servicesError && <p role="alert" className="mt-2 text-sm text-destructive">Serviços indisponíveis. Recarregue a página.</p>}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {services.filter((service) => form.specialties.includes(service.category_slug)).map((service) => (
                    <label key={service.slug} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <input type="checkbox" className="h-4 w-4" checked={form.service_slugs.includes(service.slug)}
                        onChange={(e) => setForm((old) => ({ ...old, service_slugs: e.target.checked ? [...old.service_slugs, service.slug] : old.service_slugs.filter((slug) => slug !== service.slug) }))} />
                      <span>{service.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
                </div>
              )}
              {step === 3 && (
                <div className="grid gap-4">
                  <div className="rounded-xl border border-border bg-muted/25 p-4 text-sm">
                    <p className="font-semibold text-foreground">{form.display_name.trim()}</p>
                    <p className="mt-1 text-muted-foreground">
                      {form.city.trim()}/{form.state_uf}
                      {form.neighborhood.trim() ? ` · ${form.neighborhood.trim()}` : ""}
                    </p>
                    <p className="mt-3 font-semibold text-foreground">Especialidades escolhidas</p>
                    <p className="mt-1 text-muted-foreground">
                      {categories.filter((category) => form.specialties.includes(category.slug))
                        .map((category) => category.label).join(", ")}
                    </p>
                    <p className="mt-3 font-semibold text-foreground">Serviços que você realiza</p>
                    <p className="mt-1 text-muted-foreground">
                      {services.filter((service) => form.service_slugs.includes(service.slug))
                        .map((service) => service.label).join(", ")}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Cidade-base validada: {form.city || "a selecionar"}{form.base_city_ibge_id ? " · IBGE " + form.base_city_ibge_id : ""}.
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Ao publicar, estas especialidades e sua região de atendimento
                      poderão aparecer no perfil público. Nenhum contato privado é divulgado.
                    </p>
                  </div>
              <label className="text-sm font-medium text-foreground">Apresentação
                <textarea maxLength={1000} rows={4} className={input} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </label>
                </div>
              )}
              {msg && <p role="alert" className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">{msg}</p>}
              <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center gap-2 border-t border-border bg-background/95 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-lg backdrop-blur sm:static sm:mx-0 sm:rounded-xl sm:border sm:shadow-none">
                {step > 1 && (
                  <button type="button" onClick={() => moveToStep((step - 1) as RegistrationStep)}
                    className="min-h-12 shrink-0 rounded-xl border border-border px-5 text-sm font-semibold text-foreground">
                    Voltar
                  </button>
                )}
                {step < 3 ? (
                  <button type="button" onClick={advance} disabled={saving || !profileReady}
                    className="min-h-12 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                    Continuar <span aria-hidden="true">→</span>
                  </button>
                ) : (
                  <button type="submit" disabled={saving || !profileReady || catalogLoading || catalogError || servicesLoading || servicesError || categories.length === 0}
                    className="min-h-12 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                    {saving ? "Publicando…" : currentStatus === "aprovado" ? "Atualizar meu perfil público" : "Publicar meu perfil gratuitamente"}
                  </button>
                )}
              </div>
            </form>
              )}
              {panelTab === "cobertura" && (
                <section aria-labelledby="area-cobertura-titulo">
                  <h2 id="area-cobertura-titulo" className="text-2xl font-bold text-foreground">Minha cobertura</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Defina as localidades oficiais onde atua. O raio é declarado e não informa a localização exata da sua residência.</p>
                  {currentStatus === "aprovado" && profileId ? (
                    <TechnicianCoverageEditor userId={user.id} baseMunicipality={baseMunicipality}
                      savedCityIds={savedCoverageIds} savedRadius={savedRadius} />
                  ) : (
                    <div className="mt-5 rounded-xl border border-border bg-muted/30 p-5">
                      <p className="text-sm text-foreground">Publique primeiro seu perfil profissional com uma cidade-base válida para liberar o editor de regiões.</p>
                      <a href={technicianTabHref("perfil")} onClick={() => setPanelTab("perfil")} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Completar meu perfil</a>
                    </div>
                  )}
                </section>
              )}
              {panelTab === "foto" && (
                <section aria-labelledby="area-foto-titulo">
                  <h2 id="area-foto-titulo" className="text-2xl font-bold text-foreground">Foto do perfil</h2>
                  <p className="mt-2 text-sm text-muted-foreground">A foto pública precisa ser enviada e autorizada por você. A foto privada do Google não será publicada automaticamente.</p>
                  {currentStatus === "aprovado" && profileId ? (
                    <TechnicianAvatarEditor userId={user.id} name={form.display_name}
                      avatarPath={avatarPath} onSaved={setAvatarPath} />
                  ) : (
                    <div className="mt-5 rounded-xl border border-border bg-muted/30 p-5">
                      <p className="text-sm text-foreground">Publique primeiro seu perfil para enviar a foto profissional.</p>
                      <a href={technicianTabHref("perfil")} onClick={() => setPanelTab("perfil")} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Ir ao cadastro</a>
                    </div>
                  )}
                </section>
              )}
              {panelTab === "solicitacoes" && (
                <section aria-labelledby="area-solicitacoes-titulo" className="space-y-5">
                  <div>
                    <h2 id="area-solicitacoes-titulo" className="text-2xl font-bold text-foreground">Solicitações e disponibilidade</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Somente pedidos que o cliente optou por compartilhar com seu perfil. Sem leilão de serviços e sem distribuição automática.</p>
                  </div>
                  {currentStatus === "aprovado" ? (
                    <>
                      <TechnicianPresence userId={user.id} />
                      <TechnicianDirectRequests userId={user.id} />
                    </>
                  ) : (
                    <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm text-foreground">
                      Publique seu perfil para receber pedidos autorizados e informar disponibilidade.
                      <a href={technicianTabHref("perfil")} onClick={() => setPanelTab("perfil")} className="mt-3 block font-bold text-primary underline">Abrir meu perfil profissional</a>
                    </div>
                  )}
                </section>
              )}
              {panelTab === "indicacoes" && (
                <section aria-labelledby="area-indicacoes-titulo">
                  <h2 id="area-indicacoes-titulo" className="text-2xl font-bold text-foreground">Missões e indicações</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Convide técnicos de forma voluntária. Destaque só após indicações qualificadas, sem comissão financeira automática.</p>
                  <TechnicianMissions userId={user.id} />
                </section>
              )}
              {panelTab === "configuracoes" && (
                <section aria-labelledby="area-seguranca-titulo" className="space-y-5">
                  <div>
                    <h2 id="area-seguranca-titulo" className="text-2xl font-bold text-foreground">Minha segurança e contatos</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Telefone e confirmações ficam em sua área privada. Nenhum contato completo é mostrado automaticamente no perfil público.</p>
                  </div>
                  <TechnicianPrivateContact userId={user.id} />
                  <PioneerPhoneVerification userId={user.id} />
                  <div className="rounded-xl border border-border bg-muted/30 p-5">
                    <h3 className="text-base font-bold text-foreground">Contratação direta, sem intermediação</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Seu contato privado não é exibido livremente. O pagamento por contato ainda está em integração;
                      não exibimos aquisições nem cobranças fictícias nesta fase.
                    </p>
                  </div>
                </section>
              )}
            </main>
          </div>
        )}
      </section>
    </PageShell>
  );
}
