import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal-document";
import { legalDocuments } from "@/lib/legal-documents";
import { pageHead } from "@/components/text-page";

export const Route = createFileRoute("/privacidade")({
  head: () => pageHead(legalDocuments.privacidade.title, legalDocuments.privacidade.description),
  component: () => <LegalDocument documentKey="privacidade" />,
});
