import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { normalizeBrazilPhoneE164 } from "@/lib/admin-technician-crud-intent";
import { confirmedTechnicianArchiveResult } from "@/lib/admin-technician-archive-confirmation";
import { publicTextProblem } from "@/lib/public-profile-text";

const db = supabase as unknown as SupabaseClient;
const field = "min-h-11 min-w-0 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";

/** Exact result contract of eut_admin_technician_registry_list (no full phone). */
export type AdminTechnicianRegistryRecord = {
  technician_id: string;
  display_name: string;
  origin: "manual" | "wordpress" | "guiafix" | "other_import";
  source_id: string;
  city_ibge_id: number | null;
  ddd: string | null;
  region_approx: string | null;
  category_slugs: string[];
  service_slugs: string[];
  admin_active: boolean;
  is_demo: boolean;
  archived: boolean;
  contact_last4: string | null;
  updated_at: string;
  total_count: number;
};

type CatalogService = { slug: string; label: string; category_slug: string };
type City = { id: number; name: string; uf: string };
type IdentityField = "email" | "postal_code" | "street" | "number" | "complement" | "neighborhood" | "city" | "uf";
type IdentityDraft = Record<IdentityField, string>;
const emptyIdentity: IdentityDraft = {
  email: "", postal_code: "", street: "", number: "", complement: "",
  neighborhood: "", city: "", uf: "",
};

function safeRegistryError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === "PGRST202" || code === "42883")
    return "A API administrativa ainda não foi instalada no banco. Nada foi gravado.";
  if (code === "23505")
    return "Este contato ou identificador já está ocupado ou bloqueado. Nenhum dado foi alterado.";
  if (code === "40001")
    return "Outro administrador alterou a ficha. Recarregue antes de tentar novamente.";
  if (code === "42501")
    return "Operação não autorizada ou contato suspenso. Nenhuma restrição foi removida.";
  // Never echo PostgREST messages: they can include private E.164 values.
  return "Operação não concluída. Verifique os campos, o catálogo e sua sessão administrativa.";
}

