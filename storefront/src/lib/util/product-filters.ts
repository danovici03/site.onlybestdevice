/**
 * Tipurile și traducerea URL ↔ selecție pentru filtrele de catalog.
 *
 * Filtrarea propriu-zisă și numărarea fațetelor NU se fac aici: le face ruta
 * `/store/catalog` din backend, în SQL (vezi
 * `backend/src/api/store/catalog/route.ts`). Fișierul ăsta a rămas cu ce ține
 * strict de storefront — cum arată selecția în URL și cum se citește înapoi.
 *
 * Filtrele de atribut (marcă, RAM, diagonală, culoare…) sunt dinamice: le
 * definește adminul pe categorii (modulul `product_filter` din backend), iar
 * parametrul din URL e cheia filtrului (`?ram=8-gb`, `?diagonala=6-6.7`).
 * Storefront-ul nu știe dinainte ce chei există — trimite backendului orice
 * parametru nerezervat, iar backendul întoarce în `facets.attributes` doar
 * filtrele care se aplică, cu selecția recunoscută (`selected`).
 */

export type PriceRange = { min: number | null; max: number | null }

export type SelectedFilters = {
  /** Numele categoriilor bifate în fațeta „Categorie". */
  category: string[]
  /**
   * Parametrii filtrelor de atribut, exact cum sunt în URL: slug-uri de
   * valoare pentru filtrele select, „min-max" pentru cele numerice.
   */
  attrs: Record<string, string[]>
  price: PriceRange
  /** Doar produsele în stoc. */
  stock: boolean
}

export const emptySelectedFilters = (): SelectedFilters => ({
  category: [],
  attrs: {},
  price: { min: null, max: null },
  stock: false,
})

export type FacetValue = {
  value: string
  count: number
  /** Forma din URL; lipsește la categorii (acolo e numele). */
  slug?: string
  hex?: string | null
}

export type AttributeFacet = {
  key: string
  label: string
  type: "select" | "number"
  display: "chips" | "swatch"
  unit: string | null
  /** Doar la `select`. */
  values?: FacetValue[]
  /** Doar la `number`: intervalul valorilor din rezultatele curente. */
  range?: { min: number; max: number } | null
  /** Slug-urile bifate (`select`) sau intervalul cerut (`number`). */
  selected: string[] | PriceRange | null
}

export type Facets = {
  category: FacetValue[]
  priceRange: { min: number; max: number } | null
  stock: { count: number }
  attributes: AttributeFacet[]
}

export const emptyFacets = (): Facets => ({
  category: [],
  priceRange: null,
  stock: { count: 0 },
  attributes: [],
})

/**
 * Parametrii care NU sunt filtre de atribut: ai paginii, ai fațetelor fixe și
 * cei de tracking (altfel un `?utm_source=` ar fragmenta cache-ul catalogului).
 * Trebuie să includă `RESERVED_KEYS` din backend (`lib/product-filters/normalize.ts`).
 */
const RESERVED = new Set([
  "page",
  "sortBy",
  "sort",
  "q",
  "price",
  "category",
  "stock",
  "limit",
  "region_id",
  "category_id",
  "collection_id",
  "facet_parent_id",
  "sale",
  "tag",
  "fields",
  "offset",
  "order",
  "gclid",
  "fbclid",
  "msclkid",
  "ref",
])
const isReserved = (k: string) => RESERVED.has(k) || k.startsWith("utm_")

/** Aceeași formă ca cheile de filtru din backend (`isValidKey`). */
const looksLikeFilterKey = (k: string) => /^[a-z][a-z0-9-]{0,31}$/.test(k)

const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const valuesOf = (v: string | string[] | undefined): string[] =>
  (Array.isArray(v) ? v : v == null ? [] : [v]).map((s) => s.trim()).filter(Boolean)

/**
 * Citește selecția din query string (parametru repetat per valoare; preț „min-max").
 *
 * Valorile NU se separă prin virgulă: numele de categorii o conțin („Console,
 * Jocuri", „Tv, Audio-Video si Foto"), iar split-ul le rupea în bucăți care nu
 * corespundeau niciunei categorii — selectarea lor golea catalogul. Fiecare
 * valoare are propria apariție în URL (`?category=A&category=B`).
 */
export function parseSelectedFilters(
  sp: Record<string, string | string[] | undefined>
): SelectedFilters {
  const priceRaw = Array.isArray(sp.price) ? sp.price[0] : sp.price
  const [pMin, pMax] = (priceRaw ?? "").split("-")
  const stockRaw = Array.isArray(sp.stock) ? sp.stock[0] : sp.stock

  const attrs: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(sp)) {
    if (isReserved(key) || !looksLikeFilterKey(key)) continue
    const values = valuesOf(value)
    if (values.length) attrs[key] = values
  }

  return {
    category: valuesOf(sp.category),
    attrs,
    price: { min: num(pMin), max: num(pMax) },
    stock: stockRaw === "1" || stockRaw === "true",
  }
}

/** Serializează un interval pentru URL („min-max", capete opționale). */
export const serializePrice = (p: PriceRange): string | null =>
  p.min == null && p.max == null ? null : `${p.min ?? ""}-${p.max ?? ""}`

export const countActiveFilters = (s: SelectedFilters): number =>
  s.category.length +
  Object.values(s.attrs).reduce((n, v) => n + v.length, 0) +
  (s.price.min != null || s.price.max != null ? 1 : 0) +
  (s.stock ? 1 : 0)

export const hasAnyFacet = (f: Facets): boolean =>
  f.category.length > 0 ||
  f.attributes.length > 0 ||
  f.priceRange != null ||
  f.stock.count > 0
