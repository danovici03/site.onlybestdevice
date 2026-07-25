/**
 * Cele 41 de județe + municipiul București, în ordinea oficială (INS), cu
 * diacritice. Se salvează numele complet în `province`: ajunge pe factură și
 * pe AWB, unde „BN" n-ar spune nimic clientului.
 *
 * Medusa nu livrează subdiviziuni administrative — `region.countries` are doar
 * țări — deci lista trăiește aici.
 */
export const RO_COUNTIES = [
  "Alba",
  "Arad",
  "Argeș",
  "Bacău",
  "Bihor",
  "Bistrița-Năsăud",
  "Botoșani",
  "Brașov",
  "Brăila",
  "București",
  "Buzău",
  "Caraș-Severin",
  "Călărași",
  "Cluj",
  "Constanța",
  "Covasna",
  "Dâmbovița",
  "Dolj",
  "Galați",
  "Giurgiu",
  "Gorj",
  "Harghita",
  "Hunedoara",
  "Ialomița",
  "Iași",
  "Ilfov",
  "Maramureș",
  "Mehedinți",
  "Mureș",
  "Neamț",
  "Olt",
  "Prahova",
  "Satu Mare",
  "Sălaj",
  "Sibiu",
  "Suceava",
  "Teleorman",
  "Timiș",
  "Tulcea",
  "Vaslui",
  "Vâlcea",
  "Vrancea",
] as const

/** Fără diacritice, litere mici, fără separatori — pentru comparații tolerante. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
}

const BY_NORMALIZED = new Map(RO_COUNTIES.map((c) => [normalize(c), c]))

/** Codurile auto, ca adresele salvate ca „BN" să se recunoască la editare. */
const BY_CODE: Record<string, string> = {
  ab: "Alba",
  ar: "Arad",
  ag: "Argeș",
  bc: "Bacău",
  bh: "Bihor",
  bn: "Bistrița-Năsăud",
  bt: "Botoșani",
  bv: "Brașov",
  br: "Brăila",
  b: "București",
  bz: "Buzău",
  cs: "Caraș-Severin",
  cl: "Călărași",
  cj: "Cluj",
  ct: "Constanța",
  cv: "Covasna",
  db: "Dâmbovița",
  dj: "Dolj",
  gl: "Galați",
  gr: "Giurgiu",
  gj: "Gorj",
  hr: "Harghita",
  hd: "Hunedoara",
  il: "Ialomița",
  is: "Iași",
  if: "Ilfov",
  mm: "Maramureș",
  mh: "Mehedinți",
  ms: "Mureș",
  nt: "Neamț",
  ot: "Olt",
  ph: "Prahova",
  sm: "Satu Mare",
  sj: "Sălaj",
  sb: "Sibiu",
  sv: "Suceava",
  tr: "Teleorman",
  tm: "Timiș",
  tl: "Tulcea",
  vs: "Vaslui",
  vl: "Vâlcea",
  vn: "Vrancea",
}

/**
 * Filtrare tolerantă pentru câmpul de căutare: „bistrita" găsește
 * „Bistrița-Năsăud", iar „severin" găsește „Caraș-Severin" (căutăm oriunde în
 * nume, nu doar la început, cum face type-ahead-ul nativ al unui <select>).
 */
export function filterCounties(query: string): readonly string[] {
  const q = normalize(query)
  if (!q) return RO_COUNTIES
  return RO_COUNTIES.filter((county) => normalize(county).includes(q))
}

/**
 * Aduce o valoare veche la numele canonic. Adresele salvate înainte de select
 * conțin orice: „Bistrita-Nasaud", „bistrița năsăud", „BN". Fără asta,
 * select-ul le-ar arăta ca necompletate și clientul ar rescrie degeaba.
 * Întoarce `null` dacă nu recunoaște nimic.
 */
export function matchCounty(value?: string | null): string | null {
  if (!value) return null

  const normalized = normalize(value)
  if (!normalized) return null

  return BY_NORMALIZED.get(normalized) ?? BY_CODE[normalized] ?? null
}
