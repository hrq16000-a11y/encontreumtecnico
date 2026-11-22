import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Phone, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;
const client = z.object({
  id: z.string().uuid(),
  display_name: z.string().min(3),
  phone_e164: z.string().regex(/^\+55[1-9]{2}[2-9][0-9]{7,8}$/),
  ddd: z.string().regex(/^[1-9][0-9]$/),
  region_approx: z.string(),
  declared_uf: z.string().nullable(),
  admin_active: z.boolean(),
  blocked_on_import: z.boolean(),
  linked_auth_user_id: z.string().uuid().nullable(),
  created_at: z.string(),
});
const response = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  page_size: z.literal(20),
  clients: z.array(client).max(20),
});
type ImportedClientsSnapshot = z.infer<typeof response>;

/** Rendered only inside the admin workspace. RPC separately verifies admin+confirmed
 * identity and account operational status, and audits each full number returned.
 * Never prefetch in SSR, persist phone data or use service role in a browser. */
export function AdminImportedClients() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<ImportedClientsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const { data, error: rpcError } = await db.rpc("eut_admin_imported_clients", {
          _search: search, _page: page,
        });
        if (rpcError) throw rpcError;
        const parsed = response.safeParse(data);
        if (!parsed.success || parsed.data.page !== page)
          throw new Error("Resposta administrativa inválida");
        if (active) setSnapshot(parsed.data);
      } catch {
        if (active) setError("Consulta indisponível. Confirme a sessão administrativa e a instalação da função no banco.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [page, search, version]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(0);
    setSearch(draft.trim().slice(0, 80));
  }

  const pages = snapshot ? Math.max(1, Math.ceil(snapshot.total / snapshot.page_size)) : 1;
  return <section id="admin-clientes-unificados" aria-label="Clientes da base unificada"
    className="mt-6 min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <UsersRound aria-hidden="true" className="h-5 w-5" /> Clientes da base unificada
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Clientes ativos desde a importação, mesmo sem login vinculado.
          Telefone completo disponível exclusivamente nesta consulta administrativa auditada.
        </p>
      </div>
      <button type="button" className="min-h-11 rounded-lg border border-input px-4 text-sm"
        onClick={() => setVersion((value) => value + 1)}>Atualizar</button>
    </div>
    <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-2">
      <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold text-foreground">
        Buscar nome, telefone, DDD ou região
        <input type="search" maxLength={80} value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
          placeholder="Nome, DDD ou telefone" />
      </label>
      <button type="submit" className="min-h-11 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground">
        Buscar
      </button>
    </form>
    {loading && <p role="status" className="text-sm text-muted-foreground">Consultando clientes…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {snapshot && <>
      <p role="status" className="text-sm text-muted-foreground">
        {snapshot.total.toLocaleString("pt-BR")} cliente(s) nesta consulta · página {page + 1} de {pages}
      </p>
      {snapshot.clients.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}
      <ul className="grid gap-2">
        {snapshot.clients.map((item) => <li key={item.id}
          className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div className="min-w-0">
            <p className="break-words font-semibold text-foreground">{item.display_name}</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              DDD {item.ddd} · {item.region_approx}{item.declared_uf ? " · " + item.declared_uf : ""}
              {item.linked_auth_user_id ? " · conta vinculada" : " · login ainda não vinculado"}
            </p>
            <p className="mt-2 flex items-center gap-2 break-all text-sm font-medium text-foreground">
              <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{item.phone_e164}</span>
            </p>
          </div>
          <span className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground">
            {item.blocked_on_import ? "Bloqueado" : item.admin_active ? "Ativo" : "Desabilitado"}
          </span>
        </li>)}
      </ul>
      <nav aria-label="Paginação dos clientes da base unificada" className="flex flex-wrap justify-between gap-3">
        <button type="button" disabled={loading || page === 0}
          onClick={() => setPage((value) => Math.max(0, value - 1))}
          className="min-h-11 rounded-lg border border-input px-4 text-sm disabled:opacity-40">
          Anterior
        </button>
        <button type="button" disabled={loading || page + 1 >= pages}
          onClick={() => setPage((value) => value + 1)}
          className="min-h-11 rounded-lg border border-input px-4 text-sm disabled:opacity-40">
          Próximo
        </button>
      </nav>
    </>}
  </section>;
}
