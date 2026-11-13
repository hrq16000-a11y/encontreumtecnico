import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ClipboardList, Database, LockKeyhole, Pencil, PlusCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCategories } from "@/hooks/use-active-categories";
import {
  confirmCatalogEditReadback, confirmCatalogReadback, isCatalogSnapshot, parseCatalogBatch,
  type CatalogEditChanges, type CatalogEditExpected, type CatalogRow,
  type CatalogSnapshot, type CatalogWriteResult, type CatalogBatchResult,
} from "@/lib/admin-canonical-contract";

const db = supabase as unknown as SupabaseClient;
const PAGE_SIZE = 20;

function genericServerError(code?: string) {
  if (code === "PT409") return "Esta ficha mudou em outra sessão. Recarregue do banco antes de tentar novamente.";
  return code === "PGRST202" || code === "42883"
    ? "O backend do cadastro canônico ainda não foi homologado/instalado. Nenhum registro foi gravado."
    : "A operação não foi confirmada. Verifique permissões, bloqueios e o histórico antes de repetir.";
}

/** Uses planned admin-only RPCs, not browser-side INSERT or a secondary catalog. */
export function AdminCanonicalCatalog() {
  const { categories, loading: loadingCategories, error: categoryError } = useActiveCategories();
  const [availability, setAvailability] = useState<"checking" | "available" | "unavailable">("checking");
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [cities, setCities] = useState<{id: number;name: string;uf: string}[]>([]);
  const [cityId, setCityId] = useState("");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("Cadastro manual pelo administrador");
  const [batch, setBatch] = useState("");
  const [batchReason, setBatchReason] = useState("Importação administrativa em lote");
  const [target, setTarget] = useState<CatalogRow | null>(null);
  const [toggleReason, setToggleReason] = useState("");
  const [editTarget, setEditTarget] = useState<CatalogRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [removeEditPhone, setRemoveEditPhone] = useState(false);
  const [editCityAction, setEditCityAction] = useState<"keep" | "replace" | "clear">("keep");
  const [editCitySearch, setEditCitySearch] = useState("");
  const [editCityId, setEditCityId] = useState("");
  const [editCities, setEditCities] = useState<{id:number;name:string;uf:string}[]>([]);
  const [editCategory, setEditCategory] = useState("__keep__");
  const [editReason, setEditReason] = useState("Atualização administrativa da ficha");
  const pendingManualSource = useRef<string | null>(null);
  const requestCounter = useRef(0);

  const readPage = useCallback(async (nextPage: number, term: string, ids?: string[]) => {
    const { data, error: readError } = await db.rpc("eut_admin_catalog_list", {
      _page: nextPage, _limit: ids ? Math.min(50, ids.length) : PAGE_SIZE,
      _search: ids ? "" : term.slice(0,80),
      _ids: ids ?? null,
    });
    if (readError || !isCatalogSnapshot(data)) {
      throw new Error(genericServerError(readError?.code));
    }
    return data as CatalogSnapshot;
  }, []);

  const refresh = useCallback(async (nextPage: number, term: string) => {
    const ticket = ++requestCounter.current;
    try {
      const result = await readPage(nextPage, term);
      if (ticket !== requestCounter.current) return;
      setRows(result.rows); setTotal(result.total); setPage(nextPage);
      setAvailability("available"); setError("");
    } catch (err) {
      if (ticket !== requestCounter.current) return;
      setAvailability("unavailable"); setRows([]); setTotal(0);
      setError(err instanceof Error ? err.message : "Consulta administrativa indisponível.");
    }
  }, [readPage]);

  useEffect(() => {
    void refresh(0,"");
    return () => { requestCounter.current++; };
  }, [refresh]);

  async function findCities() {
    if (busy) return;
    const value = citySearch.trim().replace(/[%_,\\]/g,"").slice(0,70);
    if (value.length < 2) { setError("Digite ao menos duas letras do município."); return; }
    setError(""); setBusy(true); setCities([]); setCityId("");
    try {
      const {data, error: cityError} = await db.from("eut_ibge_municipalities")
        .select("id,name,uf").ilike("name",value+"%").order("name").limit(30);
      if (cityError || !Array.isArray(data)) throw new Error("Falha ao consultar IBGE.");
      setCities(data as {id:number;name:string;uf:string}[]);
      if (data.length===0) setNotice("Nenhum município correspondente.");
      else setNotice("");
    } catch { setError("Não foi possível consultar os municípios oficiais."); }
    finally { setBusy(false); }
  }

  async function findEditCities() {
    if (busy) return;
    const value = editCitySearch.trim().replace(/[%_,\\]/g,"").slice(0,70);
    if (value.length < 2) { setError("Digite ao menos duas letras do município."); return; }
    setError(""); setBusy(true); setEditCities([]); setEditCityId("");
    try {
      const {data, error: cityError} = await db.from("eut_ibge_municipalities")
        .select("id,name,uf").ilike("name",value+"%").order("name").limit(30);
      if (cityError || !Array.isArray(data)) throw new Error("Consulta municipal indisponível.");
      setEditCities(data as {id:number;name:string;uf:string}[]);
      if (data.length===0) setNotice("Nenhum município correspondente.");
      else setNotice("");
    } catch { setError("Não foi possível consultar os municípios oficiais."); }
    finally { setBusy(false); }
  }

  function openEdit(row: CatalogRow) {
    setTarget(null); setEditTarget(row); setEditName(row.display_name??"");
    setEditPhone(""); setRemoveEditPhone(false);
    setEditCityAction("keep"); setEditCitySearch(""); setEditCityId(""); setEditCities([]);
    setEditCategory("__keep__"); setEditReason("Atualização administrativa da ficha");
    setError(""); setNotice("");
  }

  async function editCatalog(e: FormEvent) {
    e.preventDefault();
    if (!editTarget || busy || availability!=="available") return;
    if (editReason.trim().length<8 || editReason.length>400) {
      setError("Informe o motivo de 8 a 400 caracteres."); return;
    }
    const changes: CatalogEditChanges = {};
    const expected: CatalogEditExpected = {catalog_enabled: editTarget.catalog_enabled};
    const newName = editName.trim() || null;
    if (newName !== editTarget.display_name) {
      changes.label = newName; expected.display_name = newName;
    }
    if (editCityAction==="clear") {
      changes.city_ibge = null; expected.city = null; expected.state_uf = null;
    } else if (editCityAction==="replace") {
      const municipality = editCities.find(city=>String(city.id)===editCityId);
      if (!municipality) { setError("Selecione um município do catálogo IBGE."); return; }
      changes.city_ibge = municipality.id;
      expected.city = municipality.name; expected.state_uf = municipality.uf;
    }
    if (editCategory!=="__keep__") {
      if (editCategory && (categoryError || loadingCategories ||
          !categories.some(category=>category.slug===editCategory))) {
        setError("Selecione uma categoria ativa."); return;
      }
      changes.category_slug = editCategory || null;
      expected.category_slug = editCategory || null;
    }
    if (removeEditPhone) {
      changes.phone = null; expected.has_private_contact = false;
    } else if (editPhone.trim()) {
      changes.phone = editPhone.trim(); expected.has_private_contact = true;
    }
    if (Object.keys(changes).length===0) {
      setError("Altere ao menos um campo da ficha."); return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const {data,error:rpcError}=await db.rpc("eut_admin_catalog_update", {
        _id:editTarget.id,_expected_updated_at:editTarget.updated_at,
        _expected_audit_id:editTarget.last_audit_id,
        _changes:changes,_reason:editReason.trim(),
      });
      if (rpcError || data?.ok!==true || data?.technician_id!==editTarget.id) {
        throw new Error(genericServerError(rpcError?.code));
      }
      if (data.changed===true) {
        const read = await readPage(0,"",[editTarget.id]);
        if (!confirmCatalogEditReadback(read,editTarget.id,data.last_audit_id,expected))
          throw new Error("O banco respondeu, mas a releitura não confirmou campos e auditoria. Confira antes de repetir.");
      }
      setEditTarget(null); setEditPhone(""); setRemoveEditPhone(false);
      setNotice(data.changed===true
        ? "Ficha editada e confirmada no banco com nova auditoria. Contato segue privado; habilitação preservada."
        : "Nenhuma alteração necessária; registro preservado.");
      await refresh(page,search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Edição não confirmada. Atualize antes de repetir.");
    } finally { setBusy(false); }
  }

  async function readback(ids: string[], expected?: boolean) {
    const data = await readPage(0,"",ids);
    if (!confirmCatalogReadback(data,ids,expected))
      throw new Error("O banco respondeu, mas a leitura posterior não confirmou os IDs e a auditoria. Não repita sem conferir.");
    return data;
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy || availability !== "available") return;
    if (!name.trim() && !phone.trim()) { setError("Informe nome ou telefone."); return; }
    if (reason.trim().length < 8 || reason.length > 400) { setError("Informe motivo de 8 a 400 caracteres."); return; }
    if (categoryError || loadingCategories) { setError("Categorias indisponíveis."); return; }
    if (category && !categories.some(c=>c.slug===category)) { setError("Categoria não está ativa."); return; }
    const municipality = cities.find(c=>String(c.id)===cityId);
    if (cityId && !municipality) { setError("Selecione um município oficial."); return; }
    if (!pendingManualSource.current) pendingManualSource.current = "manual:" + crypto.randomUUID();
    setBusy(true); setError(""); setNotice("");
    try {
      const {data,error:rpcError} = await db.rpc("eut_admin_catalog_upsert",{
        _origin:"admin_manual", _source_key:pendingManualSource.current,
        _label:name.trim() || null, _city_ibge:municipality?.id??null,
        _category_slug:category||null, _phone_input:phone.trim()||null, _reason:reason.trim(),
      });
      if (rpcError || !data?.ok || typeof data.technician_id !== "string") {
        throw new Error(genericServerError(rpcError?.code));
      }
      await readback([data.technician_id],Boolean(data.catalog_enabled));
      setPhone(""); setName(""); pendingManualSource.current=null;
      setNotice("Técnico habilitado no catálogo operacional. Gravação e auditoria verificadas automaticamente; a busca pública será ativada na etapa de integração.");
      await refresh(0,search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha de gravação.");
    } finally { setBusy(false); }
  }

  async function importBatch(e: FormEvent) {
    e.preventDefault();
    if (busy || availability !== "available") return;
    const prepared = parseCatalogBatch(batch);
    if (!prepared.ok) { setError(prepared.issue); return; }
    if (batchReason.trim().length < 8 || batchReason.length > 400) {
      setError("Informe motivo de 8 a 400 caracteres."); return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const {data,error:rpcError} = await db.rpc("eut_admin_catalog_import_batch",{
        _rows:prepared.rows,_reason:batchReason.trim(),
      });
      const reply=data as CatalogBatchResult | null;
      if (rpcError || !reply?.ok || reply.processed!==prepared.rows.length ||
          !Array.isArray(reply.results) || reply.results.some(x=>!x.ok || !x.technician_id))
        throw new Error(genericServerError(rpcError?.code));
      const ids=[...new Set(reply.results.map((x:CatalogWriteResult)=>String(x.technician_id)))];
      if (ids.length!==prepared.rows.length) throw new Error("IDs repetidos no lote. Confira o histórico antes de reenviar.");
      await readback(ids);
      setBatch("");
      setNotice(ids.length+" registros verificados após releitura. Operações originais e duplicadas foram mantidas conforme suas origens.");
      await refresh(0,search);
    } catch(err) {
      setError(err instanceof Error ? err.message : "Lote não confirmado. Não repita sem conferir os registros.");
    } finally { setBusy(false); }
  }

  async function setEnabled(e: FormEvent) {
    e.preventDefault();
    if (!target || busy || availability !== "available") return;
    if (toggleReason.trim().length < 8 || toggleReason.length > 400) {
      setError("Informe o motivo da alteração (8 a 400 caracteres)."); return;
    }
    const desired = !target.catalog_enabled;
    if (!window.confirm((desired?"Habilitar":"Desabilitar")+" esta ficha canônica? A ação será auditada e não alterará a elegibilidade pública legada.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const {data,error:rpcError}=await db.rpc("eut_admin_catalog_set_enabled",{
        _id:target.id,_expected_updated_at:target.updated_at,
        _enabled:desired,_reason:toggleReason.trim(),
      });
      if (rpcError || !data?.ok || data.catalog_enabled!==desired)
        throw new Error(genericServerError(rpcError?.code));
      await readback([target.id],desired);
      setTarget(null); setToggleReason("");
      setNotice("Habilitação atualizada, gravada e auditada. Estado confirmado após nova consulta.");
      await refresh(page,search);
    } catch(err) {
      setError(err instanceof Error ? err.message : "Alteração não confirmada. Atualize antes de repetir.");
    } finally { setBusy(false); }
  }

  return (
    <section aria-label="Cadastro canônico administrativo" className="mt-6 space-y-4 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <Database aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-primary" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Cadastro canônico · técnicos sem login</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Gestão de fichas administrativas e importadas no mesmo cadastro de técnicos.
            Habilitado no catálogo operacional não significa publicado na busca nem contato liberado.
          </p>
        </div>
      </div>
      {availability==="checking" && <p role="status" className="text-sm text-muted-foreground">Verificando backend administrativo…</p>}
      {availability==="unavailable" && (
        <div role="status" className="flex gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <LockKeyhole aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground"/>
          <p>Cadastro canônico ainda indisponível: a instalação segura das RPCs e a homologação administrativa estão pendentes.
            Nenhuma operação de criação/importação é oferecida sem backend verificado.</p>
        </div>
      )}
      {availability==="available" && (
        <>
          <form onSubmit={e=>void create(e)} className="grid gap-3 rounded-xl border border-border p-4">
            <h3 className="flex items-center gap-2 font-semibold"><PlusCircle className="h-5 w-5" aria-hidden="true"/> Nova ficha administrativa</h3>
            <label className="grid gap-1 text-sm font-medium">Nome público (opcional se houver telefone)
              <input className="min-h-11 rounded-lg border border-input bg-background px-3 text-base" maxLength={100}
                value={name} onChange={e=>setName(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium">Telefone privado (opcional se houver nome)
              <input className="min-h-11 rounded-lg border border-input bg-background px-3 text-base" type="tel" maxLength={30}
                autoComplete="off" value={phone} onChange={e=>setPhone(e.target.value)}/>
            </label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <label className="grid gap-1 text-sm font-medium">Município IBGE (opcional)
                <input className="min-h-11 rounded-lg border border-input bg-background px-3 text-base"
                  value={citySearch} onChange={e=>setCitySearch(e.target.value)} maxLength={70} placeholder="Pesquisar município"/>
              </label>
              <button className="min-h-11 self-end rounded-lg border border-border px-4 text-sm font-semibold" type="button" onClick={()=>void findCities()} disabled={busy}>Buscar cidade</button>
            </div>
            {cities.length>0 && <label className="grid gap-1 text-sm font-medium">Cidade oficial
              <select className="min-h-11 rounded-lg border border-input bg-background px-3 text-base"
                value={cityId} onChange={e=>setCityId(e.target.value)}>
                <option value="">Não declarar município</option>
                {cities.map(c=><option key={c.id} value={c.id}>{c.name}/{c.uf} (IBGE {c.id})</option>)}
              </select>
            </label>}
            <label className="grid gap-1 text-sm font-medium">Categoria inicial
              <select className="min-h-11 rounded-lg border border-input bg-background px-3 text-base" disabled={loadingCategories||categoryError}
                value={category} onChange={e=>setCategory(e.target.value)}>
                <option value="">Não declarar categoria</option>
                {categories.map(c=><option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">Motivo obrigatório da criação
              <textarea className="rounded-lg border border-input bg-background p-3 text-base" rows={2} minLength={8} maxLength={400}
                value={reason} onChange={e=>setReason(e.target.value)} required/>
            </label>
            <button type="submit" disabled={busy||categoryError||loadingCategories}
              className="min-h-12 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">
              {busy?"Gravando e verificando…":"Cadastrar técnico habilitado"}
            </button>
          </form>
          <form onSubmit={e=>void importBatch(e)} className="grid gap-3 rounded-xl border border-border p-4">
            <h3 className="flex items-center gap-2 font-semibold"><ClipboardList className="h-5 w-5" aria-hidden="true"/> Importar lote auditado</h3>
            <p className="text-sm text-muted-foreground">JSON com até 50 objetos contendo origem, chave de origem, nome e/ou telefone, município IBGE e categoria opcionais. Guarde as chaves de origem no seu sistema de importação para permitir repetição segura. Telefones não são salvos no navegador.</p>
            <label className="grid gap-1 text-sm font-medium">Registros JSON
              <textarea className="rounded-lg border border-input bg-background p-3 font-mono text-sm" rows={5}
                value={batch} onChange={e=>setBatch(e.target.value)} autoComplete="off" spellCheck={false}
                placeholder={'[{"origin":"wordpress","source_key":"wp:123","label":"Profissional cadastrado","phone":null,"city_ibge":null,"category_slug":null}]'}/>
            </label>
            <label className="grid gap-1 text-sm font-medium">Motivo auditado do lote
              <textarea className="rounded-lg border border-input bg-background p-3 text-base" minLength={8} maxLength={400}
                rows={2} value={batchReason} onChange={e=>setBatchReason(e.target.value)} required/>
            </label>
            <button type="submit" disabled={busy} className="min-h-12 rounded-xl border border-primary px-4 font-bold text-primary disabled:opacity-50">
              {busy?"Importando e verificando…":"Importar técnicos habilitados"}
            </button>
          </form>
          <div className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" aria-hidden="true"/> Registros persistidos ({total})</h3>
              <button type="button" disabled={busy} onClick={()=>void refresh(page,search)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm">
                <RefreshCw aria-hidden="true" className="h-4 w-4"/> Recarregar do banco
              </button>
            </div>
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();setSearch(draftSearch.trim());void refresh(0,draftSearch.trim());}}>
              <input aria-label="Filtrar por nome" className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base"
                placeholder="Filtrar pelo nome" maxLength={80} value={draftSearch} onChange={e=>setDraftSearch(e.target.value)}/>
              <button type="submit" className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold">Buscar</button>
            </form>
            {rows.length===0 ? <p className="mt-4 text-sm text-muted-foreground">Nenhuma ficha encontrada nesta página.</p> : (
              <ul className="mt-4 grid gap-2">
                {rows.map(r=><li key={r.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{r.display_name||"Cadastro com contato protegido"}</p>
                      <p className="text-xs text-muted-foreground">{r.city?(r.city+"/"+(r.state_uf||"")):"Município não informado"} · {r.catalog_origin==="admin_manual"?"Manual":r.catalog_origin==="wordpress"?"WordPress":"Importado"} · {r.has_private_contact?"Contato protegido":"Sem telefone"} · {r.catalog_enabled?"Habilitado operacionalmente":"Desabilitado"}</p>
                      <p className="text-xs text-muted-foreground">Registro {r.id} · auditoria {r.last_audit_id??"não localizada"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" disabled={busy||!r.last_audit_id} onClick={()=>openEdit(r)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/30 px-4 text-sm font-semibold text-primary">
                        <Pencil aria-hidden="true" className="h-4 w-4"/> Editar ficha
                      </button>
                      <button type="button" disabled={busy||!r.last_audit_id}
                        onClick={()=>{setEditTarget(null);setTarget(r);setToggleReason("");}} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold">
                        {r.catalog_enabled?"Desabilitar":"Habilitar"}
                      </button>
                    </div>
                  </div>
                </li>)}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <button type="button" disabled={busy||page===0} onClick={()=>void refresh(page-1,search)}
                className="min-h-11 rounded-lg border border-border px-3 text-sm disabled:opacity-50">Anterior</button>
              <span className="text-xs text-muted-foreground">Página {page+1}</span>
              <button type="button" disabled={busy||(page+1)*PAGE_SIZE>=total} onClick={()=>void refresh(page+1,search)}
                className="min-h-11 rounded-lg border border-border px-3 text-sm disabled:opacity-50">Próxima</button>
            </div>
          </div>
          {editTarget && <form onSubmit={e=>void editCatalog(e)}
            className="grid gap-3 rounded-xl border border-primary/25 bg-muted/15 p-4" aria-label="Editar ficha canônica">
            <h3 className="flex items-center gap-2 font-bold"><Pencil aria-hidden="true" className="h-4 w-4"/> Editar ficha administrativa</h3>
            <p className="text-xs text-muted-foreground">
              {editTarget.id} · {editTarget.catalog_enabled?"Habilitado":"Desabilitado"} · {editTarget.catalog_origin}.
              Somente campos modificados serão gravados. Origem, acesso e status permanecem inalterados.
            </p>
            <label className="grid gap-1 text-sm font-medium">Nome público (pode ficar vazio se houver telefone)
              <input value={editName} onChange={e=>setEditName(e.target.value)}
                maxLength={100} className="min-h-11 rounded-lg border border-input bg-background px-3 text-base"/>
            </label>
            <div className="rounded-lg border border-border p-3">
              <label className="grid gap-1 text-sm font-medium">Telefone privado novo (deixe vazio para manter)
                <input type="tel" autoComplete="off" maxLength={40} disabled={removeEditPhone}
                  value={editPhone} onChange={e=>setEditPhone(e.target.value)}
                  className="min-h-11 rounded-lg border border-input bg-background px-3 text-base"/>
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={removeEditPhone} disabled={!editTarget.has_private_contact}
                  onChange={e=>{setRemoveEditPhone(e.target.checked);setEditPhone("");}}/>
                Remover telefone privado existente
              </label>
              <p className="mt-2 text-xs text-muted-foreground">O número existente nunca é exibido. Substituição/remoção exige gravação auditada.</p>
            </div>
            <label className="grid gap-1 text-sm font-medium">Município declarado
              <select className="min-h-11 rounded-lg border border-input bg-background px-3 text-base"
                value={editCityAction} onChange={e=>setEditCityAction(e.target.value as "keep"|"replace"|"clear")}>
                <option value="keep">Manter: {editTarget.city?(editTarget.city+"/"+editTarget.state_uf):"não informado"}</option>
                <option value="replace">Trocar por município IBGE</option>
                <option value="clear">Remover município declarado</option>
              </select>
            </label>
            {editCityAction==="replace" && <>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <label className="grid gap-1 text-sm font-medium">Buscar município IBGE
                  <input value={editCitySearch} onChange={e=>setEditCitySearch(e.target.value)}
                    maxLength={70} className="min-h-11 rounded-lg border border-input bg-background px-3 text-base"/>
                </label>
                <button type="button" disabled={busy} onClick={()=>void findEditCities()}
                  className="min-h-11 self-end rounded-lg border border-border px-4 text-sm font-semibold">Buscar cidade</button>
              </div>
              <label className="grid gap-1 text-sm font-medium">Município oficial
                <select value={editCityId} onChange={e=>setEditCityId(e.target.value)}
                  className="min-h-11 rounded-lg border border-input bg-background px-3 text-base">
                  <option value="">Selecione um município válido</option>
                  {editCities.map(c=><option key={c.id} value={c.id}>{c.name}/{c.uf} (IBGE {c.id})</option>)}
                </select>
              </label>
            </>}
            <label className="grid gap-1 text-sm font-medium">Categoria declarada
              <select value={editCategory} onChange={e=>setEditCategory(e.target.value)}
                disabled={loadingCategories||categoryError}
                className="min-h-11 rounded-lg border border-input bg-background px-3 text-base">
                <option value="__keep__">Manter categorias atuais {editTarget.specialties.join(", ")||"(não informadas)"}</option>
                <option value="">Remover categoria declarada</option>
                {categories.map(c=><option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">Motivo da edição (auditoria)
              <textarea required rows={2} minLength={8} maxLength={400}
                value={editReason} onChange={e=>setEditReason(e.target.value)}
                className="rounded-lg border border-input bg-background p-3 text-base"/>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy}
                className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {busy?"Salvando e conferindo…":"Salvar edição no banco"}
              </button>
              <button type="button" disabled={busy} onClick={()=>{setEditTarget(null);setEditPhone("");}}
                className="min-h-11 rounded-lg border border-border px-4 text-sm">Cancelar</button>
            </div>
          </form>}
          {target && <form onSubmit={e=>void setEnabled(e)} className="grid gap-3 rounded-xl border border-primary/25 p-4" aria-label="Confirmar mudança auditada">
            <h3 className="font-bold">{target.catalog_enabled?"Desabilitar":"Habilitar"} cadastro</h3>
            <p className="text-sm text-muted-foreground">{target.display_name||target.id} — nenhuma publicação ou contato será liberado por esta ação isolada.</p>
            <label className="grid gap-1 text-sm font-medium">Motivo obrigatório
              <textarea required minLength={8} maxLength={400} rows={2} value={toggleReason}
                onChange={e=>setToggleReason(e.target.value)}
                className="rounded-lg border border-input bg-background p-3 text-base"/>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Salvar alteração e conferir</button>
              <button type="button" disabled={busy} onClick={()=>setTarget(null)} className="min-h-11 rounded-lg border border-border px-4 text-sm">Cancelar</button>
            </div>
          </form>}
        </>
      )}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-primary/25 p-3 text-sm text-foreground">{notice}</p>}
    </section>
  );
}
