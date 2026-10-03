/**
 * Normalizările comune filtrelor: aceeași funcție trebuie să producă aceeași
 * cheie în completarea automată, în admin și în ruta de catalog.
 */

/** Fără diacritice, litere mici, spații comprimate. */
export const fold = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

/**
 * Cheia de potrivire a unei valori: doar litere și cifre. „8 GB", „8GB" și
 * „8-gb" devin toate `8gb` — fișele scriu aceeași valoare în toate felurile.
 */
export const matchKey = (s: string): string => fold(s).replace(/[^a-z0-9]+/g, "")

/** Forma din URL: `8 GB` → `8-gb`, `Negru mat` → `negru-mat`. */
export const slugify = (s: string): string =>
  fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

/**
 * Parametrii pe care catalogul îi folosește deja; o cheie de filtru nu poate
 * fi niciunul, altfel `?page=2` ar deveni „filtrul page".
 */
export const RESERVED_KEYS = new Set([
  "region_id",
  "q",
  "category_id",
  "collection_id",
  "facet_parent_id",
  "category",
  "price",
  "sale",
  "tag",
  "sort",
  "sortBy",
  "page",
  "limit",
  "stock",
  "fields",
  "offset",
  "order",
])

/** Cheie validă de filtru: slug scurt, nerezervat. */
export const isValidKey = (key: string): boolean =>
  /^[a-z][a-z0-9-]{0,31}$/.test(key) && !RESERVED_KEYS.has(key)

/**
 * Afișarea unei valori nou create din fișă: unitățile de memorie capătă
 * spațiu și majuscule („8gb" → „8 GB"), restul primește doar prima literă mare.
 */
export const prettifyValue = (raw: string): string => {
  const s = raw.replace(/\s+/g, " ").trim()
  const mem = s.match(/^(\d+(?:[.,]\d+)?)\s*(kb|mb|gb|tb)$/i)
  if (mem) return `${mem[1].replace(",", ".")} ${mem[2].toUpperCase()}`
  // Majusculele puse de producător rămân („iPhone", „iOS", „HyperOS").
  if (/[A-Z]/.test(s)) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Valoarea numerică pentru sortarea chips-urilor: „512 GB" < „1 TB",
 * „6.1 inch" < „6.7 inch". `null` = nu e o valoare numerică.
 */
export const numericSortKey = (value: string): number | null => {
  const m = value.replace(",", ".").match(/^(\d+(?:\.\d+)?)\s*([a-z"”]*)/i)
  if (!m) return null
  const n = parseFloat(m[1])
  if (!Number.isFinite(n)) return null
  return /^tb$/i.test(m[2]) ? n * 1024 : /^mb$/i.test(m[2]) ? n / 1024 : n
}
