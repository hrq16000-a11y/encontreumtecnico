import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal-document";
import { legalDocuments } from "@/lib/legal-documents";
import { pageHead } from "@/components/text-page";

export const Route = createFileRoute("/direitos-dos-titulares")({
  head: () => pageHead(legalDocuments.direitos.title, legalDocuments.direitos.description, "/direitos-dos-titulares"),
  component: () => <LegalDocument documentKey="direitos" />,
});
