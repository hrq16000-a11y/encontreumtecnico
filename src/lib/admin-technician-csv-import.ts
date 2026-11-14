import { normalizeBrazilPhoneE164 } from "@/lib/admin-technician-crud-intent";
import { publicTextProblem } from "@/lib/public-profile-text";

export type TechnicianImportRow = {
  sourceId: string;
  displayName: string;
  ddd: string | null;
  regionApprox: string | null;
  cityIbgeId: number | null;
  categorySlugs: string[];
  phoneE164: string | null;
};

const MAX_IMPORT_ROWS = 500;

/** All parser errors contain fixed text/line numbers, never the underlying cell values. */
export function csvImportErrorText(error: unknown): string {
  return error instanceof Error && /^(Linha [0-9]+:|CSV |O CSV |Importe no máximo |Aspas )/.test(error.message)
    ? error.message
    : "CSV inválido. Confira o arquivo e tente novamente.";
}

function tokenizeCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (quoted || !cell.trim()) quoted = !quoted;
      else throw new Error("Aspas inválidas no CSV.");
    } else if (!quoted && ch === delimiter) {
      current.push(cell.trim()); cell = "";
    } else if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      current.push(cell.trim()); cell = "";
      if (current.some(Boolean)) rows.push(current);
      current = [];
    } else cell += ch;
  }
  if (quoted) throw new Error("CSV com aspas sem fechamento.");
  current.push(cell.trim());
  if (current.some(Boolean)) rows.push(current);
  return rows;
}

function stableFileKey(text: string): string {
  let first = 2166136261;
  let second = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    first = Math.imul(first ^ text.charCodeAt(i), 16777619) >>> 0;
    second = Math.imul(second ^ (text.charCodeAt(i) + i), 16777619) >>> 0;
  }
  return [first, second].map((part) => part.toString(16).padStart(8, "0")).join("-");
}

function cleanHeader(header: string): string {
  return header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Parses a bounded local file; private phones are held in memory, never printed or previewed. */
export function prepareTechnicianCsv(text: string, activeCategories: readonly { slug: string; label: string }[]): TechnicianImportRow[] {
  if (text.length > 2_000_000) throw new Error("CSV acima de 2 MB. Divida em arquivos menores.");
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", ",", "\t"].sort((a, b) =>
    firstLine.split(b).length - firstLine.split(a).length)[0] ?? ";";
  const rows = tokenizeCsv(text.replace(/^\uFEFF/, ""), delimiter);
  const headers = (rows.shift() ?? []).map(cleanHeader);
  const indexes = (names: string[]) => headers.findIndex((name) => names.includes(name));
  const nameIndex = indexes(["nome", "name", "nome_profissional"]);
  if (nameIndex < 0) throw new Error("O CSV precisa da coluna nome (ou name).");
  if (!rows.length) throw new Error("CSV sem técnicos para importar.");
  if (rows.length > MAX_IMPORT_ROWS) throw new Error("Importe no máximo 500 técnicos por arquivo.");
  const lookup = (row: string[], names: string[]) => {
    const index = indexes(names);
    return index >= 0 ? (row[index] ?? "").trim() : "";
  };
  const categoryLookup = new Map(activeCategories.flatMap((category) => [
    [cleanHeader(category.slug), category.slug],
    [cleanHeader(category.label), category.slug],
  ]));
  const fingerprint = stableFileKey(text);
  return rows.map((row, index) => {
    if (row.length !== headers.length) throw new Error(`Linha ${index + 2}: quantidade de colunas diferente do cabeçalho.`);
    const displayName = row[nameIndex]?.trim().replace(/\s+/g, " ") ?? "";
    if (displayName.length < 3 || displayName.length > 120 || publicTextProblem(displayName, "identity"))
      throw new Error(`Linha ${index + 2}: nome profissional inválido.`);
    const regionApprox = lookup(row, ["regiao", "regiao_aproximada", "cidade", "municipio"]) || null;
    if (regionApprox && (regionApprox.length > 120 || publicTextProblem(regionApprox, "identity")))
      throw new Error(`Linha ${index + 2}: região inválida.`);
    const phone = lookup(row, ["telefone", "celular", "phone"]);
    const phoneE164 = phone ? normalizeBrazilPhoneE164(phone) : null;
    if (phone && !phoneE164) throw new Error(`Linha ${index + 2}: telefone inválido.`);
    const ddd = lookup(row, ["ddd"]) || (phoneE164 ? phoneE164.slice(3, 5) : null);
    if (ddd && !/^[1-9][0-9]$/.test(ddd)) throw new Error(`Linha ${index + 2}: DDD inválido.`);
    const ibge = lookup(row, ["ibge", "cidade_ibge_id", "municipio_ibge"]);
    if (ibge && !/^[0-9]{7}$/.test(ibge)) throw new Error(`Linha ${index + 2}: IBGE inválido.`);
    const categoryNames = lookup(row, ["categoria", "categorias", "category", "category_slug"])
      .split("|").map((value) => value.trim()).filter(Boolean);
    const categorySlugs = categoryNames.map((value) => {
      const slug = categoryLookup.get(cleanHeader(value));
      if (!slug) throw new Error(`Linha ${index + 2}: categoria não encontrada no catálogo ativo.`);
      return slug;
    });
    return {
      sourceId: `other_import:${fingerprint}:${(index + 1).toString(36)}`,
      displayName,
      ddd,
      regionApprox,
      cityIbgeId: ibge ? Number(ibge) : null,
      categorySlugs: [...new Set(categorySlugs)],
      phoneE164,
    };
  });
}
