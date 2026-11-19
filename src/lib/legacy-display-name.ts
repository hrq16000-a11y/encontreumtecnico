/**
 * Public presentation hint for WordPress-era aliases.
 *
 * It NEVER changes the stored identity or claims to verify a person's name.
 * Only fully recognized name tokens, familiar trade names and short suffixes
 * are split. Uncertain aliases stay exactly as imported. The source identity
 * is never changed or treated as verified.
 */
const givenNames = new Set([
  "adailton", "alex", "alexandre", "allan", "alvaro", "andre", "anderson",
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
const tradeSuffixes = new Map([
  ["informatica", "Informática"],
  ["mastercore", "Mastercore"],
  ["tecnologia", "Tecnologia"],
]);

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
  // Historical usernames may separate recognized names with _, - or .; do
  // not treat arbitrary punctuation, emails or unrecognized parts as identity.
  if (alias.length < 6 || alias.length > 60 ||
      !/^[a-z]+(?:[_.-][a-z]+)*$/u.test(alias)) return fallback;

  // Presentation hints for a recognizable name or short business acronym.
  if (/^[a-z]+$/u.test(alias)) {
    for (const [suffix, label] of tradeSuffixes) {
      if (!alias.endsWith(suffix)) continue;
      const prefix = alias.slice(0, -suffix.length);
      if (givenNames.has(prefix)) {
        return { display: `${capitalize(prefix, 0)} ${label}`, original, suggested: true };
      }
      if (/^[a-z]{2,5}$/u.test(prefix)) {
        return { display: `${prefix.toUpperCase()} ${label}`, original, suggested: true };
      }
    }

    const initials = alias.slice(-2);
    const recognized = splitRecognizedAlias(alias.slice(0, -2));
    if (recognized && recognized.length >= 2 &&
        recognized.some((token) => givenNames.has(token)) &&
        recognized.some((token) => familyNames.has(token))) {
      return {
        display: `${recognized.map(capitalize).join(" ")} ${initials.toUpperCase()}`,
        original,
        suggested: true,
      };
    }
  }
  const tokens: string[] = [];
  for (const part of alias.split(/[_.-]/u)) {
    const recognized = splitRecognizedAlias(part);
    if (!recognized) return fallback;
    tokens.push(...recognized);
  }
  if (tokens.length < 2 ||
      !tokens.some((token) => givenNames.has(token)) ||
      !tokens.some((token) => familyNames.has(token))) return fallback;
  return {
    display: tokens.map(capitalize).join(" "),
    original,
    suggested: true,
  };
}
