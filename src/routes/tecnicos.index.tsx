import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, EmptyState } from "../components/page-placeholder";
import { normalizeTechnicianSearch } from "../lib/technician-search";

export const Route = createFileRoute("/tecnicos/")({
  validateSearch: normalizeTechnicianSearch,
  head: () => ({
    meta: [
      { title: "Técnicos — Encontre um Técnico" },
      { name: "description", content: "Galeria de técnicos aprovados. Filtre por especialidade, cidade e região." },
      { property: "og:title", content: "Técnicos — Encontre um Técnico" },
      { property: "og:description", content: "Galeria de técnicos aprovados. Filtre por especialidade, cidade e região." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechniciansPage,
});

function TechniciansPage() {
  const { especialidade, cidade } = Route.useSearch();
  const [specialty, setSpecialty] = useState(especialidade);
  const [city, setCity] = useState(cidade);
  const [region, setRegion] = useState("");

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Técnicos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apenas perfis aprovados pela plataforma aparecem nesta listagem.
        </p>

        <div className="mt-6 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
          <div>
            <label htmlFor="filtro-especialidade" className="text-xs font-medium text-muted-foreground">
              Especialidade
            </label>
            <input
              id="filtro-especialidade"
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Ex.: Computador, CFTV"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="filtro-cidade" className="text-xs font-medium text-muted-foreground">
              Cidade
            </label>
            <input
              id="filtro-cidade"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex.: São Paulo"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label htmlFor="filtro-regiao" className="text-xs font-medium text-muted-foreground">
              Região
            </label>
            <input
              id="filtro-regiao"
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Ex.: Zona Sul"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="mt-6">
          <EmptyState
            title="Nenhum técnico cadastrado ainda"
            description="A listagem pública será preenchida automaticamente quando os primeiros perfis forem aprovados pela administração."
          />
        </div>
      </section>
    </PageShell>
  );
}
