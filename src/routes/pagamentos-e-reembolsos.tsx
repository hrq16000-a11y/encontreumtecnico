import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal-document";
import { legalDocuments } from "@/lib/legal-documents";
import { pageHead } from "@/components/text-page";

export const Route = createFileRoute("/pagamentos-e-reembolsos")({
  head: () => pageHead(legalDocuments.pagamentos.title, legalDocuments.pagamentos.description, "/pagamentos-e-reembolsos"),
  component: () => <LegalDocument documentKey="pagamentos" />,
});
