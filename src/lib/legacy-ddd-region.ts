/**
 * Sanitized legacy WXR/SQL audit snapshot (13 Nov 2026).
 * Only a public legacy post ID and its single unambiguous two-digit DDD.
 * A unique number in the backup does not verify its owner's residence,
 * service area, or present telephone number. No contacts are stored here.
 * Records with missing or conflicting complete numbers were excluded.
 */
const legacyDDD: Readonly<Record<number, string>> = {
  427: "55",
  530: "82",
  602: "89",
  661: "16",
  678: "11",
  3042: "49",
  3045: "11",
  3048: "87",
  3053: "31",
  3058: "91",
  3061: "47",
  3064: "91",
  3069: "11",
  3105: "34",
  3210: "21",
  3274: "47",
  3341: "11",
  3365: "61",
  3369: "34",
  3372: "11",
  3375: "11",
  3398: "11",
  3452: "98",
  3468: "81",
  4123: "19",
  4172: "81",
  4299: "11",
  4308: "51",
  4311: "73",
  4318: "67",
  4326: "11",
  4330: "11",
  4333: "86",
  4336: "66",
  4340: "27",
  4343: "41",
  4346: "61",
  4349: "67",
  4357: "12",
  4360: "85",
  4363: "11",
  4372: "94",
  4375: "85",
  4381: "11",
  4384: "71",
  4388: "21",
  4392: "11",
  4399: "21",
  4402: "91",
  4415: "41",
};

// Brazil's national area codes by UF; DDD does not establish municipality.
const ufByDDD: Readonly<Record<string, string>> = {
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP", "16": "SP", "17": "SP", "18": "SP", "19": "SP",
  "21": "RJ", "22": "RJ", "24": "RJ", "27": "ES", "28": "ES",
  "31": "MG", "32": "MG", "33": "MG", "34": "MG", "35": "MG", "37": "MG", "38": "MG",
  "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
  "47": "SC", "48": "SC", "49": "SC",
  "51": "RS", "53": "RS", "54": "RS", "55": "RS",
  "61": "DF", "62": "GO", "64": "GO", "63": "TO", "65": "MT", "66": "MT", "67": "MS", "68": "AC", "69": "RO",
  "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA", "79": "SE",
  "81": "PE", "87": "PE", "82": "AL", "83": "PB", "84": "RN", "85": "CE", "88": "CE", "86": "PI", "89": "PI",
  "91": "PA", "93": "PA", "94": "PA", "92": "AM", "97": "AM", "95": "RR", "96": "AP", "98": "MA", "99": "MA",
};

/** The DDD is a regional clue, never a verified service city. */
export function getApproximateDDDRegion(ddd: string): string | null {
  if (!/^[1-9][0-9]$/.test(ddd)) return null;
  if (ddd === "41") return "Curitiba e região (DDD 41)";
  if (ddd === "11") return "São Paulo e região (DDD 11)";
  const uf = ufByDDD[ddd];
  return uf ? `Região do DDD ${ddd} · ${uf}` : null;
}

/** Null means the private backup has no unique usable DDD for this ID. */
export function getLegacyApproximateRegion(wpPostId: number): string | null {
  const ddd = legacyDDD[wpPostId];
  return ddd ? getApproximateDDDRegion(ddd) : null;
}
