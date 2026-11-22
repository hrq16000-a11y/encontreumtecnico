import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { normalizeBrazilPhoneE164 } from "@/lib/admin-technician-crud-intent";
import { confirmedTechnicianArchiveResult } from "@/lib/admin-technician-archive-confirmation";
import { publicTextProblem } from "@/lib/public-profile-text";
import { AdminTechnicianCoverageEditor } from "@/components/admin-technician-coverage-editor";
import { shouldWriteTechnicianIdentity, technicianIdentityPayload,
  type TechnicianIdentityDraft, type TechnicianIdentityPayload } from "@/lib/admin-technician-identity-intent";

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
type IdentityField = keyof TechnicianIdentityDraft;
const emptyIdentity: TechnicianIdentityDraft = {
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
  importedName = "", importedRegion = "", importedCityIbgeId = null, importedDemo = false, available, inDialog = false, onSaved, onCancel }: {
  sourceId: string;
  existing?: AdminTechnicianRegistryRecord;
  createOrigin?: "manual" | "wordpress" | "guiafix";
  importedName?: string;
  importedRegion?: string;
  importedCityIbgeId?: number | null;
  importedDemo?: boolean;
  available: boolean;
  inDialog?: boolean;
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
  const [active, setActive] = useState(existing?.admin_active ?? (createOrigin === "manual" && !importedDemo));
  const [phone, setPhone] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [phoneLoaded, setPhoneLoaded] = useState(!existing);
  const [phoneLoadError, setPhoneLoadError] = useState(false);
  const [identity, setIdentity] = useState<TechnicianIdentityDraft>(emptyIdentity);
  const [originalIdentity, setOriginalIdentity] = useState<TechnicianIdentityPayload | null>(null);
  const [identityRevision, setIdentityRevision] = useState<string | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(!existing);
  const [identityLoadError, setIdentityLoadError] = useState(false);
  // Suspension remains a status; it does not hide the telephone from administration.
  const [contactSuspended, setContactSuspended] = useState(false);
  // An audit reason is still sent to the server; the owner is not asked to invent one.
  const auditReason = existing ? "Atualizacao de cadastro pelo painel administrativo" : "Cadastro de tecnico pelo painel administrativo";
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const { categories: catalogCategories, loading: categoryLoading, error: categoryError } = useActiveCategories();

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

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
      const loadedIdentity = {
        email: data.email ?? "", postal_code: data.postal_code ?? "",
        street: data.street ?? "", number: data.number ?? "",
        complement: data.complement ?? "", neighborhood: data.neighborhood ?? "",
        city: data.city ?? "", uf: data.uf ?? "",
      };
      setIdentity(loadedIdentity);
      setOriginalIdentity(technicianIdentityPayload(loadedIdentity));
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
    if (busy || !available || existing?.archived || importedDemo) return;
    setError(null);
    if (importedCreation && (
      (createOrigin === "wordpress" && !/^wordpress_20261108:[0-9]{1,9}$/.test(sourceId)) ||
      (createOrigin === "guiafix" && !/^guiafix:[A-Za-z-]{3,71}-[a-f0-9]{8}-[a-f0-9]{8}$/.test(sourceId))
    )) {
      setError("Identificador do cadastro inválido. Nenhum dado foi alterado."); return;
    }
    const cleanedName = name.trim();
    if (cleanedName.length < 3 || cleanedName.length > 120 || publicTextProblem(cleanedName, "identity",
      { allowInternalQaDate: !existing && createOrigin === "manual" })) {
      setError("Informe um nome profissional válido, sem contatos."); return;
    }
    if (region.length > 120 || publicTextProblem(region, "identity") ||
      (ddd && !/^[1-9][0-9]$/.test(ddd))) {
      setError("Região ou DDD inválido. DDD identifica região aproximada, não município exato."); return;
    }
    if (existing && (!phoneLoaded || !identityLoaded)) {
      setError("Não foi possível carregar os dados atuais. Atualize a ficha antes de gravar."); return;
    }
    if (phone.trim() && !normalizedPhoneDraft) {
      setError("Informe um telefone brasileiro válido com DDD."); return;
    }
    if (citySearch.trim() && cityId === null) {
      setError("Escolha uma cidade da lista ou deixe o campo vazio."); return;
    }
    const email = identity.email.trim();
    const postalCode = identity.postal_code.replace(/\D/g, "");
    if ((email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
      (identity.postal_code.trim() && postalCode.length !== 8)) {
      setError("Confira o e-mail cadastral e o CEP de oito dígitos."); return;
    }
    const identityPayload = technicianIdentityPayload(identity);
    const writeIdentity = shouldWriteTechnicianIdentity(identityPayload, originalIdentity, Boolean(existing));
    const normalizedPhone = phoneAction === "replace" ? normalizedPhoneDraft : null;
    const effectiveDdd = phoneAction === "replace" && normalizedPhoneDraft
      ? normalizedPhoneDraft.slice(3, 5) : ddd;
    const payload: Record<string, unknown> = {
      display_name: cleanedName, city_ibge_id: cityId,
      ddd: effectiveDdd || null,
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
        _payload: payload, _reason: auditReason,
      });
      if (writeError) throw writeError;
      if (data?.ok !== true || !data.technician_id || !data.updated_at)
        throw new Error("O banco não confirmou a gravação.");
      // An unchanged e-mail/address must not create a separate identity write,
      // audit entry or second possible failure after the professional save.
      if (writeIdentity) {
        const { data: savedIdentity, error: identityError } = await db.rpc("eut_admin_identity_save", {
          _record_key: `registry:${data.technician_id}`,
          _expected_updated_at: identityRevision,
          _payload: identityPayload,
          _reason: auditReason,
        });
        if (identityError || savedIdentity?.ok !== true || !savedIdentity.updated_at) {
          setError("A ficha profissional foi salva, mas e-mail/endereço não foram confirmados. " +
            "Reabra a ficha para atualizar esses campos sem duplicar o cadastro.");
          return;
        }
      }
      // A RPC pode retornar OK enquanto outra etapa da ficha ainda está
      // incompleta. Releia o snapshot administrativo antes de dizer "salvo".
      // Nunca reenvie a escrita automaticamente em caso de leitura incerta.
      const { data: verifiedRows, error: readError } = await db.rpc(
        "eut_admin_technician_registry_list",
        { _search: cleanedName.slice(0, 80), _limit: 100, _offset: 0 },
      );
      const verified = (Array.isArray(verifiedRows) ? verifiedRows : [])
        .find((row) => row.technician_id === data.technician_id);
      const sameSlugs = (actual: unknown, expected: string[]) =>
        Array.isArray(actual) && actual.length === expected.length &&
        expected.every((item) => actual.includes(item));
      const expectedLast4 = phoneAction === "replace"
        ? normalizedPhoneDraft?.slice(-4) ?? null
        : phoneAction === "remove" ? null
        : originalPhone ? originalPhone.slice(-4) : null;
      if (readError || !verified ||
          verified.display_name !== cleanedName ||
          verified.city_ibge_id !== cityId ||
          (verified.ddd ?? null) !== (effectiveDdd || null) ||
          (verified.region_approx ?? null) !== (region.trim() || null) ||
          verified.admin_active !== payload["admin_active"] ||
          !sameSlugs(verified.category_slugs, categories) ||
          !sameSlugs(verified.service_slugs, services) ||
          (phoneAction !== "keep" && (verified.contact_last4 ?? null) !== expectedLast4)) {
        setError("O servidor recebeu a edição, mas a releitura não confirmou todos os campos. " +
          "Reabra a ficha antes de repetir a operação; nenhum contato será reenviado automaticamente.");
        return;
      }
      if (writeIdentity) {
        const { data: verifiedIdentity, error: identityReadError } = await db.rpc(
          "eut_admin_identity_get", { _record_key: `registry:${data.technician_id}` },
        );
        if (identityReadError || verifiedIdentity?.ok !== true ||
            verifiedIdentity.available !== true ||
            (verifiedIdentity.email ?? null) !== (email.toLowerCase() || null) ||
            (verifiedIdentity.postal_code ?? null) !== identityPayload.postal_code ||
            (verifiedIdentity.street ?? null) !== identityPayload.street ||
            (verifiedIdentity.number ?? null) !== identityPayload.number ||
            (verifiedIdentity.complement ?? null) !== identityPayload.complement ||
            (verifiedIdentity.neighborhood ?? null) !== identityPayload.neighborhood ||
            (verifiedIdentity.city ?? null) !== identityPayload.city ||
            (verifiedIdentity.uf ?? null) !== identityPayload.uf) {
          setError("A gravação profissional foi confirmada, mas e-mail ou endereço não foram " +
            "confirmados na releitura. Reabra a ficha para conferir antes de tentar novamente.");
          return;
        }
      }
      setPhone("");
      const incomplete = cityId === null || categories.length === 0 || services.length === 0;
      onSaved((data.created ? "Técnico cadastrado e habilitado." :
        data.idempotent ? "Cadastro preservado." : "Edição gravada.") +
        " Dados conferidos no banco." +
        (incomplete ? " Ficha ainda incompleta: informe município, categorias e serviços conhecidos, sem inventar dados." : ""));
    } catch (error) {
      setError(safeRegistryError(error));
    } finally { setBusy(false); }
  }

  async function archiveOrRestore() {
    if (!existing || busy || !available) return;
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
        _action: action,
        _reason: action === "archive" ? "Arquivamento pelo painel administrativo" : "Restauracao pelo painel administrativo",
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
    className={inDialog ? "grid min-w-0 gap-4" : "mt-4 grid min-w-0 gap-4 rounded-xl border border-primary/20 bg-card p-3 sm:p-5"}
    aria-label={existing ? "Editar técnico " + existing.display_name : importedCreation ? "Completar cadastro do técnico" : "Adicionar técnico manualmente"}>
    {!inDialog && <h3 className="text-lg font-bold text-foreground">
      {existing ? "Editar técnico" : importedCreation ? "Completar cadastro" : "Novo técnico"}
    </h3>}
    {!available && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
      O cadastro está temporariamente indisponível. Nenhum dado foi enviado.
    </p>}
    {error && <p ref={errorRef} tabIndex={-1} role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      {error}
    </p>}
    <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">
      Nome <span className="text-xs font-normal text-muted-foreground">Obrigatório</span>
      <input className={field} required minLength={3} maxLength={120} autoComplete="off" autoFocus={!existing}
        value={name} onChange={(event) => { setName(event.target.value); setError(null); }}
        placeholder="Nome ou nome da empresa" />
    </label>
    <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">
      Telefone <span className="text-xs font-normal text-muted-foreground">Opcional · privado</span>
      <input className={field} inputMode="tel" autoComplete="off" placeholder="(41) 99999-9999"
        value={phone} disabled={Boolean(existing) && !phoneLoaded}
        onChange={(event) => setPhone(event.target.value)} />
    </label>
    {phoneLoadError && <p role="alert" className="text-xs text-destructive">
      O telefone atual não pôde ser consultado. Salvar a edição está bloqueado para proteger o contato.
    </p>}
    {phoneAction === "replace" && existing && <label className="flex min-h-10 items-center gap-2 text-xs text-foreground">
      <input type="checkbox" checked={contactSuspended}
        onChange={(event) => setContactSuspended(event.target.checked)} />
      Preservar suspensão deste contato
    </label>}
    {existing && contactSuspended && <p className="text-xs text-muted-foreground">
      O contato está suspenso. Alterá-lo exige uma operação de moderação separada.
    </p>}
    <div className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">
      <label htmlFor="admin-record-city-search">
        Cidade <span className="text-xs font-normal text-muted-foreground">Opcional</span>
      </label>
      <input id="admin-record-city-search" className={field} autoComplete="off"
        value={citySearch} onChange={(event) => { setCitySearch(event.target.value); setCityId(null); }}
        placeholder="Digite o nome e escolha uma sugestão" />
      {cityId !== null && <button type="button"
        onClick={() => { setCityId(null); setCitySearch(""); setCities([]); }}
        className="min-h-10 rounded-lg border border-input px-3 text-left text-xs font-medium text-foreground">
        Remover cidade selecionada
      </button>}
      {cities.length > 0 && <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-border p-1"
        role="group" aria-label="Cidades encontradas">
        {cities.map((city) => <button type="button" key={city.id}
          onClick={() => { setCityId(city.id); setCitySearch(city.name + "/" + city.uf); setCities([]); }}
          className="min-h-10 rounded-md p-2 text-left text-xs text-foreground hover:bg-accent">
          {city.name}/{city.uf}
        </button>)}
      </div>}
    </div>
    <details className="min-w-0 rounded-xl border border-border px-3 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Categorias e serviços (opcional)
      </summary>
      <div className="mt-3 grid gap-4">
        {categoryLoading && <p className="text-xs text-muted-foreground">Carregando categorias…</p>}
        {(categoryError || catalogError) && <p role="alert" className="text-xs text-destructive">
          As especialidades estão indisponíveis. Você pode salvar o cadastro e completar depois.
        </p>}
        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold text-foreground">Categorias</legend>
          <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
            {catalogCategories.map((item) => <label key={item.slug}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-xs text-foreground">
              <input type="checkbox" checked={categories.includes(item.slug)}
                onChange={(event) => toggleCategory(item.slug, event.target.checked)} />
              {item.label}
            </label>)}
          </div>
        </fieldset>
        {categories.length > 0 && <fieldset className="min-w-0">
          <legend className="text-sm font-semibold text-foreground">Serviços</legend>
          <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
            {availableServices.filter((item) => categories.includes(item.category_slug)).map((item) =>
              <label key={item.slug} className="flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-xs text-foreground">
                <input type="checkbox" checked={services.includes(item.slug)}
                  onChange={(event) => setServices((before) => event.target.checked
                    ? [...before, item.slug] : before.filter((slug) => slug !== item.slug))} />
                {item.label}
              </label>)}
          </div>
        </fieldset>}
      </div>
    </details>
    <details className="min-w-0 rounded-xl border border-border px-3 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Informações adicionais (opcional)
      </summary>
      <div className="mt-3 grid min-w-0 gap-3">
        <label className="grid gap-1 text-sm font-medium text-foreground">
          Região atendida
          <input className={field} maxLength={120} value={region}
            onChange={(event) => setRegion(event.target.value)} placeholder="Se informada pelo técnico" />
        </label>
        {existing && <label className="grid gap-1 text-sm font-medium text-foreground">
          DDD de referência
          <input className={field} inputMode="numeric" maxLength={2} value={ddd}
            onChange={(event) => setDdd(event.target.value.replace(/\D/g, "").slice(0, 2))} />
        </label>}
        <fieldset className="grid min-w-0 gap-3 rounded-lg border border-border p-3"
          disabled={Boolean(existing) && !identityLoaded}>
          <legend className="px-1 text-sm font-semibold text-foreground">Contato e endereço administrativos</legend>
          <label className="grid gap-1 text-sm font-medium text-foreground">
            E-mail (não altera o login)
            <input className={field} type="email" maxLength={254} autoComplete="off"
              value={identity.email} onChange={(event) => changeIdentity("email", event.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <label className="grid gap-1 text-sm font-medium text-foreground">CEP
              <input className={field} inputMode="numeric" maxLength={9} value={identity.postal_code}
                onChange={(event) => changeIdentity("postal_code", event.target.value.replace(/[^\d-]/g, ""))} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-foreground">Rua
              <input className={field} maxLength={200} value={identity.street}
                onChange={(event) => changeIdentity("street", event.target.value)} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
            <label className="grid gap-1 text-sm font-medium text-foreground">Número
              <input className={field} maxLength={25} value={identity.number}
                onChange={(event) => changeIdentity("number", event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-foreground">Complemento
              <input className={field} maxLength={120} value={identity.complement}
                onChange={(event) => changeIdentity("complement", event.target.value)} />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium text-foreground">Bairro
            <input className={field} maxLength={120} value={identity.neighborhood}
              onChange={(event) => changeIdentity("neighborhood", event.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5.5rem]">
            <label className="grid gap-1 text-sm font-medium text-foreground">Cidade do endereço
              <input className={field} maxLength={120} value={identity.city}
                onChange={(event) => changeIdentity("city", event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-foreground">UF
              <input className={field} maxLength={2} value={identity.uf}
                onChange={(event) => changeIdentity("uf", event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} />
            </label>
          </div>
        </fieldset>
        {identityLoadError && <p role="alert" className="text-xs text-destructive">
          Não foi possível consultar os dados cadastrais. A edição está bloqueada.
        </p>}
      </div>
    </details>
    {existing && <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
      <input type="checkbox" checked={active} disabled={existing.is_demo || importedDemo}
        onChange={(event) => setActive(event.target.checked)} />
      Cadastro ativo
    </label>}
    {existing?.archived && <p className="rounded-lg border border-amber-500/40 p-3 text-xs text-foreground">
      Esta ficha está arquivada. Restaure para voltar a editá-la.
    </p>}
    {existing && !existing.archived && !existing.is_demo &&
      <AdminTechnicianCoverageEditor technicianId={existing.technician_id} onSaved={onSaved} />}
    <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 border-t border-border bg-background/95 pt-3 pb-1 sm:flex-row sm:justify-end">
      <button type="button" className="min-h-11 rounded-lg border border-input px-4 text-foreground"
        onClick={onCancel}>Cancelar</button>
      {existing && <button type="button" disabled={!available || busy}
        onClick={() => void archiveOrRestore()}
        className="min-h-11 rounded-lg border border-amber-500/50 px-4 text-sm font-semibold text-foreground disabled:opacity-50">
        {busy ? "Aguarde…" : existing.archived ? "Restaurar ficha" : "Arquivar ficha"}
      </button>}
      <button type="submit"
        disabled={!available || busy || Boolean(existing?.archived) || importedDemo || Boolean(existing && !identityLoaded)}
        className="min-h-11 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {busy ? "Salvando…" : existing ? "Salvar alterações" : "Salvar técnico"}
      </button>
    </div>
  </form>;
}
