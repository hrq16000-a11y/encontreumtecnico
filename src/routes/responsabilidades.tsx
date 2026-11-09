import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal-document";
import { legalDocuments } from "@/lib/legal-documents";
import { pageHead } from "@/components/text-page";

export const Route = createFileRoute("/responsabilidades")({
  head: () => pageHead(legalDocuments.responsabilidades.title, legalDocuments.responsabilidades.description),
  component: () => <LegalDocument documentKey="responsabilidades" />,
});
