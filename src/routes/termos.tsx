import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal-document";
import { legalDocuments } from "@/lib/legal-documents";
import { pageHead } from "@/components/text-page";

export const Route = createFileRoute("/termos")({
  head: () => pageHead(legalDocuments.termos.title, legalDocuments.termos.description, "/termos"),
  component: () => <LegalDocument documentKey="termos" />,
});
