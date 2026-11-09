import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/termos-de-uso")({
  beforeLoad: () => { throw redirect({ to: "/termos", statusCode: 301 }); },
});
