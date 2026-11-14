import { useDeferredValue, useMemo, useState } from "react";
import { normalizeGuiafixSearch, readGuiafixStaging } from "@/lib/guiafix-staging-normalizer";

// Only previously captured, minimal, public-name snapshots. No contact methods.
// Future approved city snapshots are picked up automatically without UI edits.
const captures = import.meta.glob("../../data/external-staging/guiafix-*.capture.json", {
  eager: true, import: "default",
}) as Record<string, unknown>;
const rows = readGuiafixStaging(Object.values(captures));
const PAGE_SIZE = 25;

export function AdminGuiafixStaging() {
  const [term, setTerm] = useState("");
  const [locality, setLocality] = useState("");
  const [page, setPage] = useState(0);
  const query = useDeferredValue(normalizeGuiafixSearch(term));
  const cities = useMemo(() => [...new Set(rows.map(r=>`${r.city}/${r.uf}`))].sort(), []);
  const filtered = useMemo(() => rows.filter(row =>
    (!locality || `${row.city}/${row.uf}` === locality) &&
    (!query || normalizeGuiafixSearch(`${row.name} ${row.city} ${row.uf} ${row.category}`).includes(query))
  ), [locality, query]);
  const maxPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE)-1);
  const currentPage = Math.min(page, maxPage);
  return <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="Técnicos Guiafix em preparação">
    <h2 className="text-xl font-bold text-card-foreground">Técnicos do Guiafix — {rows.length} nomes recuperados</h2>
    <p className="mt-2 text-sm text-muted-foreground">
      Consulta administrativa dos nomes das três capturas anteriores. São referências de técnicos
      de informática encontradas no Guiafix, ainda sem cadastro ativo neste portal. Nenhum contato,
      aprovação, disponibilidade ou cidade de atendimento é presumido.
    </p>
    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
      <label className="grid gap-1 text-sm font-medium text-foreground">Buscar técnico por nome ou cidade
        <input value={term} maxLength={100} onChange={e=>{setTerm(e.target.value);setPage(0);}}
          placeholder="Digite o nome, cidade ou UF" className="min-h-11 rounded-lg border border-input bg-background px-3 text-foreground" />
      </label>
      <label className="grid gap-1 text-sm font-medium text-foreground">Localidade da fonte
        <select value={locality} onChange={e=>{setLocality(e.target.value);setPage(0);}}
          className="min-h-11 rounded-lg border border-input bg-background px-3 text-foreground">
          <option value="">Todas as localidades</option>
          {cities.map(city=><option key={city} value={city}>{city}</option>)}
        </select>
      </label>
    </div>
    <p role="status" className="mt-3 text-sm text-muted-foreground">{filtered.length} técnico(s) encontrado(s) · sem contato comercial habilitado</p>
    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE).map(row=><li key={row.key}
        className="rounded-lg border border-border bg-background p-3">
        <p className="break-words font-semibold text-foreground">{row.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{row.category} · Fonte: {row.city}/{row.uf}</p>
        <p className="mt-1 text-xs text-muted-foreground">Cadastro operacional ainda não habilitado</p>
      </li>)}
    </ul>
    {!filtered.length && <p className="mt-3 text-sm text-muted-foreground">Nenhum nome corresponde aos filtros.</p>}
    {filtered.length>PAGE_SIZE && <nav aria-label="Páginas dos técnicos Guiafix" className="mt-4 flex items-center justify-between gap-3">
      <button type="button" disabled={currentPage===0} onClick={()=>setPage(x=>Math.max(0,x-1))}
        className="min-h-11 rounded-lg border border-input px-4 text-sm disabled:opacity-40">Anterior</button>
      <span className="text-xs text-muted-foreground">Página {currentPage+1} de {maxPage+1}</span>
      <button type="button" disabled={currentPage>=maxPage} onClick={()=>setPage(x=>Math.min(maxPage,x+1))}
        className="min-h-11 rounded-lg border border-input px-4 text-sm disabled:opacity-40">Próximo</button>
    </nav>}
  </section>;
}
