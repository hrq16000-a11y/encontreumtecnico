import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { normalizeBrazilPhoneE164 } from "@/lib/admin-technician-crud-intent";
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
  importedName = "", importedDemo = false, available, onSaved, onCancel }: {
  sourceId: string;
  existing?: AdminTechnicianRegistryRecord;
  createOrigin?: "manual" | "wordpress";
  importedName?: string;
  importedDemo?: boolean;
  available: boolean;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const importedCreation = !existing && createOrigin === "wordpress";
  const [name, setName] = useState(existing?.display_name ?? importedName);
  const [ddd, setDdd] = useState(existing?.ddd ?? "");
  const [region, setRegion] = useState(existing?.region_approx ?? "");
  const [cityId, setCityId] = useState<number | null>(existing?.city_ibge_id ?? null);
  const [citySearch, setCitySearch] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<string[]>(existing?.category_slugs ?? []);
  const [services, setServices] = useState<string[]>(existing?.service_slugs ?? []);
  const [availableServices, setAvailableServices] = useState<CatalogService[]>([]);
  const [active, setActive] = useState(existing?.admin_active ?? !importedCreation);
  const [phoneAction, setPhoneAction] = useState<"keep" | "replace" | "remove">("keep");
  const [phone, setPhone] = useState("");
  // Suspension is exceptional. No paid-contact authorization exists in this registry.
  // Existing suspended numbers cannot be replaced/removed by the RPC.
  const [contactSuspended, setContactSuspended] = useState(false);
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const { categories: catalogCategories, loading: categoryLoading, error: categoryError } = useActiveCategories();

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
    const next = checked ? [...categories, slug] : categories.filter((item) => item !== slug);
    setCategories(next);
    setServices((items) => items.filter((item) => availableServices.some((s) =>
      s.slug === item && next.includes(s.category_slug))));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !available || !acknowledged || existing?.archived || importedDemo) return;
    setError(null);
    if (importedCreation && !/^wordpress_20261108:[0-9]{1,9}$/.test(sourceId)) {
      setError("Identificador histórico não comprovado. Importação bloqueada."); return;
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
    const normalizedPhone = phoneAction === "replace" ? normalizeBrazilPhoneE164(phone) : null;
    if (phoneAction === "replace" && !normalizedPhone) {
      setError("Informe um telefone brasileiro válido com DDD."); return;
    }
    const payload: Record<string, unknown> = {
      display_name: cleanedName, city_ibge_id: importedCreation ? null : cityId,
      ddd: importedCreation ? null : ddd || null,
      region_approx: importedCreation ? null : region.trim() || null,
      category_slugs: importedCreation ? [] : categories,
      service_slugs: importedCreation ? [] : services,
      admin_active: importedCreation ? false : active && !existing?.is_demo,
      is_demo: existing?.is_demo ?? importedDemo,
      phone_action: importedCreation ? "keep" : phoneAction,
    };
    if (!importedCreation && phoneAction === "replace") {
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
      setPhone("");
      onSaved(data.idempotent ? "Registro já existente preservado, sem sobrescrever dados." :
        data.created ? importedCreation ? "Técnico importado para gestão, sem ativar contato ou conta."
          : "Técnico adicionado e auditado no banco."
          : "Ficha do técnico atualizada e auditada no banco.");
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
      ? "Restaurar a ficha à gestão sem ativar contato ou perfil público?"
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
      if (data?.ok !== true || data.technician_id !== existing.technician_id ||
          data.archived !== (action === "archive") || data.admin_active !== false)
        throw new Error("Banco não confirmou a transação de arquivamento.");
      onSaved(action === "archive" ? "Técnico arquivado com histórico preservado." :
        "Técnico restaurado à gestão, sem reativar contato ou publicação.");
    } catch (error) { setError(safeRegistryError(error)); }
    finally { setBusy(false); }
  }

  return <form onSubmit={(event) => void submit(event)}
    className="mt-4 grid min-w-0 gap-4 rounded-xl border border-primary/20 bg-card p-3 sm:p-5"
    aria-label={existing ? `Editar técnico ${existing.display_name}` : importedCreation ? "Importar técnico histórico" : "Adicionar técnico manualmente"}>
    <h3 className="text-lg font-bold text-foreground">{existing ? "Editar ficha do técnico" : importedCreation ? "Importar técnico para gestão" : "Adicionar técnico"}</h3>
    <p className="text-xs leading-5 text-muted-foreground">
      {importedCreation ? "Ficha WordPress comprovada, vinculada pelo ID exato da fonte. Primeiro importe sem ativar; depois abra esta mesma ficha na lista para editar DDD, cidade, categorias e contato privado com comprovação." :
        "Cadastro administrativo direto, sem convite ou criação de conta de login. A origem fica guardada para auditoria."}
      {" "}Nenhum contato será publicado ou comercializado por esta operação.
    </p>
    {!available && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
      O banco ainda não possui as novas RPCs de cadastro. O formulário está disponível para conferência,
      mas salvar está bloqueado até a instalação autorizada e homologada.
    </p>}
    <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Nome profissional
      <input className={field} required minLength={3} maxLength={120} value={name}
        readOnly={importedCreation}
        onChange={(event) => setName(event.target.value)} />
    </label>
    {!importedCreation && <>
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
    </>}
    <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
      <input type="checkbox" checked={active} disabled={existing?.is_demo || importedCreation}
        onChange={(event) => setActive(event.target.checked)} />
      {importedCreation ? "Ficha importada não ativa até revisão individual (bloqueado nesta importação)" :
        "Ativo na gestão administrativa (não libera contato público ou pago)"}
    </label>
    {!importedCreation && <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Contato privado
      <select className={field} value={phoneAction}
        onChange={(event) => { setPhoneAction(event.target.value as typeof phoneAction); setPhone(""); }}>
        <option value="keep">Manter como está / sem contato</option>
        <option value="replace">{existing ? "Substituir" : "Cadastrar"} telefone</option>
        {existing && <option value="remove">Remover telefone (se permitido pelo banco)</option>}
      </select>
    </label>}
    {importedCreation && <p className="text-xs text-muted-foreground">
      Nenhum telefone é inferido da origem. Após importar, a inclusão de contato requer comprovação e operação auditada separada.
    </p>}
    {!importedCreation && phoneAction === "replace" && <div className="grid min-w-0 gap-2">
      <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Número com DDD (privado)
        <input className={field} inputMode="tel" autoComplete="off" value={phone}
          onChange={(event) => setPhone(event.target.value)} placeholder="(41) 99999-9999" />
      </label>
      <label className="flex min-h-10 items-center gap-2 text-xs text-foreground">
        <input type="checkbox" checked={contactSuspended}
          onChange={(event) => setContactSuspended(event.target.checked)} />
        Suspender especificamente este contato (não habilita comercialização)
      </label>
      <p className="text-xs text-muted-foreground">O número integral é enviado apenas à função protegida; nunca será mostrado na lista.</p>
    </div>}
    <label className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">Justificativa de auditoria
      <textarea className={field} required minLength={8} maxLength={400} rows={2} value={reason}
        onChange={(event) => setReason(event.target.value)} placeholder="Motivo verificável desta inclusão ou edição" />
    </label>
    <label className="flex min-h-11 items-start gap-2 text-xs leading-5 text-foreground">
      <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
      {importedCreation ? "Confirmo o vínculo exato desta ficha WordPress e a importação apenas deste profissional, sem ativar contato ou login." :
        "Confirmo que posso cadastrar/corrigir estes dados e que a operação não autoriza divulgação de contatos, criação de login ou importação de outros perfis."}
    </label>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    {existing?.archived && <p className="rounded-lg border border-amber-500/40 p-3 text-xs text-foreground">
      Esta ficha está arquivada. Restaure primeiro para voltar a editá-la;
      a restauração não ativa a ficha, o telefone nem o acesso pago.
    </p>}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" className="min-h-11 rounded-lg border border-input px-4 text-foreground" onClick={onCancel}>Cancelar</button>
      {existing && <button type="button" disabled={!available || busy || !acknowledged}
        onClick={() => void archiveOrRestore()}
        className="min-h-11 rounded-lg border border-amber-500/50 px-4 text-sm font-bold text-foreground disabled:opacity-50">
        {busy ? "Aguarde…" : existing.archived ? "Restaurar ficha" : "Arquivar ficha"}
      </button>}
      <button type="submit" disabled={!available || busy || !acknowledged || Boolean(existing?.archived) || importedDemo}
        className="min-h-12 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {busy ? "Gravando no banco…" : existing ? "Salvar edição" : importedCreation ? "Importar técnico" : "Adicionar técnico"}
      </button>
    </div>
  </form>;
}
