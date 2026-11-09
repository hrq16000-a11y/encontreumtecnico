import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/politica-de-cookies")({
  beforeLoad: () => { throw redirect({ to: "/cookies", statusCode: 301 }); },
});
