import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Archive, Check, ChevronDown, Pencil, RotateCcw, ShieldAlert, SquareCheckBig, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LEGACY_REVIEW_PAGE_SIZE, normalizeLegacyReviewSearch } from "@/lib/legacy-review-utils";

type LegacyKind = "candidate" | "employer";
type LegacyProfile = {
  source_key: string; wp_post_id: number; wp_user_id: number; kind: LegacyKind;
  slug: string; title: string; specialty_title: string | null;
  location1: string | null; location2: string | null; location3: string | null;
  review_status: "pending_review" | "in_review" | "excluded" | "verified";
  demo_candidate: boolean;
};
type Managed = {
  wp_post_id: number;
  record_state: "pendente" | "em_revisao" | "pronto_para_validacao" | "excluido";
  corrected_name: string | null;
  admin_notes: string | null;
};
type Action = "revisar" | "arquivar" | "restaurar" | "corrigir_nome" | "anotar";
const actionLabel: Record<Action, string> = {
  revisar: "Marcar em revisão", arquivar: "Arquivar sem apagar", restaurar: "Restaurar à revisão",
  corrigir_nome: "Corrigir nome de exibição", anotar: "Editar anotação administrativa",
};
const FIELDS = "source_key,wp_post_id,wp_user_id,kind,slug,title,specialty_title,location1,location2,location3,review_status,demo_candidate";
const db = supabase as unknown as SupabaseClient;

