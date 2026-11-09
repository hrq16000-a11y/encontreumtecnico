import { createFileRoute, redirect } from "@tanstack/react-router";

// Old WordPress URL kept working: sends visitors to the approved-technicians list.
export const Route = createFileRoute("/lista-de-tecnicos")({
  beforeLoad: () => {
    throw redirect({ to: "/tecnicos", search: { especialidade: "Todas", cidade: "", regiao: "" }, statusCode: 301 });
  },
});
