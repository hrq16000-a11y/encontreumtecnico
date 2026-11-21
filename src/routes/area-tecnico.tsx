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
import { validMunicipality } from "@/lib/service-taxonomy";
import { useMunicipalities } from "@/hooks/use-municipalities";
import { LocationField, type LocationFieldValue } from "@/components/location-field";
import { TechnicianCoverageEditor } from "@/components/technician-coverage-editor";
import { TechnicianOperationsEditor } from "@/components/technician-operations-editor";
import { TechnicianAvatarEditor } from "@/components/technician-avatar-editor";
import { TechnicianBioPreview } from "@/components/technician-bio-preview";
import { LegacyAccountActivation } from "@/components/legacy-account-activation";
import { LegacyProfileImport } from "@/components/legacy-profile-import";
import { TechnicianPresence } from "@/components/technician-presence";
import { TechnicianMissions } from "@/components/technician-missions";
import { TechnicianPrivateContact } from "@/components/technician-private-contact";
import { TechnicianDirectRequests } from "@/components/technician-direct-requests";
import { safeNeighborhood } from "@/lib/location-labels";
import { changeTechnicianPlace, needsLocationDraftConfirmation } from "@/lib/technician-place-change";
import { clearProtectedDraft, readProtectedDraft, saveProtectedDraft } from "@/lib/protected-session-draft";
import { saveTechnicianDraftImmediately } from "@/lib/technician-live-draft";
import { canAcceptAccountResult } from "@/lib/account-scoped-queries";
import { matchingRegistrationCategories, matchingRegistrationServices, groupRegistrationServices, toggleVisibleRegistrationServices, selectedRegistrationServices, reconcileRegistrationSelections, registrationReviewIssue, registrationStepError, shouldSubmitTechnicianWizard, type RegistrationStep } from "@/lib/technician-registration-wizard";
import { hydrateTechnicianOfficialCity } from "@/lib/technician-official-city-hydration";
import { publicTextProblem } from "@/lib/public-profile-text";
import { technicianPublishErrorMessage } from "@/lib/technician-publish-error";
import { technicianPublicationWasPersisted } from "@/lib/technician-publication-verification";
import { addPublicProfileTopic, PUBLIC_PROFILE_TOPICS, publicProfileHasTopic,
  technicianProfileEnrichment } from "@/lib/technician-profile-enrichment";
import { TechnicianPanelNavigation } from "@/components/technician-panel-navigation";
import { TechnicianPublicProfileLink } from "@/components/technician-public-profile-link";
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