/** WordPress source remains immutable; only an audited, admin-owned review overlay is edited. */
export function LegacyReviewQueue({ onlyTechnicians = false, onlyClients = false }:
  { onlyTechnicians?: boolean; onlyClients?: boolean } = {}) {
  const [kind, setKind] = useState<LegacyKind>(onlyClients ? "employer" : "candidate");
  const [draft, setDraft] = useState(() => typeof window === "undefined" ? "" :
    new URLSearchParams(window.location.search).get("busca")?.slice(0, 100) ?? "");
  const [term, setTerm] = useState(() => normalizeLegacyReviewSearch(draft));
  const [order, setOrder] = useState<"recent" | "oldest" | "name">("recent");
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [rows, setRows] = useState<LegacyProfile[]>([]);
  const [managed, setManaged] = useState<Record<number, Managed>>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [action, setAction] = useState<{ ids: number[]; type: Action } | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true);
      setError(null);
      let query = db.from("legacy_review_profiles")
        .select(FIELDS, { count: "exact" }).eq("source_key", "wordpress_20261108").eq("kind", kind);
      if (term) query = query.ilike("title", `%${term}%`);
      const { data, error: readError, count } = await query
        .order(order === "name" ? "title" : "imported_at", { ascending: order === "oldest" })
        .order("wp_post_id", { ascending: order === "oldest" })
        .range(page * LEGACY_REVIEW_PAGE_SIZE, (page + 1) * LEGACY_REVIEW_PAGE_SIZE - 1);
      if (!current) return;
      if (readError) {
        setRows([]); setManaged({}); setTotal(0);
        setError("Não foi possível consultar o inventário. Confirme seu acesso administrativo.");
        setLoading(false);
        return;
      }
      const list = (data ?? []) as LegacyProfile[];
      const ids = list.map((item) => item.wp_post_id);
      const overlay = ids.length
        ? await db.from(kind === "candidate" ? "eut_legacy_profile_management" : "eut_legacy_employer_management")
          .select("wp_post_id,record_state,corrected_name,admin_notes")
          .eq("source_key", "wordpress_20261108").in("wp_post_id", ids)
        : { data: [], error: null };
      if (!current) return;
      if (overlay.error) {
        setError("Não foi possível consultar os estados de gestão destas fichas.");
        setRows([]); setManaged({}); setTotal(0);
      } else {
        setRows(list); setTotal(count ?? 0);
        setManaged(Object.fromEntries(((overlay.data ?? []) as Managed[])
          .map((item) => [item.wp_post_id, item])));
      }
      setLoading(false);
    }
    void load();
    return () => { current = false; };
  }, [kind, page, term, order, version]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setTerm(normalizeLegacyReviewSearch(draft));
    setSelected([]); setExpanded([]); setPage(0); setAction(null);
  }

  function chooseAction(ids: number[], type: Action) {
    if (!ids.length || ids.length > 20) {
      setFeedback("Escolha de 1 a 20 fichas para esta ação.");
      return;
    }
    if (type !== "arquivar" && rows.some((r) => ids.includes(r.wp_post_id) && r.demo_candidate)) {
      setFeedback("Registros de demonstração só podem ser arquivados.");
      return;
    }
    if (["corrigir_nome", "anotar"].includes(type) && ids.length !== 1) {
      setFeedback("A edição de texto é individual; selecione uma única ficha.");
      return;
    }
    setFeedback(null);
    setAction({ ids, type });
    const id = ids[0];
    if (id === undefined) return;
    const current = managed[id];
    setValue(type === "corrigir_nome"
      ? current?.corrected_name ?? rows.find((r) => r.wp_post_id === id)?.title ?? ""
      : type === "anotar" ? current?.admin_notes ?? "" : "");
    setReason("");
  }

  async function runAction(event: FormEvent) {
    event.preventDefault();
    if (!action || busy) return;
    if (reason.trim().length < 8 || reason.length > 400) {
      setFeedback("Informe um motivo com 8 a 400 caracteres.");
      return;
    }
    if (action.ids.length > 1 &&
        !window.confirm(`Aplicar "${actionLabel[action.type]}" a ${action.ids.length} fichas históricas? Os dados originais serão preservados.`)) return;
    setBusy(true); setFeedback(null);
    try {
      const { data, error: changeError } = await db.rpc("eut_admin_legacy_action", {
        p_ids: action.ids, p_action: action.type, p_value: value, p_reason: reason.trim(),
      });
      if (changeError) throw changeError;
      if (data?.updated !== action.ids.length || data?.published !== false)
        throw new Error("Servidor não confirmou o total processado ou a preservação da privacidade.");
      setFeedback(`${data.updated} ficha(s) atualizada(s) e registrada(s) na auditoria. Nenhuma conta foi publicada.`);
      setAction(null);
      setSelected([]);
      setVersion((n) => n + 1);
    } catch (e) {
      setFeedback("Operação não concluída. " + (e instanceof Error ? e.message.slice(0, 230) : "Tente novamente."));
    } finally { setBusy(false); }
  }

  const stateOf = (id: number) => managed[id]?.record_state ?? "pendente";
  // A protected demo that is already archived has no permitted operation.
  const selectable = rows.filter((row) => !(row.demo_candidate && stateOf(row.wp_post_id) === "excluido"))
    .map((row) => row.wp_post_id).slice(0, 20);
  const allSelected = selectable.length > 0 && selectable.every((id) => selected.includes(id));
  const chosenRows = rows.filter((row) => selected.includes(row.wp_post_id));
  const hasDemoSelection = chosenRows.some((row) => row.demo_candidate);
  const canArchiveSelection = chosenRows.length > 0 && chosenRows.every((row) => stateOf(row.wp_post_id) !== "excluido");
  const canRestoreSelection = chosenRows.length > 0 && !hasDemoSelection &&
    chosenRows.every((row) => stateOf(row.wp_post_id) === "excluido");
  return <section className="mt-2 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label={onlyClients ? "Clientes antigos" : "Cadastros históricos"}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-card-foreground">{onlyClients ? "Clientes antigos" : onlyTechnicians ? "Técnicos antigos — gestão auditada" : "Acervo histórico — gestão auditada"}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Fichas do portal antigo são arquivos históricos: podem ser revisadas, anotadas,
          corrigidas ou arquivadas individualmente ou em lote, sem alterar os dados originais.
          Nenhuma ação nesta tela ativa contas ou libera contatos privados.
        </p>
        {!onlyClients && <p className="mt-2 text-sm text-muted-foreground">
          Para editar perfis cadastrados, use a <Link to="/admin/$secao" params={{ secao: "tecnicos" }}
            className="font-bold text-primary underline underline-offset-2">gestão de técnicos</Link>.
          Este acervo preserva os originais para auditoria: arquivar não apaga definitivamente.
        </p>}
      </div>
      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">Até 20 por lote</span>
    </div>
    {!onlyTechnicians && !onlyClients && <div role="group" aria-label="Tipo de cadastro histórico" className="mt-5 flex flex-wrap gap-2">
      {([{value:"candidate",label:"Técnicos"},{value:"employer",label:"Contratantes"}] as const).map((item) =>
        <button key={item.value} type="button" aria-pressed={kind===item.value}
          onClick={() => { setKind(item.value); setPage(0); setSelected([]); setExpanded([]); setAction(null); }}
          className={"min-h-11 rounded-xl border px-4 text-sm font-semibold " +
            (kind===item.value?"bg-primary text-primary-foreground":"border-input text-foreground hover:bg-accent")}>{item.label}</button>)}
    </div>}
    <form onSubmit={submitSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor="legacy-review-search">Buscar nome histórico</label>
      <input id="legacy-review-search" value={draft} maxLength={100} onChange={(e)=>setDraft(e.target.value)}
        placeholder="Buscar pelo nome" className="min-h-12 flex-1 rounded-xl border border-input bg-background px-4 text-foreground" />
      <button type="submit" className="min-h-12 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">Buscar</button>
    </form>
    <label className="mt-3 flex max-w-xs flex-col gap-1 text-sm font-semibold">Ordenar entradas históricas
      <select value={order} onChange={(event) => { setOrder(event.target.value as typeof order); setPage(0); setSelected([]); }}
        className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">
        <option value="recent">Importações recentes primeiro</option>
        <option value="oldest">Importações antigas primeiro</option>
        <option value="name">Nome A–Z</option>
      </select>
    </label>
    <p className="mt-1 text-xs text-muted-foreground">A data de importação não representa a data de cadastro original.</p>
    {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
    {feedback && <p role="status" className="mt-4 rounded-xl border border-border bg-muted p-4 text-sm text-foreground">{feedback}</p>}
    <p role="status" className="mt-4 text-sm text-muted-foreground">
      {loading ? "Consultando registros…" : `${total} ficha(s) encontrada(s) · página ${page+1}`}
    </p>
    {!loading && rows.length > 0 && <>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-3">
        <button type="button" disabled={!selectable.length} onClick={() => setSelected(allSelected ? [] : selectable)}
          aria-pressed={allSelected} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-semibold text-foreground disabled:opacity-50">
          <SquareCheckBig className="h-4 w-4" /> {allSelected ? "Desmarcar página" : "Selecionar página"}
        </button>
        <span className="text-sm text-muted-foreground">{selected.length} selecionada(s)</span>
        <button type="button" disabled={!selected.length || hasDemoSelection} onClick={() => chooseAction(selected,"revisar")}
          className="min-h-11 rounded-lg border border-input px-3 text-sm font-medium text-foreground disabled:opacity-50">Revisar lote</button>
        <button type="button" disabled={!canArchiveSelection} onClick={() => chooseAction(selected,"arquivar")}
          className="min-h-11 rounded-lg border border-input px-3 text-sm font-medium text-foreground disabled:opacity-50">Arquivar lote</button>
        <button type="button" disabled={!canRestoreSelection} onClick={() => chooseAction(selected,"restaurar")}
          className="min-h-11 rounded-lg border border-input px-3 text-sm font-medium text-foreground disabled:opacity-50">Restaurar lote</button>
      </div>
      {selected.length > 0 && <p className="mt-2 text-xs text-muted-foreground" role="status">
        Ações em lote só ficam disponíveis quando todas as fichas selecionadas permitem a operação.
        Registros de demonstração não podem ser revisados ou restaurados; arquivados não são apagados.
      </p>}
      {action && <form onSubmit={(e) => void runAction(e)} aria-label="Confirmar gestão histórica"
        className="mt-4 space-y-3 rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-bold text-foreground">{actionLabel[action.type]}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{action.ids.length} ficha(s) · alteração reversível no estado de revisão</p></div>
          <button type="button" aria-label="Cancelar ação histórica" onClick={() => setAction(null)}
            className="rounded-lg border border-input p-2 text-foreground"><X className="h-4 w-4" /></button>
        </div>
        {action.type === "corrigir_nome" && <label className="block text-sm font-medium text-foreground">Nome corrigido
          <input required minLength={3} maxLength={100} value={value} onChange={(e)=>setValue(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-foreground" /></label>}
        {action.type === "anotar" && <label className="block text-sm font-medium text-foreground">Anotação privada
          <textarea required minLength={8} maxLength={800} rows={3} value={value} onChange={(e)=>setValue(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-3 text-foreground" /></label>}
        <label className="block text-sm font-medium text-foreground">Motivo obrigatório para auditoria
          <textarea required minLength={8} maxLength={400} rows={2} value={reason}
            onChange={(e)=>setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-3 text-foreground" /></label>
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ShieldAlert className="h-4 w-4" /> Esta ação não ativa contas nem expõe contatos.
        </p>
        <button type="submit" disabled={busy} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50">
          <Check className="h-4 w-4" /> {busy ? "Gravando…" : "Confirmar operação"}
        </button>
      </form>}
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map((row)=>{
          const state=stateOf(row.wp_post_id);
          const archived=state==="excluido";
          const protectedArchive=row.demo_candidate && archived;
          const isExpanded=expanded.includes(row.wp_post_id);
          return <li key={row.wp_post_id} className={"rounded-xl border p-4 " +
            (archived?"border-amber-500/35 bg-amber-500/5":"border-border bg-background")}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selected.includes(row.wp_post_id)} disabled={protectedArchive}
                aria-label={"Selecionar cadastro WordPress " + row.wp_post_id}
                onChange={(e)=>setSelected((prev)=>e.target.checked
                  ? [...prev,row.wp_post_id].slice(0,20) : prev.filter((id)=>id!==row.wp_post_id))}
                className="mt-1 h-5 w-5 shrink-0 accent-primary disabled:opacity-40" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <strong className="break-words text-foreground">{managed[row.wp_post_id]?.corrected_name || row.title}</strong>
                  <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs text-foreground">
                    {state==="excluido"?"Arquivado":state==="em_revisao"?"Em revisão":state==="pronto_para_validacao"?"Pronto para validação":"Pendente"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">WordPress #{row.wp_post_id} · usuário #{row.wp_user_id}</p>
                {row.specialty_title && <p className="mt-2 text-sm text-foreground">{row.specialty_title}</p>}
                {[row.location1,row.location2,row.location3].filter(Boolean).length > 0 &&
                  <p className="mt-1 text-sm text-muted-foreground">{[row.location1,row.location2,row.location3].filter(Boolean).join(" · ")}</p>}
                {row.demo_candidate && <p className="mt-2 text-xs font-bold text-destructive">Possível demonstração: pode arquivar, mas não restaurar, editar ou publicar.</p>}
                {managed[row.wp_post_id]?.admin_notes &&
                  <p className="mt-2 rounded-lg bg-muted p-2 text-xs text-foreground">Nota privada: {managed[row.wp_post_id]?.admin_notes}</p>}
              </div>
            </div>
            <button type="button" aria-expanded={isExpanded} aria-controls={`legacy-details-${kind}-${row.wp_post_id}`}
              onClick={() => setExpanded((current) => isExpanded
                ? current.filter((id) => id !== row.wp_post_id) : [...current, row.wp_post_id])}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              {isExpanded ? "Ocultar ficha" : "Ver ficha"} · {row.title}
              <ChevronDown className={"h-4 w-4 transition-transform " + (isExpanded ? "rotate-180" : "")} aria-hidden="true" />
            </button>
            <div id={`legacy-details-${kind}-${row.wp_post_id}`} hidden={!isExpanded}
              className="mt-2 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
              <dl className="grid gap-2 sm:grid-cols-2">
                <div><dt className="text-xs font-semibold text-muted-foreground">Nome original</dt><dd className="break-words">{row.title}</dd></div>
                <div><dt className="text-xs font-semibold text-muted-foreground">Identificador WordPress</dt><dd>#{row.wp_post_id}</dd></div>
                <div><dt className="text-xs font-semibold text-muted-foreground">Slug histórico</dt><dd className="break-all">{row.slug}</dd></div>
                <div><dt className="text-xs font-semibold text-muted-foreground">Revisão de origem</dt><dd>{row.review_status}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                {protectedArchive
                  ? "Esta possível demonstração já está arquivada. Não há edição, restauração ou exclusão permanente disponível."
                  : row.demo_candidate
                    ? "Esta possível demonstração só permite arquivamento auditado."
                    : "A edição altera apenas a revisão administrativa; não modifica o registro WordPress original."}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={row.demo_candidate} onClick={()=>chooseAction([row.wp_post_id],"corrigir_nome")}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-input px-3 text-xs font-semibold text-foreground"><Pencil className="h-4 w-4" /> Editar nome</button>
              <button type="button" disabled={row.demo_candidate} onClick={()=>chooseAction([row.wp_post_id],"anotar")}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-input px-3 text-xs font-semibold text-foreground">Anotar</button>
              {archived && protectedArchive ? <span className="inline-flex min-h-10 items-center rounded-lg border border-input px-3 text-xs text-muted-foreground">
                Arquivado · sem ações disponíveis
              </span> : archived ? <button type="button" disabled={row.demo_candidate}
                onClick={()=>chooseAction([row.wp_post_id],"restaurar")}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-input px-3 text-xs font-semibold text-foreground disabled:opacity-40"><RotateCcw className="h-4 w-4" /> Restaurar revisão</button> : <button type="button"
                onClick={()=>chooseAction([row.wp_post_id],"arquivar")}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-input px-3 text-xs font-semibold text-foreground"><Archive className="h-4 w-4" /> Arquivar</button>}
              {!archived && state!=="em_revisao" && <button type="button" disabled={row.demo_candidate} onClick={()=>chooseAction([row.wp_post_id],"revisar")}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-input px-3 text-xs font-semibold text-foreground">Revisar</button>}
            </div>
          </li>;
        })}
      </ul>
    </>}
    {!loading && !error && rows.length===0 && <p className="mt-5 text-sm text-muted-foreground">Nenhuma ficha corresponde à busca.</p>}
    <div className="mt-5 flex items-center justify-between gap-3">
      <button disabled={busy||loading||page===0} type="button" onClick={()=>{setPage((x)=>Math.max(0,x-1));setSelected([]);setExpanded([]);setAction(null);}}
        className="min-h-11 rounded-lg border border-input px-4 text-sm text-foreground disabled:opacity-40">Anterior</button>
      <span className="text-xs text-muted-foreground">Página {page+1} de {Math.max(1,Math.ceil(total/LEGACY_REVIEW_PAGE_SIZE))}</span>
      <button disabled={busy||loading||(page+1)*LEGACY_REVIEW_PAGE_SIZE>=total} type="button"
        onClick={()=>{setPage((x)=>x+1);setSelected([]);setExpanded([]);setAction(null);}}
        className="min-h-11 rounded-lg border border-input px-4 text-sm text-foreground disabled:opacity-40">Próxima</button>
    </div>
    <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
      "Arquivar" significa excluir da revisão ativa, não apagar dados do acervo. Para tornar um técnico
      do WordPress um profissional publicado, o titular ainda precisa confirmar a identidade e os serviços.
    </p>
  </section>;
}
