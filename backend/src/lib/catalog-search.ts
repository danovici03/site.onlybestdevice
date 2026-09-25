/**
 * Căutarea în catalog, comună magazinului (`/store/catalog`) și paginii
 * „Filtrare produse" din admin (`/admin/product-filters/explore`).
 */

/**
 * Cuvintele căutării. Se caută pe cuvinte, nu pe șirul întreg: „iphone negru"
 * trebuie să găsească „Apple iPhone 15 · Midnight negru", unde cele două
 * cuvinte nu sunt lipite. Maxim 6 — restul nu mai schimbă rezultatul, dar ar
 * adăuga clauze SQL la nesfârșit.
 */
export const searchTerms = (raw?: string): string[] => {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return []

  const tokens = trimmed
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 6)

  // O căutare din cuvinte de o literă („s") n-ar lăsa niciun token, iar zero
  // clauze înseamnă „fără filtru" — adică tot catalogul, sub titlul „Rezultate
  // pentru «s»". Căutăm atunci șirul ca atare: puține rezultate e un răspuns
  // corect, tot catalogul nu e.
  return tokens.length ? tokens : [trimmed]
}

/** `%`, `_` și `\` sunt metacaractere în ILIKE — le neutralizăm. */
export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, "\\$&")

/**
 * Catalogul are titluri și cu, și fără diacritice — importurile din WooCommerce
 * au venit în ambele feluri („Husa de protectie" lângă „Husă"). Fără
 * normalizare, „husă" găsea 2 produse și „husa" alte 7, iar clientul nu are cum
 * să ghicească ce variantă a scris operatorul.
 *
 * Aceeași hartă se aplică termenului (în JS) și coloanelor (prin TRANSLATE, în
 * SQL) — de aceea e o listă explicită și nu o normalizare NFD: NFD ar acoperi
 * în JS litere pe care TRANSLATE nu le-ar acoperi în SQL, iar cele două părți
 * ar înceta să se potrivească.
 */
const DIACRITICS = {
  ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
  á: "a", à: "a", ä: "a", é: "e", è: "e", ë: "e", í: "i", ì: "i", ï: "i",
  ó: "o", ò: "o", ö: "o", ú: "u", ù: "u", ü: "u", ç: "c", ñ: "n",
} as const

const DIACRITICS_FROM = Object.keys(DIACRITICS).join("")
const DIACRITICS_TO = Object.values(DIACRITICS).join("")

/** Varianta fără diacritice, cu litere mici — pentru termenul căutat. */
export const foldTerm = (s: string): string =>
  s.toLowerCase().replace(/./gu, (c) => (DIACRITICS as Record<string, string>)[c] ?? c)

/** Aceeași normalizare, dar pentru o expresie SQL. */
export const foldSql = (expr: string): string =>
  `TRANSLATE(LOWER(${expr}), '${DIACRITICS_FROM}', '${DIACRITICS_TO}')`
