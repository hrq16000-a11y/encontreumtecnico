import { createFileRoute, redirect } from "@tanstack/react-router";

/** O cadastro unificado no portal novo começa pelo login Google/Supabase. */
export const Route = createFileRoute("/cadastro")({
  beforeLoad: () => {
    throw redirect({ to: "/entrar", statusCode: 302 });
  },
});
