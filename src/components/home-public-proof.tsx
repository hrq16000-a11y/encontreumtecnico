import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { TechnicianAvatar } from "@/components/technician-avatar";
import { listApprovedTechnicians } from "@/lib/technicians.functions";

/**
 * Factual social proof: exclusively publicly approved profiles from the same
 * server-side source as /tecnicos. No testimonials, fake ratings or static
 * counts. Delayed until visible so Home's hero doesn't wait on the directory.
 */
export function HomePublicProof() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const element = sectionRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { data, isError, isFetching } = useQuery({
    queryKey: ["eut", "home", "public-profiles"],
    queryFn: () => listApprovedTechnicians({
      data: { especialidade: "Todas", cidade: "", regiao: "", servico: "", uf: "", bairro: "", prioridade: "" },
    }),
    enabled: visible,
    staleTime: 300_000,
    retry: 1,
  });
  const profiles = (data ?? []).filter((t) =>
    Boolean(t.public_slug && t.display_name && t.city)).slice(0, 3);

  return (
    <section ref={sectionRef} id="perfis-reais" aria-labelledby="perfis-reais-titulo"
      className="bg-muted/30 px-4 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
              <UsersRound className="h-4 w-4" aria-hidden="true" /> Transparência que você pode conferir
            </p>
            <h2 id="perfis-reais-titulo" className="mt-3 text-2xl font-extrabold text-foreground sm:text-3xl">
              Conheça técnicos com perfis públicos reais
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Veja alguns cadastros publicados no diretório. As especialidades e cidades são informadas pelos próprios profissionais.
            </p>
          </div>
          <Link to="/tecnicos" search={{ especialidade: "Todas", cidade: "", regiao: "" }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/25 bg-card px-4 py-2 text-sm font-semibold text-primary transition-colors hover:border-primary">
            Explorar o diretório <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        {profiles.length > 0 ? (
          <ul className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Exemplos de perfis públicos">
            {profiles.map((tech) => (
              <li key={tech.id}>
                <Link to="/tecnicos/$tecnicoId" params={{ tecnicoId: tech.public_slug }}
                  aria-label={"Ver perfil público de " + tech.display_name}
                  className="group flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-primary">
                  <TechnicianAvatar name={tech.display_name} avatarPath={tech.avatar_path}
                    className="h-14 w-14 shrink-0 rounded-xl" />
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Perfil publicado
                    </span>
                    <h3 className="mt-1 break-words text-base font-bold text-foreground">{tech.display_name}</h3>
                    <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {tech.city}{tech.state_uf ? "/" + tech.state_uf : ""}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-primary group-hover:underline">
                      Conhecer serviços e região <ArrowUpRight className="inline h-3.5 w-3.5" aria-hidden="true" />
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : isFetching && visible ? (
          <p role="status" className="mt-8 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Consultando os perfis públicos disponíveis…
          </p>
        ) : isError ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Não foi possível carregar os exemplos agora. Consulte o diretório para pesquisar técnicos.
          </p>
        ) : visible ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Novos perfis serão exibidos aqui à medida que forem publicados.
          </p>
        ) : null}
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          A publicação de um perfil não representa certificação técnica, avaliação de clientes ou garantia de disponibilidade.
          Nenhum telefone privado é exibido nesta seção.
        </p>
      </div>
    </section>
  );
}
