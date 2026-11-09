import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal-document";
import { legalDocuments } from "@/lib/legal-documents";
import { pageHead } from "@/components/text-page";

export const Route = createFileRoute("/cookies")({
  head: () => pageHead(legalDocuments.cookies.title, legalDocuments.cookies.description),
  component: () => <LegalDocument documentKey="cookies" />,
});
