import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal-document";
import { legalDocuments } from "@/lib/legal-documents";
import { pageHead } from "@/components/text-page";

export const Route = createFileRoute("/seguranca")({
  head: () => pageHead(legalDocuments.seguranca.title, legalDocuments.seguranca.description),
  component: () => <LegalDocument documentKey="seguranca" />,
});
