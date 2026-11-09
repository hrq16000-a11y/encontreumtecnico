import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "../components/page-placeholder";

const SERVICES = [
  { name: "Ar-condicionado", description: "Instalação, manutenção preventiva e corretiva." },
  { name: "Automação", description: "Automação residencial e comercial." },
  { name: "CFTV", description: "Câmeras de segurança e monitoramento." },
  { name: "Computador", description: "Formatação, upgrades e reparo de computadores." },
  { name: "Comunicações", description: "Redes, cabeamento e telefonia." },
  { name: "Elétrica", description: "Instalações e reparos elétricos." },
  { name: "Gráfica", description: "Equipamentos e serviços gráficos." },
  { name: "Impressora", description: "Manutenção e reparo de impressoras." },
];

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Encontre um Técnico" },
      { name: "description", content: "Especialidades e serviços oferecidos pelos técnicos da plataforma." },
      { property: "og:title", content: "Serviços — Encontre um Técnico" },
      { property: "og:description", content: "Especialidades e serviços oferecidos pelos técnicos da plataforma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Serviços</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Especialidades atendidas pelos técnicos da plataforma.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <li key={service.name} className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-semibold text-card-foreground">{service.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
              <Link
                to="/tecnicos"
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                Ver técnicos
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
