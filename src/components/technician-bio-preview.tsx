import { parseProfessionalBio } from "@/lib/technician-profile-enrichment";
import { publicTextProblem } from "@/lib/public-profile-text";

/** Mirrors the public bio structure while the owner edits a private draft.
 * No persistence, public profile fetch or contact information is involved. */
export function TechnicianBioPreview({ bio }: { bio: string }) {
  const unsafe = publicTextProblem(bio, "bio") !== null;
  const preview = unsafe ? { introduction: "", sections: [] } : parseProfessionalBio(bio);
  const hasContent = Boolean(preview.introduction || preview.sections.length);

  return (
    <section aria-labelledby="eut-bio-preview-title" className="mt-4 rounded-2xl border border-border bg-muted/25 p-4">
      <h3 id="eut-bio-preview-title" className="text-sm font-bold text-foreground">Prévia da apresentação no perfil público</h3>
      <p className="mt-1 text-xs text-muted-foreground">Visualização local do rascunho, ainda não publicada. Títulos vazios não aparecem para o cliente.</p>
      {unsafe ? (
        <p role="status" className="mt-3 text-sm text-destructive">Corrija o texto sinalizado acima para visualizar a versão pública segura.</p>
      ) : hasContent ? (
        <div className="mt-3 space-y-3">
          {preview.introduction && (
            <p className="whitespace-pre-line break-words text-sm leading-6 text-foreground">{preview.introduction}</p>
          )}
          {preview.sections.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {preview.sections.map((section) => (
                <div key={section.id} className="min-w-0 rounded-xl border border-border bg-card p-3">
                  <h4 className="text-sm font-semibold text-foreground">{section.label}</h4>
                  <p className="mt-1 whitespace-pre-line break-words text-sm text-foreground">{section.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Escreva sobre seu trabalho ou complete um dos tópicos acima para visualizar sua apresentação.</p>
      )}
    </section>
  );
}
