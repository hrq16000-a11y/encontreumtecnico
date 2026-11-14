import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBrazilPhoneE164 } from "@/lib/admin-technician-crud-intent";
import { BRAZIL_STATES } from "@/lib/service-taxonomy";

type Entry = {
  id: string; display_name: string; city_ibge_id: number | null;
  city: string | null; state_uf: string | null;
  category_slugs: string[]; service_slugs: string[];
  updated_at: string; source: string;
};
type City = { id: number; name: string; uf: string };
type Category = { slug: string; label: string | null; active: boolean };
type Service = { slug: string; label: string | null; category_slug: string; active: boolean };
const db = supabase as unknown as SupabaseClient;
const input = "min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";
const button = "min-h-11 rounded-lg border border-input px-4 text-sm font-semibold disabled:opacity-50";

/** Private, audit-only intake. Never creates an auth user or makes a phone publicly available. */
export function AdminTechnicianIntakeManager() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [name, setName] = useState("");
  const [uf, setUf] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [cityId, setCityId] = useState<number | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [chosenCategories, setChosenCategories] = useState<string[]>([]);
  const [chosenServices, setChosenServices] = useState<string[]>([]);
  const [phoneAction, setPhoneAction] = useState<"keep" | "replace" | "remove">("keep");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [csvInfo, setCsvInfo] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from("eut_service_categories").select("slug,label,active"),
      supabase.from("eut_service_types").select("slug,label,category_slug,active"),
    ]).then(([cat, srv]) => {
      if (!active) return;
      if (cat.error || srv.error) setMessage("Catálogo indisponível. Não é possível salvar fichas.");
      else { setCategories(cat.data ?? []); setServices(srv.data ?? []); }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void db.rpc("eut_admin_technician_intake_list", { _query: search, _offset: page * 50 })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setEntries([]); return; }
        setEntries((data ?? []) as Entry[]);
      });
    return () => { active = false; };
  }, [search, page, revision]);

  useEffect(() => {
    let active = true;
    const term = citySearch.trim().replace(/[%_]/g, "");
    if (term.length < 2 || !uf) { setCities([]); return; }
    const timer = window.setTimeout(() => {
      void supabase.from("eut_ibge_municipalities")
        .select("id,name,uf").eq("uf", uf).ilike("name", `%${term}%`)
        .order("name").limit(15).then(({ data, error }) => {
          if (active) setCities(error ? [] : (data ?? []));
        });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [citySearch, uf]);

  function start(entry: Entry | null) {
    setEditing(entry); setOpen(true); setName(entry?.display_name ?? "");
    setUf(entry?.state_uf ?? ""); setCityId(entry?.city_ibge_id ?? null);
    setCitySearch(entry?.city ?? ""); setChosenCategories(entry?.category_slugs ?? []);
    setChosenServices(entry?.service_slugs ?? []);
    setPhoneAction("keep"); setPhone(""); setReason(""); setMessage("");
  }

  async function save(archive = false) {
    if (busy) return;
    if (reason.trim().length < 8 || reason.length > 400 || /(?:@|https?:\/\/|\+?\d[\d\s()-]{8,}\d)/i.test(reason)) {
      setMessage("Justificativa obrigatória (8–400 caracteres), sem dados privados."); return;
    }
    const e164 = phoneAction === "replace" ? normalizeBrazilPhoneE164(phone) : null;
    if (phoneAction === "replace" && !e164) {
      setMessage("Contato inválido. Informe DDD e número brasileiro."); return;
    }
    if (!name.trim() || name.trim().length < 3 || categories.length === 0) {
      setMessage("Nome e catálogos oficiais são obrigatórios."); return;
    }
    if (archive && !window.confirm("Arquivar esta ficha sem apagar seus dados e sem liberar contatos?")) return;
    setBusy(true); setMessage("");
    try {
      const { data, error } = await db.rpc("eut_admin_technician_intake_save", {
        _record_id: editing?.id ?? null,
        _expected_updated_at: editing?.updated_at ?? null,
        _reason: reason.trim(),
        _payload: {
          display_name: name.trim(), city_ibge_id: cityId,
          category_slugs: chosenCategories, service_slugs: chosenServices,
          phone_action: phoneAction, ...(e164 ? { phone_e164: e164 } : {}), archive,
        },
      });
      if (error) throw error;
      if (data?.ok !== true || !data?.id || !data?.updated_at || data?.contact_public !== false)
        throw new Error("Servidor não confirmou operação privada.");
      setPhone(""); setPhoneAction("keep"); setOpen(false); setEditing(null);
      setRevision((v) => v + 1);
      setMessage(archive ? "Ficha arquivada com auditoria." : "Ficha salva e auditada. Sem login ou contato público ativado.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setMessage(detail.includes("PGRST202") || detail.includes("Could not find the function")
        ? "Inclusão indisponível: SQL/RLS ainda não autorizado em produção. Nenhum dado foi salvo."
        : "Operação não confirmada. " + detail.slice(0, 150));
    } finally { setBusy(false); }
  }

  function inspectImport(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) { setCsvInfo("Arquivo excede 2 MB. Divida em lotes."); return; }
    void file.text().then((text) => {
      // Preparation only: no row, name, phone or CSV is uploaded, shown or stored.
      const lines = text.split(/\r?\n/).filter(Boolean);
      const header = (lines[0] ?? "").toLowerCase().replace(/\uFEFF/g, "");
      const columns = header.split(/[;,\t]/).map((value) => value.trim());
      const nameColumn = columns.includes("nome") || columns.includes("name");
      setCsvInfo(nameColumn
        ? `${Math.max(0, lines.length - 1)} linhas candidatas; ${columns.length} colunas. Prévia local, sem envio: conciliação, duplicatas, contatos suspensos e municípios IBGE exigem revisão antes da importação.`
        : "Cabeçalho CSV sem coluna 'nome' (ou 'name'). Nenhum dado enviado.");
    }).catch(() => setCsvInfo("Não foi possível ler o CSV local."));
  }

  const visibleServices = services.filter((service) => service.active && chosenCategories.includes(service.category_slug));
  return <section aria-label="Cadastro manual e importação de técnicos" className="mt-6 min-w-0 rounded-2xl border border-primary/20 bg-card p-3 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-bold">Cadastro manual de técnicos</h3>
        <p className="mt-1 text-sm text-muted-foreground">O administrador adiciona e edita fichas auditadas, sem convite. A associação à conta e a publicação só ocorrem após conciliação verificada; contato nunca é público.</p>
      </div>
      <button type="button" className={button + " bg-primary text-primary-foreground"} onClick={() => start(null)}>+ Adicionar técnico</button>
    </div>
    {message && <p role="status" className="mt-3 rounded-lg bg-muted p-3 text-sm">{message}</p>}
    {open && <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="mt-4 space-y-4 rounded-xl border border-border p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold">{editing ? "Editar ficha" : "Adicionar técnico manualmente"}</h4><button className={button} type="button" onClick={() => { setOpen(false); setPhone(""); }}>Fechar</button></div>
      <label className="grid gap-1 text-sm">Nome profissional<input className={input} required minLength={3} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">UF declarada<select className={input} value={uf} onChange={(e) => { setUf(e.target.value); setCityId(null); setCitySearch(""); }}><option value="">Não informada</option>{BRAZIL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="grid gap-1 text-sm">Município oficial IBGE<input className={input} value={citySearch} placeholder="Pesquisar cidade por nome" onChange={(e) => { setCitySearch(e.target.value); setCityId(null); }} /></label>
      </div>
      {cities.length > 0 && <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">{cities.map((city) => <button type="button" key={city.id} className={button} onClick={() => { setCityId(city.id); setCitySearch(city.name); }}>{city.name}/{city.uf}</button>)}</div>}
      <p className="text-xs text-muted-foreground">{cityId ? `Município verificado: IBGE ${cityId}` : "Sem município verificado: localização não será inventada nem publicada."}</p>
      <fieldset className="space-y-2"><legend className="font-semibold">Categorias</legend><div className="grid gap-2 sm:grid-cols-2">{categories.filter((c) => c.active).map((c) => <label key={c.slug} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={chosenCategories.includes(c.slug)} onChange={(e) => { setChosenCategories((old) => e.target.checked ? [...old,c.slug] : old.filter((s) => s!==c.slug)); if (!e.target.checked) setChosenServices((old) => old.filter((s) => services.find((x) => x.slug===s)?.category_slug!==c.slug)); }} />{c.label ?? c.slug}</label>)}</div></fieldset>
      {visibleServices.length > 0 && <fieldset className="space-y-2"><legend className="font-semibold">Especialidades e serviços</legend><div className="grid gap-2 sm:grid-cols-2">{visibleServices.map((s) => <label key={s.slug} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={chosenServices.includes(s.slug)} onChange={(e) => setChosenServices((old) => e.target.checked ? [...old,s.slug] : old.filter((value) => value!==s.slug))} />{s.label ?? s.slug}</label>)}</div></fieldset>}
      <fieldset className="space-y-2"><legend className="font-semibold">Contato privado</legend><p className="text-xs text-muted-foreground">O contato anterior nunca é exibido. Não libera contato pago ou reativa suspensos.</p><select className={input} value={phoneAction} onChange={(e) => { setPhoneAction(e.target.value as typeof phoneAction); setPhone(""); }}><option value="keep">Manter contato existente</option><option value="replace">Cadastrar/substituir número</option><option value="remove">Remover contato</option></select>{phoneAction==="replace" && <input className={input} type="tel" autoComplete="off" value={phone} maxLength={25} placeholder="DDD e número" onChange={(e) => setPhone(e.target.value)} />}</fieldset>
      <label className="grid gap-1 text-sm">Motivo obrigatório<textarea className={input} required minLength={8} maxLength={400} rows={2} value={reason} placeholder="Justificativa sem dados privados" onChange={(e) => setReason(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy} className={button + " bg-primary text-primary-foreground"}>{busy ? "Gravando…" : "Salvar com auditoria"}</button>{editing && <button type="button" disabled={busy} className={button + " border-amber-500/40"} onClick={() => void save(true)}>Arquivar ficha</button>}</div>
    </form>}
    <div className="mt-5 space-y-3">
      <h4 className="font-semibold">Fichas em conciliação (sem conta vinculada)</h4>
      <input className={input} aria-label="Buscar fichas manuais" placeholder="Pesquisar fichas manuais" maxLength={80} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
      {entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><div className="min-w-0 flex-1"><p className="break-words font-semibold">{entry.display_name}</p><p className="text-xs text-muted-foreground">{entry.city ? `${entry.city}/${entry.state_uf}` : "Localidade a confirmar"} · {entry.category_slugs.join(", ") || "Categoria a confirmar"} · Associação pendente</p></div><button type="button" className={button} onClick={() => start(entry)}>Editar</button></div>)}
      <div className="flex gap-2"><button type="button" className={button} disabled={page===0} onClick={() => setPage((v) => Math.max(0,v-1))}>Anterior</button><button type="button" className={button} disabled={entries.length<50} onClick={() => setPage((v) => v+1)}>Mais fichas</button></div>
    </div>
    <fieldset className="mt-5 space-y-2 rounded-xl border border-dashed border-border p-3"><legend className="font-semibold">Preparar importação CSV</legend><p className="text-xs text-muted-foreground">Inspeção local do cabeçalho e volume; não envia nem grava linhas. A importação efetiva exige conciliação individual dos contatos e proteção de registros suspensos.</p><input aria-label="Selecionar CSV para prévia offline" type="file" accept=".csv,text/csv" className="max-w-full text-sm" onChange={(e) => inspectImport(e.target.files?.[0])} />{csvInfo && <p role="status" className="text-sm">{csvInfo}</p>}</fieldset>
  </section>;
}
