import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "../components/page-placeholder";
import { ProblemAssistant } from "../components/problem-assistant";
import { CATEGORIES } from "../lib/categories";
import { FindOneSection, JoinNetworkSection, CtaBand, ValuesSection, StepsSection } from "../components/home-sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Encontre um Técnico — Encontre profissionais de TI perto de você" },
      {
        name: "description",
        content:
          "Busque técnicos aprovados por especialidade, cidade e região. A melhor maneira de encontrar e contratar profissionais de tecnologia no Brasil.",
      },
      { property: "og:title", content: "Encontre um Técnico — Encontre profissionais de TI perto de você" },
      {
        property: "og:description",
        content: "Busque técnicos aprovados por especialidade, cidade e região.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");

  return (
    <PageShell>
      <section className="bg-primary/5 px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            A melhor maneira de encontrar um técnico
          </h1>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Precisou? Encontrou! Busque profissionais aprovados por especialidade, cidade e região.
          </p>

          <form
            className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              window.__lovableEvents?.track?.("project.technician_search", {
                has_specialty: specialty.trim() !== "",
                has_city: city.trim() !== "",
              });
              navigate({
                to: "/tecnicos",
                search: { especialidade: specialty.trim() || "Todas", cidade: city.trim(), regiao: "" },
              });
            }}
          >
            <label className="sr-only" htmlFor="busca-especialidade">Especialidade</label>
            <input
              id="busca-especialidade"
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Especialidade (ex.: Computador)"
              className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <label className="sr-only" htmlFor="busca-cidade">Cidade</label>
            <input
              id="busca-cidade"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Cidade ou região"
              className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="h-11 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Buscar
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl font-semibold text-foreground">Categorias de atividades populares</h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((category) => (
            <li key={category}>
              <Link
                to="/tecnicos"
                search={{ especialidade: category, cidade: "", regiao: "" }}
                onClick={() => window.__lovableEvents?.track?.("project.category_selected", { category })}
                className="block rounded-lg border border-border bg-card px-4 py-5 text-center text-sm font-medium text-card-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {category}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-12">
        <ProblemAssistant />
      </section>

      <FindOneSection />
      <JoinNetworkSection />
      <CtaBand />
      <ValuesSection />
      <StepsSection />

      <section className="border-t border-border bg-muted/40 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-xl font-semibold text-foreground">Como funciona</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              { step: "1", title: "Busque", text: "Pesquise por especialidade, cidade ou região." },
              { step: "2", title: "Escolha", text: "Compare perfis de técnicos aprovados pela plataforma." },
              { step: "3", title: "Solicite", text: "Abra uma solicitação de atendimento com segurança." },
            ].map((item) => (
              <li key={item.step} className="rounded-lg border border-border bg-card p-6">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {item.step}
                </span>
                <h3 className="mt-3 font-semibold text-card-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold text-card-foreground">Sou Cliente</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastre-se e abra solicitações de atendimento com técnicos aprovados.
            </p>
            <Link
              to="/entrar"
              className="mt-4 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Criar conta de cliente
            </Link>
          </div>
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold text-card-foreground">Sou Técnico</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Faça parte da rede de técnicos de TI do Brasil e seja encontrado por novos clientes.
            </p>
            <Link
              to="/entrar"
              className="mt-4 inline-block rounded-md border border-primary px-6 py-2.5 text-sm font-medium text-primary hover:bg-primary/5"
            >
              Criar conta de técnico
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
