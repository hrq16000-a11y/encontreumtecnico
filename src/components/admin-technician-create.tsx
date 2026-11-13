import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UserRoundPlus, Search, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCategories } from "@/hooks/use-active-categories";
import {
  confirmCreatedTechnician, isProvisionableAccount, prepareAdminTechnicianCreation,
  type ProvisionableAccount, type OfficialCity, type PersistedTechnician, type CreationAudit,
} from "@/lib/admin-technician-create-contract";

const db = supabase as unknown as SupabaseClient;

/** A real server-backed flow. It cannot create an Auth user or bypass a member invite. */
export function AdminTechnicianCreate({ adminId, onCreated }: {
  adminId: string; onCreated: () => void;
}) {
  const { categories, loading: categoriesLoading, error: categoriesError } = useActiveCategories();
  const [accountSearch, setAccountSearch] = useState("");
  const [accounts, setAccounts] = useState<ProvisionableAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [cities, setCities] = useState<OfficialCity[]>([]);
  const [cityId, setCityId] = useState("");
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState("");

  async function searchAccounts(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const search = accountSearch.trim().slice(0, 80);
    if (search.length < 2) { setError("Informe ao menos 2 caracteres do nome ou e-mail."); return; }
    setBusy(true); setError(""); setNotice(""); setAccountId(""); setAccounts([]);
    try {
      const { data, error: searchError } = await db.rpc("eut_admin_accounts_snapshot", {
        _search: search, _filter: "tecnicos", _page: 0,
      });
      if (searchError || !Array.isArray(data?.accounts))
        throw new Error("Não foi possível consultar as contas autorizadas.");
      const eligible = (data.accounts as ProvisionableAccount[]).filter(isProvisionableAccount);
      setAccounts(eligible);
      if (eligible.length === 0) setNotice("Nenhuma conta técnica confirmada sem ficha neste recorte. Refine a busca ou use o convite acima.");
      else if (data.total > 20) setNotice("A consulta mostra até 20 contas. Refine pelo nome para localizar uma específica.");
    } catch { setError("Busca de contas indisponível. Confirme sua sessão administrativa."); }
    finally { setBusy(false); }
  }

  async function searchCities(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const search = citySearch.trim().replace(/[%_,\\]/g, "").slice(0, 80);
    if (search.length < 2) { setError("Digite pelo menos duas letras da cidade oficial."); return; }
    setBusy(true); setError(""); setCityId(""); setCities([]);
    try {
      const { data, error: cityError } = await db.from("eut_ibge_municipalities")
        .select("id,name,uf").ilike("name", search + "%").order("name").limit(30);
      if (cityError || !Array.isArray(data)) throw new Error("Municípios indisponíveis.");
      setCities(data as OfficialCity[]);
      if (data.length === 0) setNotice("Município não encontrado no catálogo IBGE.");
      else setNotice("");
    } catch { setError("Falha ao consultar municípios oficiais."); }
    finally { setBusy(false); }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy || createdId) return;
    const account = accounts.find(a => a.id === accountId);
    const city = cities.find(c => String(c.id) === cityId);
    const prepared = prepareAdminTechnicianCreation({
      account, city, category, activeSlugs: categories.map(c => c.slug), name, reason,
    });
    if (!prepared.ok) { setError(prepared.issue); return; }
    if (!city || !account) return;
    if (!window.confirm(
      "Criar ficha PENDENTE para " + account.full_name + " em " +
      city.name + "/" + city.uf + "? O usuário já deve ter aceitado o convite. " +
      "Não será criado login, divulgado contato nem aprovado profissional."
    )) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data: created, error: rpcError } = await db.rpc(
        "eut_admin_technician_create", prepared.payload,
      );
      if (rpcError) {
        if (rpcError.code === "PGRST202" || rpcError.code === "42883")
          throw new Error("Backend de criação ainda não instalado. Nenhuma criação confirmada.");
        throw new Error("Servidor recusou a criação. Confirme conta, papel, bloqueios e permissões.");
      }
      if (!created?.ok || !created?.technician_id || !created?.audit_id)
        throw new Error("O servidor não confirmou a criação e a auditoria.");

      // An ambiguous response must never be treated as permission to retry a write.
      setCreatedId(String(created.technician_id));
      const [{data: persisted, error: readError}, {data: audit, error: auditError}] =
        await Promise.all([
          db.from("technicians")
            .select("id,user_id,display_name,city,state_uf,specialties,status")
            .eq("id", created.technician_id).single(),
          db.from("eut_admin_management_log")
            .select("id,actor_id,target_type,target_key,action")
            .eq("id", created.audit_id).single(),
        ]);
      if (readError || auditError || !confirmCreatedTechnician(
        created, persisted as PersistedTechnician | null,
        audit as CreationAudit | null, prepared.payload, city, adminId,
      )) throw new Error(
        "O servidor retornou um ID, mas a leitura da ficha/auditoria não foi confirmada. " +
        "Consulte a lista antes de repetir a operação."
      );
      setNotice("Ficha pendente gravada e auditada. ID: " + created.technician_id +
        ". A lista abaixo foi atualizada; confirme a ficha na aba Pendentes.");
      setReason("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a ficha.");
    } finally { setBusy(false); }
  }
  const canCreate = !busy && !createdId && !categoriesLoading && !categoriesError &&
    Boolean(accountId && cityId && category && name.trim() && reason.trim());
  return (
    <section aria-label="Criar ficha administrativa de técnico" className="mt-6 space-y-4 rounded-2xl border border-primary/25 bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <UserRoundPlus className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Criar ficha de técnico</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Vincule uma conta de técnico já cadastrada e com e-mail confirmado.
            Para uma pessoa nova, use primeiro o convite acima. A ficha nasce pendente,
            sem publicar perfil, inventar contato ou criar login.
          </p>
        </div>
      </div>
      <form onSubmit={e => void searchAccounts(e)} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1 text-sm font-semibold">
          Localizar conta existente
          <input value={accountSearch} onChange={e => setAccountSearch(e.target.value)} maxLength={80}
            placeholder="Nome ou e-mail da conta" className="min-h-11 rounded-lg border border-input bg-background px-3 text-base" />
        </label>
        <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-lg border border-primary px-4 font-semibold text-primary disabled:opacity-50">
          <Search className="h-4 w-4" aria-hidden="true" /> Buscar contas
        </button>
      </form>
      {accounts.length > 0 && <label className="grid gap-1 text-sm font-semibold">
        Conta confirmada apta
        <select value={accountId} onChange={e => {
          setAccountId(e.target.value);
          setName(accounts.find(a => a.id === e.target.value)?.full_name ?? "");
          setCreatedId("");
        }} className="min-h-11 rounded-lg border border-input bg-background px-3 text-base">
          <option value="">Selecione uma conta</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.full_name} · {a.masked_email ?? "E-mail oculto"}</option>)}
        </select>
      </label>}
      <form onSubmit={e => void searchCities(e)} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1 text-sm font-semibold">
          Município IBGE
          <input value={citySearch} onChange={e => setCitySearch(e.target.value)} maxLength={80}
            placeholder="Ex.: Curitiba" className="min-h-11 rounded-lg border border-input bg-background px-3 text-base" />
        </label>
        <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-lg border border-primary px-4 font-semibold text-primary disabled:opacity-50">
          <MapPin className="h-4 w-4" aria-hidden="true" /> Buscar cidades
        </button>
      </form>
      {cities.length > 0 && <label className="grid gap-1 text-sm font-semibold">
        Cidade oficial
        <select value={cityId} onChange={e => { setCityId(e.target.value); setCreatedId(""); }}
          className="min-h-11 rounded-lg border border-input bg-background px-3 text-base">
          <option value="">Selecione município e UF</option>
          {cities.map(c => <option key={c.id} value={c.id}>{c.name}/{c.uf} · IBGE {c.id}</option>)}
        </select>
      </label>}
      <form onSubmit={e => void create(e)} className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">Nome público
          <input required maxLength={80} minLength={3} value={name} onChange={e => {setName(e.target.value);setCreatedId("");}}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-base" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Categoria inicial
          <select required value={category} onChange={e => {setCategory(e.target.value);setCreatedId("");}}
            disabled={categoriesLoading || categoriesError}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-base">
            <option value="">Selecione uma categoria ativa</option>
            {categories.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">Motivo administrativo auditado
          <textarea required minLength={8} maxLength={400} rows={2} value={reason}
            onChange={e => {setReason(e.target.value);setCreatedId("");}}
            className="rounded-lg border border-input bg-background p-3 text-base"
            placeholder="Ex.: criação da ficha para técnico que confirmou o cadastro" />
        </label>
        <button type="submit" disabled={!canCreate}
          className="min-h-12 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">
          {busy ? "Verificando e gravando…" : "Criar ficha pendente no banco"}
        </button>
      </form>
      {categoriesError && <p role="alert" className="text-sm text-destructive">Catálogo indisponível; criação bloqueada.</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-primary/20 p-3 text-sm text-foreground">{notice}</p>}
      {createdId && <p className="text-xs text-muted-foreground">Ficha retornada pelo servidor: {createdId}. Não repita sem conferir o registro.</p>}
    </section>
  );
}
