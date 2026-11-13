/**
 * Public presentation hint for WordPress-era aliases.
 *
 * It NEVER changes the stored identity or claims to verify a person's name.
 * Only fully recognized Portuguese name tokens are split; uncertain aliases
 * stay exactly as imported. Historical digits are removed only on a complete,
 * high-confidence segmentation.
 */
const givenNames = new Set([
  "adailton", "alex", "alexandre", "alvaro", "andre", "anderson",
  "antonio", "bruno", "carlos", "daniel", "davi", "diego", "edson",
  "eduardo", "elias", "fabio", "felipe", "fernando", "flavio",
  "francisco", "gabriel", "gustavo", "joao", "jose", "julio",
  "leandro", "lucas", "luiz", "marcelo", "marcio", "marcos",
  "mateus", "matheus", "miguel", "paulo", "pedro", "rafael",
  "renato", "ricardo", "roberto", "rodrigo", "samuel", "sergio",
  "thiago", "tiago", "vitor", "william",
]);

const familyNames = new Set([
  "almeida", "alves", "aquino", "araujo", "barbosa", "batista",
  "carvalho", "correia", "costa", "dias", "ferreira", "goncalves",
  "jesus", "lima", "martins", "morais", "moreira", "nascimento",
  "oliveira", "paixao", "pereira", "pinheiro", "ribeiro", "rocha",
  "santos", "silva", "souza",
]);
const joiners = new Set(["de", "da", "do", "das", "dos"]);
const vocabulary = [...new Set([...givenNames, ...familyNames, ...joiners])]
  .sort((a, b) => b.length - a.length);

export type LegacyNameSuggestion = {
  display: string;
  original: string;
  suggested: boolean;
};

function capitalize(token: string, index: number): string {
  if (index > 0 && joiners.has(token)) return token;
  return token.charAt(0).toLocaleUpperCase("pt-BR") + token.slice(1);
}

function splitRecognizedAlias(value: string): string[] | null {
  const memo = new Map<number, string[] | null>();
  const split = (index: number): string[] | null => {
    if (index === value.length) return [];
    if (memo.has(index)) return memo.get(index) ?? null;
    let best: string[] | null = null;
    for (const word of vocabulary) {
      if (!value.startsWith(word, index)) continue;
      const suffix = split(index + word.length);
      if (suffix === null) continue;
      const candidate = [word, ...suffix];
      if (best === null || candidate.length < best.length) best = candidate;
    }
    memo.set(index, best);
    return best;
  };
  return split(0);
}

export function suggestLegacyDisplayName(value: string): LegacyNameSuggestion {
  const original = value.trim();
  const fallback = { display: original, original, suggested: false };
  if (!original) return fallback;

  // Already declared words need only presentation capitalization.
  if (/\s/u.test(original)) {
    const display = original.replace(/\s+/gu, " ").split(" ")
      .map((word, index) => capitalize(word.toLocaleLowerCase("pt-BR"), index))
      .join(" ");
    return { display, original, suggested: false };
  }

  const alias = original.toLocaleLowerCase("pt-BR").replace(/\d{1,4}$/u, "");
  if (!/^[a-z]{6,60}$/u.test(alias)) return fallback;
  const tokens = splitRecognizedAlias(alias);
  if (!tokens || tokens.length < 2 ||
      !tokens.some((token) => givenNames.has(token)) ||
      !tokens.some((token) => familyNames.has(token))) return fallback;
  return {
    display: tokens.map(capitalize).join(" "),
    original,
    suggested: true,
  };
}