export function AdminTechnicianRecordEditor({ sourceId, existing, createOrigin = "manual",
  importedName = "", importedRegion = "", importedCityIbgeId = null, importedDemo = false, available, onSaved, onCancel }: {
  sourceId: string;
  existing?: AdminTechnicianRegistryRecord;
  createOrigin?: "manual" | "wordpress" | "guiafix";
  importedName?: string;
  importedRegion?: string;
  importedCityIbgeId?: number | null;
  importedDemo?: boolean;
  available: boolean;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const importedCreation = !existing && createOrigin !== "manual";
  const [name, setName] = useState(existing?.display_name ?? importedName);
  const [ddd, setDdd] = useState(existing?.ddd ?? "");
  const [region, setRegion] = useState(existing?.region_approx ?? importedRegion);
  const [cityId, setCityId] = useState<number | null>(existing?.city_ibge_id ?? importedCityIbgeId);
  const [citySearch, setCitySearch] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<string[]>(existing?.category_slugs ?? []);
  const [services, setServices] = useState<string[]>(existing?.service_slugs ?? []);
  const [availableServices, setAvailableServices] = useState<CatalogService[]>([]);
  const [active, setActive] = useState(existing?.admin_active ?? !importedDemo);
  const [phone, setPhone] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [phoneLoaded, setPhoneLoaded] = useState(!existing);
  const [phoneLoadError, setPhoneLoadError] = useState(false);
  const [identity, setIdentity] = useState<IdentityDraft>(emptyIdentity);
  const [identityRevision, setIdentityRevision] = useState<string | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(!existing);
  const [identityLoadError, setIdentityLoadError] = useState(false);
  // Suspension remains a status; it does not hide the telephone from administration.
  const [contactSuspended, setContactSuspended] = useState(false);
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const { categories: catalogCategories, loading: categoryLoading, error: categoryError } = useActiveCategories();

  useEffect(() => {
    const initialCityId = existing?.city_ibge_id ?? importedCityIbgeId;
    if (!initialCityId) return;
    let current = true;
    void Promise.resolve(db.from("eut_ibge_municipalities").select("id,name,uf")
      .eq("id", initialCityId).maybeSingle())
      .then(({ data }) => { if (current && data) setCitySearch(`${data.name}/${data.uf}`); })
      .catch(() => {});
    return () => { current = false; };
  }, [existing?.city_ibge_id, importedCityIbgeId]);

  useEffect(() => {
    if (!existing) return;
    let current = true;
    setPhoneLoaded(false);
    setPhoneLoadError(false);
    void Promise.resolve(db.rpc("eut_admin_unified_contact", {
      _record_key: `registry:${existing.technician_id}`,
      _reason: null,
    })).then(({ data, error: rpcError }) => {
      if (!current) return;
      if (rpcError || data?.ok !== true || typeof data.available !== "boolean") {
        throw new Error("Telefone administrativo indisponível");
      }
      const currentPhone = data.available && typeof data.phone === "string" ? data.phone : "";
      setPhone(currentPhone);
      setOriginalPhone(currentPhone);
      setContactSuspended(data.contact_suspended === true);
      setPhoneLoaded(true);
    }).catch(() => {
      if (current) setPhoneLoadError(true);
    });
    return () => { current = false; };
  }, [existing?.technician_id]);

  useEffect(() => {
    if (!existing) return;
    let current = true;
    setIdentityLoaded(false);
    setIdentityLoadError(false);
    void Promise.resolve(db.rpc("eut_admin_identity_get", {
      _record_key: `registry:${existing.technician_id}`,
    })).then(({ data, error: rpcError }) => {
      if (!current) return;
      if (rpcError || data?.ok !== true || data.available !== true) {
        throw new Error("Dados cadastrais indisponíveis");
      }
      setIdentity({
        email: data.email ?? "", postal_code: data.postal_code ?? "",
        street: data.street ?? "", number: data.number ?? "",
        complement: data.complement ?? "", neighborhood: data.neighborhood ?? "",
        city: data.city ?? "", uf: data.uf ?? "",
      });
      setIdentityRevision(data.updated_at ?? null);
      setIdentityLoaded(true);
    }).catch(() => {
      if (current) setIdentityLoadError(true);
    });
    return () => { current = false; };
  }, [existing?.technician_id]);

  useEffect(() => {
    let current = true;
    void Promise.resolve(db.from("eut_service_types")
      .select("slug,label,category_slug").eq("active", true).order("label").limit(300))
      .then(({ data, error }) => {
        if (!current) return;
        setCatalogError(Boolean(error));
        setAvailableServices(error ? [] : (data ?? []) as CatalogService[]);
      }).catch(() => { if (current) setCatalogError(true); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (citySearch.trim().length < 3) { setCities([]); return; }
    let current = true;
    const timer = window.setTimeout(() => {
      void Promise.resolve(db.from("eut_ibge_municipalities").select("id,name,uf")
        .ilike("name", `%${citySearch.trim().replace(/[%_*,()\\]/g, " ")}%`)
        .order("name").limit(12))
        .then(({ data, error }) => { if (current) setCities(error ? [] : (data ?? []) as City[]); })
        .catch(() => { if (current) setCities([]); });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [citySearch]);

  function toggleCategory(slug: string, checked: boolean) {
    setCategories((current) => checked
      ? (current.includes(slug) ? current : [...current, slug])
      : current.filter((item) => item !== slug));
    if (!checked) {
      // Only detach known services from the removed category. An unavailable or
      // incomplete catalog must never erase unrelated or historical selections.
      const removedServices = new Set(availableServices
        .filter((item) => item.category_slug === slug).map((item) => item.slug));
      setServices((current) => current.filter((item) => !removedServices.has(item)));
    }
  }

  function changeIdentity(key: IdentityField, value: string) {
    setIdentity((previous) => ({ ...previous, [key]: value }));
  }

  const normalizedPhoneDraft = phone.trim() ? normalizeBrazilPhoneE164(phone) : null;
  const phoneAction: "keep" | "replace" | "remove" = normalizedPhoneDraft
    ? normalizedPhoneDraft === originalPhone ? "keep" : "replace"
    : phone.trim() ? "keep" : originalPhone ? "remove" : "keep";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !available || !acknowledged || existing?.archived || importedDemo) return;
    setError(null);
    if (importedCreation && (
      (createOrigin === "wordpress" && !/^wordpress_20261108:[0-9]{1,9}$/.test(sourceId)) ||
      (createOrigin === "guiafix" && !/^guiafix:[A-Za-z-]{3,71}-[a-f0-9]{8}-[a-f0-9]{8}$/.test(sourceId))
    )) {
      setError("Identificador do cadastro inválido. Nenhum dado foi alterado."); return;
    }
    const cleanedName = name.trim();
    if (cleanedName.length < 3 || cleanedName.length > 120 || publicTextProblem(cleanedName, "identity")) {
      setError("Informe um nome profissional válido, sem contatos."); return;
    }
    if (region.length > 120 || publicTextProblem(region, "identity") ||
      (ddd && !/^[1-9][0-9]$/.test(ddd))) {
      setError("Região ou DDD inválido. DDD identifica região aproximada, não município exato."); return;
    }
    if (reason.trim().length < 8 || reason.trim().length > 400 || publicTextProblem(reason, "identity")) {
      setError("Justificativa obrigatória de 8 a 400 caracteres, sem dados privados ou links."); return;
    }
    if (existing && (!phoneLoaded || !identityLoaded)) {
      setError("Não foi possível carregar os dados atuais. Atualize a ficha antes de gravar."); return;
    }
    if (phone.trim() && !normalizedPhoneDraft) {
      setError("Informe um telefone brasileiro válido com DDD."); return;
    }
    const email = identity.email.trim();
    const postalCode = identity.postal_code.replace(/\D/g, "");
    if ((email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
      (identity.postal_code.trim() && postalCode.length !== 8)) {
      setError("Confira o e-mail cadastral e o CEP de oito dígitos."); return;
    }
    const identityPayload = {
      email: email || null, postal_code: postalCode || null,
      street: identity.street.trim() || null,
      number: identity.number.trim() || null,
      complement: identity.complement.trim() || null,
      neighborhood: identity.neighborhood.trim() || null,
      city: identity.city.trim() || null,
      uf: identity.uf.trim().toUpperCase() || null,
    };
    const normalizedPhone = phoneAction === "replace" ? normalizedPhoneDraft : null;
    const payload: Record<string, unknown> = {
      display_name: cleanedName, city_ibge_id: cityId,
      ddd: ddd || null,
      region_approx: region.trim() || null,
      category_slugs: categories,
      service_slugs: services,
      admin_active: active && !existing?.is_demo && !importedDemo,
      is_demo: existing?.is_demo ?? importedDemo,
      phone_action: phoneAction,
    };
    if (phoneAction === "replace") {
      payload["phone_e164"] = normalizedPhone;
      payload["contact_suspended"] = contactSuspended;
    }
    setBusy(true);
    try {
      const { data, error: writeError } = await db.rpc("eut_admin_technician_record_save", {
        _origin: existing?.origin ?? createOrigin, _source_id: sourceId,
        _expected_updated_at: existing?.updated_at ?? null,
        _payload: payload, _reason: reason.trim(),
      });
      if (writeError) throw writeError;
      if (data?.ok !== true || !data.technician_id || !data.updated_at)
        throw new Error("O banco não confirmou a gravação.");
      const hasIdentityFields = Object.values(identityPayload).some((value) => value !== null);
      if (existing || hasIdentityFields) {
        const { data: savedIdentity, error: identityError } = await db.rpc("eut_admin_identity_save", {
          _record_key: `registry:${data.technician_id}`,
          _expected_updated_at: identityRevision,
          _payload: identityPayload,
          _reason: reason.trim(),
        });
        if (identityError || savedIdentity?.ok !== true || !savedIdentity.updated_at) {
          setError("A ficha profissional foi salva, mas e-mail/endereço não foram confirmados. " +
            "Reabra a ficha para atualizar esses campos sem duplicar o cadastro.");
          return;
        }
      }
      setPhone("");
      onSaved(data.created ? "Técnico cadastrado e habilitado com dados administrativos auditados." :
        data.idempotent ? "Cadastro profissional preservado; dados administrativos conferidos." :
          "Dados profissionais, e-mail e endereço atualizados no painel.");
    } catch (error) {
      setError(safeRegistryError(error));
    } finally { setBusy(false); }
  }

  async function archiveOrRestore() {
    if (!existing || busy || !available || !acknowledged) return;
    if (reason.trim().length < 8 || reason.trim().length > 400 || publicTextProblem(reason, "identity")) {
      setError("Informe a justificativa de 8 a 400 caracteres, sem contatos privados."); return;
    }
    const action = existing.archived ? "restore" : "archive";
    const prompt = existing.archived
      ? "Restaurar a condição administrativa anterior? Os contatos privados continuarão protegidos."
      : "Arquivar esta ficha de forma reversível, preservando histórico e contatos privados?";
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: actionError } = await db.rpc("eut_admin_technician_record_archive", {
        _technician_id: existing.technician_id,
        _expected_updated_at: existing.updated_at,
        _action: action, _reason: reason.trim(),
      });
      if (actionError) throw actionError;
      if (!confirmedTechnicianArchiveResult(data, existing.technician_id, action))
        throw new Error("Banco não confirmou a transação de arquivamento.");
      onSaved(action === "archive" ? "Técnico arquivado com histórico preservado." :
        "Técnico restaurado à condição administrativa anterior; contatos privados preservados.");
    } catch (error) { setError(safeRegistryError(error)); }
    finally { setBusy(false); }
  }

  return <form onSubmit={(event) => void submit(event)}
    className="mt-4 grid min-w-0 gap-4 rounded-xl border border-primary/20 bg-card p-3 sm:p-5"
    aria-label={existing ? `Editar técnico ${existing.display_name}` : importedCreation ? "Editar técnico do diretório" : "Adicionar técnico manualmente"}>
    <h3 className="text-lg font-bold text-foreground">{existing ? "Editar ficha do técnico" : importedCreation ? "Completar cadastro e salvar técnico" : "Adicionar técnico"}</h3>
    <p className="text-xs leading-5 text-muted-foreground">
      Informe os dados deste técnico e salve com auditoria. O contato é privado; esta operação não publica
      telefone, não cria conta de login e não libera acesso pago ao número.
    </p>
    {!available && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
      O banco ainda não possui as novas RPCs de cadastro. O formulário está disponível para conferência,
      mas salvar está bloqueado até a instalação autorizada e homologada.
    </p>}
    <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Nome profissional
      <input className={field} required minLength={3} maxLength={120} value={name}
        onChange={(event) => setName(event.target.value)} />
    </label>
    <>
    <div className="grid min-w-0 gap-3 sm:grid-cols-[90px_minmax(0,1fr)]">
      <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">DDD
        <input className={field} inputMode="numeric" maxLength={2} value={ddd}
          placeholder="41" onChange={(event) => setDdd(event.target.value.replace(/\D/g, "").slice(0, 2))} />
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Região aproximada (se comprovada)
        <input className={field} maxLength={120} value={region}
          onChange={(event) => setRegion(event.target.value)} placeholder="Não inventar município pelo DDD" />
      </label>
    </div>
    <div className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">
      <label htmlFor="admin-record-city-search">Município IBGE verificado (opcional)</label>
      <input id="admin-record-city-search" className={field} value={citySearch}
        onChange={(event) => { setCitySearch(event.target.value); setCityId(null); }}
        placeholder="Buscar município pelo nome" />
      {cityId !== null && <button type="button" onClick={() => { setCityId(null); setCitySearch(""); }}
        className="min-h-10 rounded-lg border border-input px-3 text-left text-xs font-medium text-foreground">
        Município IBGE selecionado: {cityId} · Remover seleção
      </button>}
      {cities.length > 0 && <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-border p-1">
        {cities.map((city) => <button type="button" key={city.id}
          onClick={() => { setCityId(city.id); setCitySearch(`${city.name}/${city.uf}`); setCities([]); }}
          className="min-h-10 rounded-md p-2 text-left text-xs text-foreground hover:bg-accent">
          {city.name}/{city.uf} · IBGE {city.id}
        </button>)}
      </div>}
    </div>
    {categoryLoading && <p className="text-xs text-muted-foreground">Carregando categorias…</p>}
    {(categoryError || catalogError) && <p role="alert" className="text-xs text-destructive">Catálogo indisponível; verifique a conexão antes de escolher serviços.</p>}
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-foreground">Categorias comprovadas (opcional)</legend>
      <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
        {catalogCategories.map((item) => <label key={item.slug} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-xs text-foreground">
          <input type="checkbox" checked={categories.includes(item.slug)}
            onChange={(event) => toggleCategory(item.slug, event.target.checked)} />
          {item.label}
        </label>)}
      </div>
    </fieldset>
    {categories.length > 0 && <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-foreground">Serviços comprovados (opcional)</legend>
      <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
        {availableServices.filter((item) => categories.includes(item.category_slug)).map((item) =>
          <label key={item.slug} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-xs text-foreground">
            <input type="checkbox" checked={services.includes(item.slug)}
              onChange={(event) => setServices((before) => event.target.checked
                ? [...before, item.slug] : before.filter((slug) => slug !== item.slug))} />
            {item.label}
          </label>)}
      </div>
    </fieldset>}
    </>
    <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
      <input type="checkbox" checked={active} disabled={existing?.is_demo || importedCreation}
        onChange={(event) => setActive(event.target.checked)} />
      {importedCreation ? "Ficha importada não ativa até revisão individual (bloqueado nesta importação)" :
        "Ativo na gestão administrativa (não libera contato público ou pago)"}
    </label>
    <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Telefone com DDD
      <input className={field} inputMode="tel" autoComplete="off"
        value={phone} disabled={Boolean(existing) && !phoneLoaded}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="(41) 99999-9999" />
    </label>
    {phoneLoadError && <p role="alert" className="text-xs text-destructive">
      Não foi possível carregar o número cadastrado; os demais dados não foram alterados.
    </p>}
    {phoneAction === "replace" && <label className="flex min-h-10 items-center gap-2 text-xs text-foreground">
      <input type="checkbox" checked={contactSuspended}
        onChange={(event) => setContactSuspended(event.target.checked)} />
      Manter contato suspenso (restrição de atendimento ao cliente)
    </label>}
    {existing && contactSuspended && <p className="text-xs text-muted-foreground">
      Contato suspenso: o telefone é visível, mas sua alteração exige tratamento da restrição no banco.
    </p>}
    <fieldset className="grid min-w-0 gap-3 rounded-lg border border-border p-3" disabled={Boolean(existing) && !identityLoaded}>
      <legend className="px-1 text-sm font-bold text-foreground">E-mail e endereço cadastrais</legend>
      <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">E-mail completo
        <input className={field} type="email" maxLength={254} autoComplete="off"
          value={identity.email} placeholder="Não informado"
          onChange={(event) => changeIdentity("email", event.target.value)} />
      </label>
      <p className="text-xs text-muted-foreground">E-mail administrativo de contato; não altera o e-mail de login.</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">CEP
          <input className={field} inputMode="numeric" maxLength={9}
            value={identity.postal_code} placeholder="00000-000"
            onChange={(event) => changeIdentity("postal_code", event.target.value.replace(/[^\d-]/g, ""))} />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Logradouro
          <input className={field} maxLength={200} value={identity.street}
            onChange={(event) => changeIdentity("street", event.target.value)} />
        </label>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Número
          <input className={field} maxLength={25} value={identity.number}
            onChange={(event) => changeIdentity("number", event.target.value)} placeholder="S/N" />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Complemento
          <input className={field} maxLength={120} value={identity.complement}
            onChange={(event) => changeIdentity("complement", event.target.value)} />
        </label>
      </div>
      <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Bairro
        <input className={field} maxLength={120} value={identity.neighborhood}
          onChange={(event) => changeIdentity("neighborhood", event.target.value)} />
      </label>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_5.5rem]">
        <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Cidade do endereço
          <input className={field} maxLength={120} value={identity.city}
            onChange={(event) => changeIdentity("city", event.target.value)} />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">UF
          <input className={field} maxLength={2} value={identity.uf}
            onChange={(event) => changeIdentity("uf", event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Dados completos para a administração; não alteram cobertura pública nem autorizam divulgação.</p>
    </fieldset>
    {identityLoadError && <p role="alert" className="text-xs text-destructive">
      Não foi possível carregar e-mail e endereço existentes. Salvar está temporariamente bloqueado.
    </p>}
    <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Justificativa de auditoria
      <textarea className={field} required minLength={8} maxLength={400} rows={2} value={reason}
        onChange={(event) => setReason(event.target.value)} placeholder="Motivo verificável desta inclusão ou edição" />
    </label>
    <label className="flex min-h-11 items-start gap-2 text-xs leading-5 text-foreground">
      <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
      Confirmo que posso cadastrar ou corrigir os dados deste técnico e que a operação não autoriza
      divulgação do telefone nem criação de login.
    </label>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    {existing?.archived && <p className="rounded-lg border border-amber-500/40 p-3 text-xs text-foreground">
      Esta ficha está arquivada. Restaure primeiro para voltar a editá-la;
      a restauração recupera a condição administrativa anterior sem alterar contatos privados ou acesso pago.
    </p>}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" className="min-h-11 rounded-lg border border-input px-4 text-foreground" onClick={onCancel}>Cancelar</button>
      {existing && <button type="button" disabled={!available || busy || !acknowledged}
        onClick={() => void archiveOrRestore()}
        className="min-h-11 rounded-lg border border-amber-500/50 px-4 text-sm font-bold text-foreground disabled:opacity-50">
        {busy ? "Aguarde…" : existing.archived ? "Restaurar ficha" : "Arquivar ficha"}
      </button>}
      <button type="submit" disabled={!available || busy || !acknowledged || Boolean(existing?.archived) || importedDemo || Boolean(existing && !identityLoaded)}
        className="min-h-12 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {busy ? "Gravando no banco…" : existing ? "Salvar edição" : importedCreation ? "Salvar técnico" : "Adicionar técnico"}
      </button>
    </div>
  </form>;
}
