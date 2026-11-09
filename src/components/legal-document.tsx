import { TextPage, TextSection } from "./text-page";
import { legalDocuments, LEGAL_UPDATED_AT, type LegalDocumentKey } from "@/lib/legal-documents";

const related = [
  { href: "/termos", label: "Termos de uso" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/cookies", label: "Cookies" },
  { href: "/pagamentos-e-reembolsos", label: "Pagamentos e reembolsos" },
  { href: "/condicoes-do-prestador", label: "Condições do prestador" },
  { href: "/responsabilidades", label: "Responsabilidades" },
  { href: "/seguranca", label: "Segurança" },
  { href: "/direitos-dos-titulares", label: "Direitos de dados" },
] as const;

export function LegalDocument({ documentKey }: { documentKey: LegalDocumentKey }) {
  const data = legalDocuments[documentKey];
  return (
    <TextPage title={data.title} intro={data.intro}>
      <p className="text-xs text-muted-foreground">Versão atualizada em {LEGAL_UPDATED_AT}.</p>
      <nav aria-label="Navegação de políticas" className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold text-card-foreground">Documentos do portal</p>
        <div className="flex flex-wrap gap-2">
          {related.map((item) => (
            <a key={item.href} href={item.href}
              aria-current={isCurrent(item.href, documentKey) ? "page" : undefined}
              className="inline-flex min-h-9 items-center rounded-full border border-border px-3 py-1 text-xs text-foreground hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary/10">
              {item.label}
            </a>
          ))}
        </div>
      </nav>
      {data.sections.map((section) => (
        <TextSection key={section.title} title={section.title}>
          {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </TextSection>
      ))}
      <p className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        Para dúvidas, correções cadastrais, reclamações sobre o serviço digital ou solicitações de privacidade, use a{" "}
        <a href="/contato" className="font-medium text-primary underline">página Contato</a>.
        Regras de consumo e de proteção de dados aplicáveis prevalecem sobre cláusulas incompatíveis.
      </p>
      <p className="text-xs text-muted-foreground">
        <a href="/politicas" className="font-medium text-primary underline">Ver central de políticas e transparência</a>
      </p>
    </TextPage>
  );
}

function isCurrent(path: string, key: LegalDocumentKey): boolean {
  const paths: Record<LegalDocumentKey, string> = {
    termos: "/termos",
    privacidade: "/privacidade",
    cookies: "/cookies",
    pagamentos: "/pagamentos-e-reembolsos",
    prestadores: "/condicoes-do-prestador",
    responsabilidades: "/responsabilidades",
    seguranca: "/seguranca",
    direitos: "/direitos-dos-titulares",
  };
  return paths[key] === path;
}
