import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/politica-de-privacidade")({
  beforeLoad: () => { throw redirect({ to: "/privacidade", statusCode: 301 }); },
});
