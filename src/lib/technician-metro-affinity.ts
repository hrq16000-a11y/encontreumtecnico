/**
 * Conservative same-metro relevance, adapted from the municipality membership
 * approach in hrq16000-a11y/precisodeum_old/src/lib/metroRegions.ts.
 *
 * City names are municipal references, never an address, verified travel
 * distance or proof that a technician serves the visitor's municipality.
 * Restrict matches to one UF; exclude cross-border metropolitan assumptions.
 * This is ONLY a tie-break between profiles already ranked as same-state.
 */
const METRO_CORES: Readonly<Record<string, readonly (readonly string[])[]>> = {
  PR: [["curitiba", "saojosedospinhais", "pinhais", "colombo", "araucaria", "piraquara", "fazendariogrande", "almirantetamandare", "campolargo", "quatrobarras"]],
  SP: [
    ["saopaulo", "guarulhos", "osasco", "santoandre", "saobernardodocampo", "saocaetanodosul", "diadema", "maua", "barueri", "carapicuiba", "cotia", "suzano", "taboaodaserra", "itaquaquecetuba"],
    ["campinas", "hortolandia", "sumare", "americana", "valinhos", "vinhedo", "paulinia", "indaiatuba", "jaguariuna"],
    ["santos", "saovicente", "guaruja", "praiagrande", "cubatao"],
  ],
  RJ: [["riodejaneiro", "niteroi", "saogoncalo", "duquedecaxias", "novaiguacu", "belfordroxo", "saojoaodemeriti", "mesquita", "nilopolis", "queimados", "mage"]],
  MG: [["belohorizonte", "contagem", "betim", "ribeiraodasneves", "santaluzia", "ibirite", "sabara", "vespasiano", "novalima", "lagoasanta"]],
  RS: [["portoalegre", "canoas", "gravatai", "viamao", "novohamburgo", "saoleopoldo", "alvorada", "cachoeirinha", "esteio", "sapucaiadosul", "guaiba"]],
  SC: [["florianopolis", "saojose", "palhoca", "biguacu", "governadorcelsoramos", "santoamarodaimperatriz"]],
  PE: [["recife", "olinda", "jaboataodosguararapes", "paulista", "camaragibe", "cabodeagostinho", "abreuelima", "igarassu"]],
  CE: [["fortaleza", "caucaia", "maracanau", "maranguape", "pacatuba", "eusebio", "aquiraz", "itaitinga"]],
  BA: [["salvador", "camacari", "laurodefreitas", "simoesfilho", "candeias", "diasdavila"]],
  GO: [["goiania", "aparecidadegoiania", "trindade", "senadorcanedo", "goianira", "neropolis"]],
  ES: [["vitoria", "vilavelha", "serra", "cariacica", "viana", "guarapari"]],
  PA: [["belem", "ananindeua", "marituba", "benevides"]],
  RN: [["natal", "parnamirim", "saogoncalodoamarante", "macaiba", "extremoz"]],
  PB: [["joaopessoa", "santarita", "bayeux", "cabedelo"]],
  MA: [["saoluis", "saojosederibamar", "pacodolumiar", "raposa"]],
  AL: [["maceio", "riolargo", "marechaldeodoro", "satuba"]],
  MT: [["cuiaba", "varzeagrande", "nossasenhoradolivramento"]],
  MS: [["campogrande", "terenos", "sidrolandia"]],
  AM: [["manaus", "iranduba", "riopretodaeva"]],
};

function municipalityKey(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Never classifies another city as confirmed service coverage. */
export function hasSameMetropolitanCore(input: {
  queryUf: string; queryCity: string; technicianUf: string | null; technicianCity: string;
}): boolean {
  const uf = input.queryUf.trim().toUpperCase();
  if (!uf || uf !== (input.technicianUf ?? "").trim().toUpperCase()) return false;
  const query = municipalityKey(input.queryCity);
  const technician = municipalityKey(input.technicianCity);
  if (!query || !technician || query === technician) return false;
  return (METRO_CORES[uf] ?? []).some(group => group.includes(query) && group.includes(technician));
}
