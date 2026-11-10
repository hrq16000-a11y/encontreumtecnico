import { Link } from "@tanstack/react-router";
import { ChevronDown, Home, MapPin, MapPinned } from "lucide-react";
import {
  CAPITAL_CITIES,
  PARTNER_CITIES_BY_STATE,
  PARTNER_CITY_COUNT,
  DISTINCT_COVERAGE_CITY_COUNT,
} from "@/lib/national-coverage";

const PARTNER_GROUPS = Object.entries(PARTNER_CITIES_BY_STATE)
  .sort(([ufA], [ufB]) => ufA.localeCompare(ufB));

function CitySearchLink({ cidade, uf }: { cidade: string; uf: string }) {
  return (
    <Link
      to="/tecnicos"
      search={{ especialidade: "Todas", cidade, regiao: "" }}
      title={"Buscar técnicos em " + cidade + " (" + uf + ")"}
      className="group inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span>{cidade}</span>
      <span className="text-xs text-muted-foreground">{uf}</span>
    </Link>
  );
}

export function NationalCoverage() {
  return (
    <div className="mt-10 rounded-3xl border border-border bg-muted/30 p-5 shadow-soft md:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            <Home className="h-4 w-4" aria-hidden /> Rede nacional de atendimento
          </span>
          <h3 id="cobertura-nacional" className="mt-3 text-2xl font-bold text-foreground md:text-3xl">
            Atendimento domiciliar nas capitais e em cidades de parceiros
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Consulte profissionais por localidade e especialidade. A disponibilidade de atendimento domiciliar
            depende dos técnicos cadastrados, dos serviços oferecidos e da confirmação direta com o profissional.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:gap-3 lg:min-w-[280px]">
          {[
            { number: CAPITAL_CITIES.length, label: "capitais para busca" },
            { number: PARTNER_CITY_COUNT, label: "cidades informadas" },
            { number: DISTINCT_COVERAGE_CITY_COUNT, label: "localidades distintas" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-card px-2 py-3">
              <div className="text-xl font-bold text-primary md:text-2xl">{item.number}</div>
              <div className="mt-1 text-[11px] leading-tight text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h4 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <MapPinned className="h-5 w-5 text-primary" aria-hidden /> Todas as 27 capitais
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione sua capital para pesquisar os profissionais cadastrados na região.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {CAPITAL_CITIES.map(({ uf, cidade }) => (
            <li key={uf}><CitySearchLink cidade={cidade} uf={uf} /></li>
          ))}
        </ul>
      </div>

      <div className="mt-9">
        <h4 className="text-lg font-bold text-foreground">Cidades informadas com parceiros</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Localidades fornecidas pela administração do portal, organizadas por estado. Abra uma UF e selecione a cidade para buscar.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PARTNER_GROUPS.map(([uf, cidades]) => (
            <details key={uf} className="group rounded-xl border border-border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm text-primary">{uf}</span>
                <span className="flex-1 text-sm">{cidades.length} {cidades.length === 1 ? "cidade" : "cidades"}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="flex flex-wrap gap-2 border-t border-border px-3 py-4">
                {cidades.map((cidade) => (
                  <li key={cidade}><CitySearchLink cidade={cidade} uf={uf} /></li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          A relação não significa técnico online, disponibilidade garantida ou certificação pelo portal.
          Confirme atendimento, deslocamento e condições diretamente com o prestador antes da contratação.
        </p>
      </div>
    </div>
  );
}
