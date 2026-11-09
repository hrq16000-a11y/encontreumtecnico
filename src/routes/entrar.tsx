import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "../components/page-placeholder";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Encontre um Técnico" },
      { name: "description", content: "Acesse sua conta de técnico ou cliente com login Google." },
      { property: "og:title", content: "Entrar — Encontre um Técnico" },
      { property: "og:description", content: "Acesse sua conta de técnico ou cliente com login Google." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  return (
    <PageShell>
      <section className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Entre na sua conta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O acesso de técnicos e clientes será feito exclusivamente com login Google.
        </p>
        <button
          type="button"
          disabled
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground opacity-60"
        >
          Entrar com Google
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          A autenticação será ativada na próxima rodada de desenvolvimento.
        </p>
      </section>
    </PageShell>
  );
}
