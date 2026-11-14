import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BadgeCheck, PanelsTopLeft } from "lucide-react";
import { HomePublicProof } from "@/components/home-public-proof";

/** Routes to existing audited editors; previews use the same public source as Home. */
export function AdminPublicExperience() {
  return <section id="admin-conteudo-publico" aria-label="Gestão de pop-ups e prova social" className="mt-7 rounded-2xl border border-border bg-muted/20 p-4 sm:p-6">
    <h2 className="flex items-center gap-2 text-lg font-bold"><PanelsTopLeft className="h-5 w-5 text-primary" /> Conteúdo público: pop-ups e prova social</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      Os controles abaixo reaproveitam os editores e permissões existentes. Nenhum perfil privado ou anúncio em rascunho é publicado por abrir esta tela.
    </p>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <article className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-bold">Pop-up de campanha aprovada</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          O anúncio do espaço <code>home.content_1</code> também pode aparecer como pop-up na Home,
          somente com consentimento de Publicidade. Criar, editar, aprovar e pausar continuam no formulário abaixo,
          com as exigências contratuais e auditoria existentes.
        </p>
        <a href="#admin-patrocinadores-formulario" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Gerenciar campanhas <ArrowUpRight className="h-4 w-4" />
        </a>
      </article>
      <article className="rounded-xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 font-bold"><BadgeCheck className="h-4 w-4 text-primary" /> Prova social de perfis reais</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          A Home mostra até três técnicos já publicados, sem avaliações ou números simulados.
          Corrija dados, visibilidade e status na gestão única de técnicos; a vitrine acompanha a fonte pública.
        </p>
        <Link to="/admin/$secao" params={{ secao: "tecnicos" }}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Gerenciar técnicos publicados <ArrowUpRight className="h-4 w-4" />
        </Link>
      </article>
    </div>
    <details className="mt-4 rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-bold">Prévia fiel da prova social pública</summary>
      <HomePublicProof />
    </details>
    <p className="mt-3 text-xs text-muted-foreground">O convite fixo da comunidade permanece editorial; ainda não existe um editor persistente específico para seu texto.</p>
  </section>;
}