const STATUS_LABEL = { pendente: "Complete seus dados para publicar", aprovado: "Cadastro salvo", rejeitado: "Oculto", suspenso: "Visibilidade suspensa" };
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
  // Set only after verifying this account's published row in the server.
  const [justPublishedProfile, setJustPublishedProfile] = useState<string | null>(null);
  const [savedCoverageIds, setSavedCoverageIds] = useState<number[]>([]);
  const [savedRadius, setSavedRadius] = useState<number | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [profileOwnerId, setProfileOwnerId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [validationIssue, setValidationIssue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<RegistrationStep>(1);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
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
  const validationIssueRef = useRef<HTMLParagraphElement>(null);
  const loadVersion = useRef(0);
  const draftOwnerRef = useRef<string | null>(null);
  const [draftRestoredOwnerId, setDraftRestoredOwnerId] = useState<string | null>(null);
  const serverFormBaselineRef = useRef<string>("");
  // Source of truth for allowing an unchanged persisted municipality during edit.
  // A private session draft or geolocation hint must never grant this exception.
  const persistedCityRef = useRef<{ ownerId: string; state_uf: string; city: string } | null>(null);
  const currentUserRef = useRef<string | null>(null);
  currentUserRef.current = user?.id ?? null;
  const roleKey = roles.join(",");
  const [postalCodeHint, setPostalCodeHint] = useState("");
  useEffect(() => setPostalCodeHint(""), [user?.id]);
  const { cities: officialBaseCities } = useMunicipalities(form.state_uf);
  const baseMunicipality = officialBaseCities.find((city) => city.id === form.base_city_ibge_id) ?? null;
  const currentStatus = roles.includes("tecnico") && profileOwnerId === user?.id ? status : null;
  const profileGuidance = technicianProfileEnrichment({
    ...form, avatar_path: avatarPath, coverage_city_ids: savedCoverageIds,
  });
  const profileReady = Boolean(user && roles.includes("tecnico")
    && profileOwnerId === user.id && !profileLoading && !profileError);
  const persistedCity = user && persistedCityRef.current?.ownerId === user.id
    ? persistedCityRef.current : null;
  const editingUnchangedCity = Boolean(persistedCity && form.base_city_ibge_id === null &&
    form.state_uf === persistedCity.state_uf && form.city.trim() === persistedCity.city.trim());

  // Read the latest committed draft on tab backgrounding or a hard navigation.
  // Account ownership and published-profile guards remain mandatory.
  const latestFormRef = useRef(form);
  const latestStepRef = useRef(step);
  const canFlushDraftRef = useRef(false);
  latestFormRef.current = form;
  latestStepRef.current = step;
  canFlushDraftRef.current = Boolean(profileReady && draftOwnerRef.current === user?.id);

  function writeDraft(nextForm: typeof form, nextStep: RegistrationStep) {
    const owner = user?.id ?? null;
    const verified = Boolean(profileReady && owner && draftOwnerRef.current === owner
      && currentUserRef.current === owner);
    return saveTechnicianDraftImmediately(owner, verified, nextForm, nextStep);
  }
  function updateRegistration(nextForm: typeof form) {
    writeDraft(nextForm, step); // Input event, before the route or browser tab changes.
    setValidationIssue(null);
    setForm(nextForm);
  }

  useEffect(() => {
    const flush = () => {
      const owner = currentUserRef.current;
      if (!canFlushDraftRef.current || !owner ||
          JSON.stringify(latestFormRef.current) === serverFormBaselineRef.current) return;
      saveTechnicianDraftImmediately(owner, true, latestFormRef.current, latestStepRef.current);
    };
    const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);

  useEffect(() => {
    const version = ++loadVersion.current;
    const initial = {
      display_name: user ? googleIdentityHint(user).fullName.slice(0, 80) : "",
      state_uf: "", city: "", neighborhood: "", region: "", bio: "",
      specialties: [] as string[], service_slugs: [] as string[],
      base_city_ibge_id: null as number | null,
    };
    serverFormBaselineRef.current = JSON.stringify(initial);
    persistedCityRef.current = null;
    draftOwnerRef.current = null;
    setDraftRestoredOwnerId(null);
    setForm(initial);
    setStatus(null);
    setProfileId(null);
    setJustPublishedProfile(null);
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
          persistedCityRef.current = { ownerId: owner, state_uf: loadedForm.state_uf, city: loadedForm.city };
          setForm(loadedForm);
          setSavedCoverageIds(data.coverage_city_ids ?? []);
          setSavedRadius(data.service_radius_km ?? null);
          setAvatarPath(data.avatar_path ?? null);
          setStatus(data.status);
          setProfileId(data.id);
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
      setDraftRestoredOwnerId(null);
      return;
    }
    if (profileLoading || profileError || profileOwnerId !== user.id ||
        draftOwnerRef.current === user.id) return;
    const existing = readProtectedDraft<typeof form>("tecnico", user.id);
    draftOwnerRef.current = user.id;
    if (!existing) {
      setDraftRestoredOwnerId(user.id);
      return;
    }
    const value = existing.form;
    if (typeof value.display_name !== "string" || typeof value.state_uf !== "string" ||
        typeof value.city !== "string" || typeof value.neighborhood !== "string" ||
        typeof value.region !== "string" || typeof value.bio !== "string" ||
        !Array.isArray(value.specialties) || !Array.isArray(value.service_slugs) ||
        !value.specialties.every(item => typeof item === "string") ||
        !value.service_slugs.every(item => typeof item === "string")) {
      setDraftRestoredOwnerId(user.id);
      return;
    }
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
    // Show the editor only after the server profile and this owner's draft are reconciled.
    setDraftRestoredOwnerId(user.id);
  }, [user?.id, roleKey, profileLoading, profileError, profileOwnerId]);

  useEffect(() => {
    if (!user || loading || !roles.includes("tecnico") || profileLoading ||
        profileError || profileOwnerId !== user.id || draftOwnerRef.current !== user.id) return;
    const fingerprint = JSON.stringify(form);
    if (fingerprint === serverFormBaselineRef.current) return;
    const owner = user.id;
    // The last edit cannot remain in a cancelable debounce when the user
    // opens another screen. Keep ownership and published-profile checks.
    if (currentUserRef.current === owner && draftOwnerRef.current === owner &&
        fingerprint !== serverFormBaselineRef.current)
      saveProtectedDraft("tecnico", owner, form, step);
  }, [user?.id, loading, roleKey, profileLoading, profileError, profileOwnerId, form, step]);

  // Existing profiles and pre-IBGE drafts can reopen directly on step 3.
  // The official picker only mounts on step 1, so reconcile the same-city IBGE
  // identity here after restoring this authenticated owner's draft.
  useEffect(() => {
    if (!user || !profileReady || draftRestoredOwnerId !== user.id ||
        form.base_city_ibge_id !== null || officialBaseCities.length === 0) return;
    const owner = user.id;
    setForm(current => currentUserRef.current === owner
      ? hydrateTechnicianOfficialCity(current, officialBaseCities, form.state_uf)
      : current);
  }, [user?.id, profileReady, draftRestoredOwnerId, form.state_uf,
      form.city, form.base_city_ibge_id, officialBaseCities]);

  const catalog = { categories, services, catalogLoading, catalogError: Boolean(catalogError),
    servicesLoading, servicesError: Boolean(servicesError) };
  const catalogReady = !catalogLoading && !catalogError && !servicesLoading && !servicesError;
  const visibleCategories = matchingRegistrationCategories(categories, form.specialties, categoryQuery);
  const availableServiceCount = services.filter((service) => form.specialties.includes(service.category_slug)).length;
  const visibleServices = matchingRegistrationServices(services, form.specialties, serviceQuery, categories);
  const reconciledSelections = catalogReady ? reconcileRegistrationSelections(form, catalog) : null;
  const staleSelections = Boolean(reconciledSelections && (
    reconciledSelections.specialties.length !== form.specialties.length ||
    reconciledSelections.service_slugs.length !== form.service_slugs.length));
  function toggleCategory(slug: string) {
    const specialties = form.specialties.includes(slug)
      ? form.specialties.filter((item) => item !== slug) : [...form.specialties, slug];
    const next = { ...form, specialties };
    updateRegistration(catalogReady ? { ...next, ...reconcileRegistrationSelections(next, catalog) } : next);
  }
  const profileChecklist = [
    { step: 1, label: "Nome e município", ready: registrationStepError(1, form, catalog, persistedCity) === null, essential: true },
    { step: 2, label: "Especialidades e serviços", ready: registrationStepError(2, form, catalog) === null, essential: true },
    { step: 3, label: "Apresentação profissional", ready: form.bio.trim().length >= 80 && !publicTextProblem(form.bio, "bio"), essential: false },
  ] as const;
  // Focus the validation alert on each failed attempt, including repeated taps
  // on the sticky mobile Continue button; no draft or server change occurs.
  function showValidationIssue(message: string) {
    setValidationIssue(message);
    window.requestAnimationFrame(() => validationIssueRef.current?.focus());
  }
  function moveToStep(next: RegistrationStep) {
    writeDraft(form, next); // Preserve wizard stage before React renders.
    setMsg(null);
    setValidationIssue(null);
    setStep(next);
    // Focus the heading rather than jumping the viewport unexpectedly while typing.
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => stepHeadingRef.current?.focus());
    }
  }
  function advance() {
    const validation = registrationStepError(step, form, catalog, persistedCity);
    if (validation) { showValidationIssue(validation); return; }
    if (step < 3) moveToStep((step + 1) as RegistrationStep);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    if (!shouldSubmitTechnicianWizard(step, submitter?.dataset["wizardAction"] ?? null)) return;
    if (!user || !profileReady || saving) return;
    const reviewIssue = registrationReviewIssue(form, catalog, persistedCity);
    if (reviewIssue) {
      moveToStep(reviewIssue.step);
      showValidationIssue(reviewIssue.message);
      return;
    }
    const publicTextError = publicTextProblem(form.bio, "bio")
      || publicTextProblem(form.display_name, "identity")
      || publicTextProblem(form.region, "identity")
      || publicTextProblem(form.neighborhood, "identity");
    if (publicTextError) { setMsg(publicTextError); return; }
    const savingOwner = user.id;
    if (!validMunicipality(form.state_uf, form.city)) return setMsg("Selecione a UF e informe uma cidade válida para sua área de atendimento.");
    if (catalogLoading || catalogError || !categories.length) return setMsg("O catálogo está indisponível. Não é possível validar especialidades agora.");
    if (form.specialties.length === 0) return setMsg("Escolha pelo menos uma especialidade.");
    if (form.specialties.some((slug) => !categories.some((c) => c.slug === slug))) return setMsg("Selecione apenas categorias ativas do catálogo.");
    if (servicesLoading || servicesError) return setMsg("O catálogo de serviços não está disponível. Tente novamente.");
    if (form.service_slugs.length === 0) return setMsg("Escolha pelo menos um serviço específico que você executa.");
    if (form.service_slugs.some((slug) => !services.some((service) => service.slug === slug && form.specialties.includes(service.category_slug)))) return setMsg("Os serviços precisam pertencer às categorias selecionadas e estar ativos.");
    writeDraft(form, 3); // Secure recovery point before publication request.
    setSaving(true);
    setJustPublishedProfile(null);
    setMsg(null);
    try {
      // Só a RPC do servidor define o status público; a tela não pode aprovar um perfil incompleto.
      const { data, error } = await activationDb.rpc("eut_publish_my_technician", {
        _display_name: form.display_name.trim(),
        _state_uf: form.state_uf,
        _city: form.city.trim(),
        _neighborhood: safeNeighborhood(form.neighborhood, form.city) || null,
        _region: form.region.trim() || null,
        _bio: form.bio.trim() || null,
        _specialties: form.specialties,
        _service_slugs: form.service_slugs,
      });
      if (currentUserRef.current !== savingOwner) return;
      if (error) {
        setMsg(technicianPublishErrorMessage(error));
      } else if (data?.state === "bloqueado_por_seguranca") {
        setMsg("Seu perfil tem uma restrição de segurança e não pode ser reativado automaticamente. Entre em contato.");
      } else if (data?.state === "publicado") {
        // A successful RPC response alone does not prove that every field was
        // committed. Verify this account's canonical row before clearing its draft.
        const { data: persisted, error: verifyError } = await supabase.from("technicians")
          .select("id,status,display_name,state_uf,city,neighborhood,region,bio,specialties,service_slugs,public_slug")
          .eq("user_id", savingOwner).maybeSingle();
        if (currentUserRef.current !== savingOwner) return;
        const requested = { ...form, neighborhood: safeNeighborhood(form.neighborhood, form.city) || "" };
        if (!persisted || verifyError || !technicianPublicationWasPersisted(requested, persisted,
          typeof data.technician_id === "string" ? data.technician_id : undefined)) {
          setMsg("O servidor respondeu à publicação, mas não conseguimos confirmar que todos os campos foram gravados. Seu rascunho foi preservado nesta aba. Não crie outra conta; tente recarregar o perfil ou solicite suporte.");
          return;
        }
        serverFormBaselineRef.current = JSON.stringify(form);
        persistedCityRef.current = { ownerId: savingOwner, state_uf: persisted.state_uf ?? "", city: persisted.city };
        clearProtectedDraft("tecnico", savingOwner);
        setStatus("aprovado");
        setProfileId(persisted.id);
        setJustPublishedProfile(persisted.public_slug || persisted.id);
        setMsg("Perfil salvo e conferido no servidor. Complete também a foto, a cobertura e o contato privado nas abas do seu painel.");
      } else {
        setMsg("A publicação não foi concluída. Tente novamente.");
      }
    } catch {
      if (currentUserRef.current === savingOwner) setMsg("Falha de conexão ao publicar. Tente novamente.");
    } finally {
      if (currentUserRef.current === savingOwner) setSaving(false);
    }
  }

  const input = "mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring";

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
        ) : !profileReady || draftRestoredOwnerId !== user.id ? (
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
              <p role="status" aria-live="polite" aria-busy="true" className="text-sm text-muted-foreground">
                {profileReady ? "Recuperando seu rascunho privado…" : "Carregando seu cadastro…"}
              </p>
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
              Cadastro gratuito: informe nome, cidade, especialidades e pelo menos um serviço executado. Você pode consultar aqui se a ficha está disponível no catálogo. O portal não certifica a capacidade técnica do profissional.
            </p>
            <section aria-labelledby="eut-enriquecimento-titulo" className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
              <h2 id="eut-enriquecimento-titulo" className="text-lg font-bold text-foreground">Valorize sua apresentação profissional</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {profileGuidance.complete} de {profileGuidance.total} tópicos informados. Complete no seu ritmo: foto,
                apresentação e cobertura são opcionais. Este guia não é nota, certificação ou posição na busca.
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {profileGuidance.entries.map((item) => (
                  <li key={item.label} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <span className="min-w-0 font-medium text-foreground">{item.label}</span>
                    {item.complete ? <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Informado</span> :
                      <a href={technicianTabHref(item.tab)} className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline"
                        onClick={() => {
                          setPanelTab(item.tab);
                          if (item.tab === "perfil") moveToStep(item.label === "Apresentação detalhada" ? 3 :
                            item.label === "Especialidades e serviços" ? 2 : 1);
                        }}>{item.help}</a>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Informações digitadas podem estar em rascunho. Uma edição só está salva quando o servidor confirma a gravação.</p>
            </section>
            {currentStatus === "aprovado" && profileId && (
              <TechnicianPublicProfileLink ownerId={user.id} profileId={profileId}>
                Conferir meu perfil publicado
              </TechnicianPublicProfileLink>
            )}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {([
                { tab: "perfil", title: "Meu perfil profissional", detail: "Nome, cidade, especialidades e serviços", icon: UserRound },
                { tab: "cobertura", title: "Regiões atendidas", detail: "Até cinco cidades validadas e raio", icon: MapPin },
                { tab: "operacao", title: "Condições de atendimento", detail: "Ferramentas, locomoção, períodos e km", icon: MapPin },
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
                  {step === 1 ? "Escolha seu município oficial. O bairro é informado separadamente e não é identificado com segurança pelo GPS."
                    : step === 2 ? "Selecione categorias e pelo menos um serviço que você realmente executa. Sem certificação automática."
                    : "Confira tudo antes de publicar. Somente o servidor pode autorizar seu perfil público."}
                </p>
                {validationIssue && <p ref={validationIssueRef} tabIndex={-1} role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">{validationIssue}</p>}
                <div className="mt-5 rounded-xl border border-border bg-muted/25 p-3 sm:p-4" aria-label="Checklist do perfil profissional">
                  <p className="text-xs font-semibold text-foreground">
                    {profileChecklist.filter(item => item.ready).length} de 3 itens preparados
                    <span className="ml-2 font-normal text-muted-foreground">Dois essenciais e uma apresentação recomendada.</span>
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                    {profileChecklist.map(item => (
                      <li key={item.label}>
                        <button
                          type="button"
                          onClick={() => moveToStep(item.step)}
                          aria-label={`Ir para ${item.label.toLowerCase()}`}
                          aria-current={step === item.step ? "step" : undefined}
                          className={`rounded-full border px-3 py-1.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${item.ready ? "border-primary/30 bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground"}`}
                        >
                          {item.ready ? "✓ " : "○ "}{item.label}{!item.essential ? " (opcional)" : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {step === 1 && (
                <div className="grid gap-4">
              <label className="text-sm font-medium text-foreground">Nome público
                <input required minLength={2} maxLength={80} className={input} value={form.display_name} onChange={(e) => updateRegistration({ ...form, display_name: e.target.value })} />
              </label>
              <LocationField label="Localidade base do técnico" required={!editingUnchangedCity}
                value={{
                  uf: form.state_uf, city: form.city, municipalityIbgeId: form.base_city_ibge_id,
                  neighborhood: form.neighborhood, postalCode: postalCodeHint,
                }}
                onChange={(next: LocationFieldValue) => {
                  setPostalCodeHint(next.postalCode);
                  const location = {
                    state_uf: next.uf, city: next.city, base_city_ibge_id: next.municipalityIbgeId,
                  };
                  if (needsLocationDraftConfirmation(form, location) &&
                      !window.confirm("Trocar município/UF limpará bairros e áreas anteriores. Continuar?")) return;
                  updateRegistration({
                    ...changeTechnicianPlace(form, location), neighborhood: next.neighborhood,
                  });
                }} />
              {editingUnchangedCity && <p role="status" className="text-xs text-muted-foreground">
                Município antigo preservado sem mudanças; confirme no IBGE se desejar trocá-lo.
              </p>}
              <label className="text-sm font-medium text-foreground">Outras regiões atendidas (opcional)
                <input maxLength={120} className={input} value={form.region}
                  placeholder="Somente áreas adicionais, sem endereço privado"
                  onChange={e => updateRegistration({ ...form, region: e.target.value })} />
              </label>
                </div>
              )}
              {step === 2 && (
                <div className="grid gap-4">
              {staleSelections && reconciledSelections && (
                <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
                  <p>Algumas categorias ou serviços do seu rascunho não estão mais disponíveis. Os itens válidos serão preservados.</p>
                  <button type="button" onClick={() => updateRegistration({ ...form, ...reconciledSelections })}
                    className="mt-3 min-h-11 rounded-lg border border-amber-500/50 bg-background px-4 font-semibold">
                    Remover opções indisponíveis
                  </button>
                </div>
              )}
              <fieldset>
                <legend className="text-sm font-medium text-foreground">Especialidades</legend>
                {catalogLoading && <p className="mt-2 text-sm text-muted-foreground">Carregando categorias…</p>}
                {catalogError && <p role="alert" className="mt-2 text-sm text-destructive">Não foi possível carregar o catálogo. Recarregue a página.</p>}
                <label htmlFor="eut-wizard-category-search" className="mt-3 block text-sm font-medium text-foreground">Buscar especialidade</label>
                <input id="eut-wizard-category-search" type="search" value={categoryQuery} maxLength={80}
                  onChange={(event) => setCategoryQuery(event.target.value)}
                  placeholder="Ex.: informática, elétrica, celulares" className={input} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <p role="status">{visibleCategories.length} de {categories.length} especialidade(s) exibida(s) · {form.specialties.length} selecionada(s)</p>
                  {categoryQuery.trim() && <button type="button" onClick={() => setCategoryQuery("")}
                    className="min-h-10 rounded-lg border border-input px-3 font-semibold text-primary">Limpar busca de especialidades</button>}
                </div>
                {categoryQuery.trim() && form.specialties.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">Suas especialidades selecionadas permanecem visíveis durante a busca.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {visibleCategories.map((c) => {
                    const on = form.specialties.includes(c.slug);
                    return (
                      <button type="button" key={c.slug} aria-pressed={on}
                        onClick={() => toggleCategory(c.slug)}
                        className={`min-h-11 rounded-full border px-4 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground"}`}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                {!catalogLoading && !catalogError && visibleCategories.length === 0 && (
                  <p className="mt-2 text-sm text-muted-foreground">Nenhuma especialidade corresponde à busca. Limpe o filtro para ver todas as opções.</p>
                )}
              </fieldset>
              <fieldset>
                <legend className="text-sm font-medium text-foreground">Serviços que você realmente executa</legend>
                <p className="mt-1 text-xs text-muted-foreground">Marque somente os serviços que você realmente executa. Os termos ajudam o cliente a entender seu trabalho; a publicação só ocorre após sua revisão final.</p>
                <p className="mt-2 text-xs font-semibold text-primary" role="status">
                  {form.specialties.length} especialidade(s) e {form.service_slugs.length} serviço(s) selecionado(s)
                </p>
                {servicesLoading && <p className="mt-2 text-sm text-muted-foreground">Carregando serviços…</p>}
                {servicesError && <p role="alert" className="mt-2 text-sm text-destructive">Serviços indisponíveis. Recarregue a página.</p>}
                <label htmlFor="eut-wizard-service-search" className="mt-3 block text-sm font-medium text-foreground">Buscar serviço ou especialidade</label>
                <input id="eut-wizard-service-search" type="search" value={serviceQuery} maxLength={80}
                  onChange={(event) => setServiceQuery(event.target.value)}
                  placeholder="Ex.: elétrica, manutenção, Wi-Fi" className={input} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <p role="status">{visibleServices.length} de {availableServiceCount} serviço(s) exibido(s) · {form.service_slugs.length} selecionado(s)</p>
                  {serviceQuery.trim() && <button type="button" onClick={() => setServiceQuery("")}
                    className="min-h-10 rounded-lg border border-input px-3 font-semibold text-primary">Limpar busca</button>}
                </div>
                {form.service_slugs.length > 0 && (
                  <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3" role="group" aria-label="Serviços selecionados">
                    <p className="text-xs font-semibold text-foreground">Seus serviços selecionados · {form.service_slugs.length}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedRegistrationServices(services, form.service_slugs).map((service) => (
                        <button key={service.slug} type="button" aria-label={`Remover serviço: ${service.label}`}
                          onClick={() => updateRegistration({ ...form, service_slugs: form.service_slugs.filter((slug) => slug !== service.slug) })}
                          className="min-h-11 rounded-full border border-primary/30 bg-background px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-accent">
                          {service.label} <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 space-y-4">
                  {groupRegistrationServices(visibleServices, categories).map((group) => (
                    <div key={group.categorySlug} role="group" aria-label={`Serviços de ${group.categoryLabel}`}
                      className="rounded-xl border border-border bg-muted/15 p-3 sm:p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-foreground">{group.categoryLabel}</h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">{group.services.length} opções nesta área</span>
                          {group.services.length > 1 && (
                            <button type="button"
                              aria-label={`Marcar ou desmarcar serviços exibidos de ${group.categoryLabel}`}
                              onClick={() => updateRegistration({ ...form,
                                service_slugs: toggleVisibleRegistrationServices(form.service_slugs, group.services) })}
                              className="min-h-11 rounded-lg border border-primary/30 bg-background px-3 text-xs font-semibold text-primary hover:bg-accent">
                              {group.services.every(service => form.service_slugs.includes(service.slug))
                                ? "Desmarcar exibidos" : "Marcar exibidos"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.services.map((service) => (
                          <label key={service.slug} className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                            <input type="checkbox" className="h-4 w-4" checked={form.service_slugs.includes(service.slug)}
                              onChange={(e) => updateRegistration({ ...form, service_slugs: e.target.checked ? [...form.service_slugs, service.slug] : form.service_slugs.filter((slug) => slug !== service.slug) })} />
                            <span>{service.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {!servicesLoading && !servicesError && availableServiceCount === 0 && <p className="mt-2 text-sm text-muted-foreground">Selecione uma especialidade acima para ver os serviços disponíveis.</p>}
                {!servicesLoading && !servicesError && availableServiceCount > 0 && visibleServices.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nenhum serviço corresponde à busca. Limpe o filtro para ver todas as opções.</p>}
              </fieldset>
                </div>
              )}
              {step === 3 && (
                <div className="grid gap-4">
                  <div className="rounded-xl border border-border bg-muted/25 p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-foreground">{form.display_name.trim()}</p>
                      <button type="button" onClick={() => moveToStep(1)}
                        className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm font-semibold text-primary hover:bg-accent">
                        Editar dados
                      </button>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {form.city.trim()}/{form.state_uf}
                      {safeNeighborhood(form.neighborhood, form.city) ? ` · ${safeNeighborhood(form.neighborhood, form.city)}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">Especialidades escolhidas</p>
                      <button type="button" onClick={() => moveToStep(2)}
                        className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm font-semibold text-primary hover:bg-accent">
                        Editar serviços
                      </button>
                    </div>
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
                      Ao publicar, estas especialidades e sua região de atendimento
                      poderão aparecer no perfil público. Nenhum contato privado é divulgado.
                    </p>
                  </div>
              <div>
                <label className="text-sm font-medium text-foreground">Apresentação profissional (somente texto)
                  <textarea maxLength={1000} rows={4} className={input} value={form.bio}
                    aria-invalid={Boolean(publicTextProblem(form.bio, "bio"))}
                    onChange={(e) => updateRegistration({ ...form, bio: e.target.value })}
                    placeholder="Conte o que costuma resolver, os equipamentos atendidos e como organiza seu atendimento. Não informe contatos." />
                </label>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Uma descrição original com seus serviços e experiência ajuda o cliente a escolher. Recomendamos pelo menos 80 caracteres, mas a apresentação é opcional.
                  <span className="ml-1 tabular-nums">{form.bio.trim().length}/1000</span>
                </p>
                <p className="mt-3 text-sm font-semibold text-foreground">Quer enriquecer seu currículo público?</p>
                <p className="mt-1 text-xs text-muted-foreground">Adicione tópicos opcionais e descreva apenas o que você realmente possui ou faz. Nenhuma resposta é preenchida automaticamente.</p>
                <div className="mt-2 flex flex-wrap gap-2" aria-label="Tópicos opcionais da apresentação">
                  {PUBLIC_PROFILE_TOPICS.map((topic) => (
                    <button key={topic.id} type="button"
                      disabled={publicProfileHasTopic(form.bio, topic.id) ||
                        addPublicProfileTopic(form.bio, topic.id) === form.bio}
                      onClick={() => updateRegistration({ ...form, bio: addPublicProfileTopic(form.bio, topic.id) })}
                      className="min-h-11 rounded-lg border border-primary/30 bg-background px-3 text-xs font-semibold text-primary hover:bg-accent disabled:opacity-50">
                      {publicProfileHasTopic(form.bio, topic.id) ? "Incluído: " : "+ "}{topic.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Não inclua números, preços, quilômetros, telefone, WhatsApp, e-mail, links, redes sociais ou documentos neste texto público.
                  Valores de deslocamento, SLA e comprovantes exigem campos próprios e proteção específica; não são definidos aqui.
                </p>
                {publicTextProblem(form.bio, "bio") && <p role="alert" className="mt-2 text-sm text-destructive">{publicTextProblem(form.bio, "bio")}</p>}
                <TechnicianBioPreview bio={form.bio} />
              </div>
                </div>
              )}
              {msg && <p role="alert" className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">{msg}</p>}
              {step === 3 && currentStatus === "aprovado" && justPublishedProfile && profileId && (
                <TechnicianPublicProfileLink ownerId={user.id} profileId={profileId}>
                  Abrir meu perfil publicado <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </TechnicianPublicProfileLink>
              )}
              <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center gap-2 border-t border-border bg-background/95 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-lg backdrop-blur sm:static sm:mx-0 sm:rounded-xl sm:border sm:shadow-none">
                {step > 1 && (
                  <button type="button" onClick={() => moveToStep((step - 1) as RegistrationStep)}
                    className="min-h-12 shrink-0 rounded-xl border border-border px-5 text-sm font-semibold text-foreground">
                    Voltar
                  </button>
                )}
                {step < 3 ? (
                  <button key="wizard-continue" type="button" onClick={advance} disabled={saving || !profileReady}
                    className="min-h-12 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                    Continuar <span aria-hidden="true">→</span>
                  </button>
                ) : (
                  <button key="wizard-publish" type="submit" data-wizard-action="publish" disabled={saving || !profileReady || catalogLoading || catalogError || servicesLoading || servicesError || categories.length === 0}
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
                      savedCityIds={savedCoverageIds} savedRadius={savedRadius}
                      onSaved={(cityIds, radius) => { setSavedCoverageIds(cityIds); setSavedRadius(radius); }} />
                  ) : (
                    <div className="mt-5 rounded-xl border border-border bg-muted/30 p-5">
                      <p className="text-sm text-foreground">Publique primeiro seu perfil profissional com uma cidade-base válida para liberar o editor de regiões.</p>
                      <a href={technicianTabHref("perfil")} onClick={() => setPanelTab("perfil")} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Completar meu perfil</a>
                    </div>
                  )}
                </section>
              )}
              {panelTab === "operacao" && (
                <section aria-labelledby="area-operacao-titulo">
                  <h2 id="area-operacao-titulo" className="text-2xl font-bold text-foreground">Condições de atendimento</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Declare equipamentos, transporte, horários usuais e valores de deslocamento. Estas informações são opcionais e não representam garantia de prazo ou orçamento fechado.</p>
                  {currentStatus === "aprovado" && profileId ? (
                    <TechnicianOperationsEditor key={profileId} technicianId={profileId}
                      coverageCityIds={savedCoverageIds} mode="technician" />
                  ) : (
                    <p className="mt-5 rounded-xl border border-border bg-muted/30 p-5 text-sm text-foreground">Publique seu perfil e confirme sua cobertura antes de editar as condições operacionais.</p>
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
                    <p className="mt-2 text-sm text-muted-foreground">O telefone fica em sua área privada e não é mostrado automaticamente no perfil público. Não há confirmação adicional de e-mail ou telefone para concluir o cadastro.</p>
                  </div>
                  <TechnicianPrivateContact userId={user.id} />
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
