import { Link } from "@tanstack/react-router";

export const REGIONAL_RECRUITMENT_UFS = ["PR","SC","RS","SP","RJ"] as const;

/** Recrutamento comunicado em 20/11/2026. Não equivale a solicitações registradas,
 * profissionais disponíveis ou métricas verificadas. Não criar landing pages a partir desta lista.
 * IBGE: o texto original "Cachoeirinhas/TO" foi normalizado para "Cachoeirinha/TO". */
export const RECRUITMENT_CITY_GROUPS = [
  { uf: "AL", cities: ["Arapiraca","Campo Grande","Jundiá"] },
  { uf: "AM", cities: ["Barreirinha","Benjamin Constant","Careiro","Manaus"] },
  { uf: "AP", cities: ["Macapá"] },
  { uf: "BA", cities: ["Alagoinhas","Ilhéus"] },
  { uf: "CE", cities: ["Cascavel","Barreira","Campos Sales","Iracema","Viçosa do Ceará"] },
  { uf: "ES", cities: ["Vitória","Vila Velha","Águia Branca","Anchieta","Boa Esperança","Cariacica","Ibitirama","Itapemirim","Presidente Kennedy","Serra"] },
  { uf: "GO", cities: ["Itumbiara","Caldas Novas","Divinópolis de Goiás","Goiânia","Valparaíso de Goiás"] },
  { uf: "MA", cities: ["Jatobá","Montes Altos","Vargem Grande"] },
  { uf: "MG", cities: ["Belo Horizonte","Betim","Campo Belo","Diamantina","Governador Valadares","Juiz de Fora","Montes Claros","Teófilo Otoni","Ubá"] },
  { uf: "MS", cities: ["Campo Grande","Dourados"] },
  { uf: "MT", cities: ["Rio Branco","Sinop"] },
  { uf: "PB", cities: ["Alagoinha","Bayeux"] },
  { uf: "PE", cities: ["Barreiros","Caruaru","Jaboatão dos Guararapes"] },
  { uf: "PI", cities: ["Teresina","Parnaíba","Parnaguá"] },
  { uf: "RN", cities: ["Mossoró","Viçosa"] },
  { uf: "RO", cities: ["Vilhena"] },
  { uf: "SE", cities: ["Aracaju","Laranjeiras","Pinhão","Salgado"] },
  { uf: "TO", cities: ["Cachoeirinha","Monte do Carmo","Taguatinga","Palmas"] },
] as const;

export const RECRUITMENT_CITY_COUNT = RECRUITMENT_CITY_GROUPS.reduce(
  (count, group) => count + group.cities.length, 0,
);

/** Entrada útil para buscar técnicos e captar novos cadastros, sem falsear cobertura. */
export function RecruitmentCoverageCallout() {
  return (
    <section id="expansao-da-rede" aria-labelledby="expansao-rede-titulo"
      className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Expansão da rede · chamada de recrutamento</p>
      <h2 id="expansao-rede-titulo" className="mt-2 text-2xl font-extrabold text-foreground">
        Procuramos técnicos em novas localidades
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-foreground">
        Estamos ampliando o cadastro de profissionais em toda a Região Sul (PR, SC e RS),
        nos estados de São Paulo e Rio de Janeiro e nas cidades citadas em uma chamada de recrutamento.
        Se você presta serviços técnicos, cadastre suas especialidades e sua cidade-base.
      </p>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        Esta é uma lista de localidades para recrutamento, não um número de pedidos recebidos
        nem uma afirmação de que já existam profissionais disponíveis em cada cidade.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/cadastro"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90">
          Sou técnico: cadastrar meu perfil
        </Link>
        <Link to="/servicos"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-primary/30 bg-background px-5 py-3 text-sm font-semibold text-primary hover:bg-accent">
          Consultar serviços
        </Link>
      </div>
      <details className="group mt-7 rounded-xl border border-border bg-card">
        <summary className="cursor-pointer px-4 py-4 text-sm font-bold text-foreground marker:text-primary sm:px-5">
          Consultar 65 cidades citadas em 18 UFs
        </summary>
        <p className="px-4 pb-3 text-xs leading-6 text-muted-foreground sm:px-5">
          Escolha uma cidade para abrir a busca de técnicos. Caso não encontre um perfil,
          você pode informar sua necessidade pelo fluxo de atendimento do portal.
        </p>
        <div className="grid gap-5 border-t border-border p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          {RECRUITMENT_CITY_GROUPS.map((group) => (
            <section key={group.uf} aria-label={`Localidades citadas em ${group.uf}`}>
              <h3 className="font-bold text-foreground">{group.uf}</h3>
              <ul className="mt-2 space-y-1">
                {group.cities.map((city) => (
                  <li key={city}>
                    <Link to="/tecnicos"
                      search={{ especialidade: "Todas", cidade: city, regiao: "", uf: group.uf }}
                      className="inline-flex min-h-10 items-center py-1 text-sm text-primary underline-offset-2 hover:underline">
                      Consultar {city}/{group.uf}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </details>
    </section>
  );
}
