/**
 * Tipurile și traducerea URL ↔ selecție pentru filtrele de catalog.
 *
 * Filtrarea propriu-zisă și numărarea fațetelor NU se mai fac aici: le face
 * ruta `/store/catalog` din backend, în SQL (vezi
 * `backend/src/api/store/catalog/route.ts`). Fișierul ăsta a rămas cu ce ține
 * strict de storefront — ce chei există, cum arată în URL și cum se citesc
 * înapoi.
 *
 * Fațetele de marcă/stocare/RAM/culoare vin din `product.metadata`
 * (`filter_*`), scrise de scriptul backend `extract-product-filters.ts`.
 */

export type FilterKey = "category" | "brand" | "storage" | "ram" | "color"

export const FILTER_KEYS: FilterKey[] = [
  "category",
  "brand",
  "storage",
  "ram",
  "color",
]

export const FILTER_LABELS: Record<FilterKey, string> = {
  category: "Categorie",
  brand: "Marcă",
  storage: "Stocare",
  ram: "Memorie RAM",
  color: "Culoare",
}

export type PriceRange = { min: number | null; max: number | null }

export type SelectedFilters = Record<FilterKey, string[]> & {
  price: PriceRange
}

export const emptySelectedFilters = (): SelectedFilters => ({
  category: [],
  brand: [],
  storage: [],
  ram: [],
  color: [],
  price: { min: null, max: null },
})

export type FacetValue = { value: string; count: number; hex?: string | null }
export type Facets = Record<FilterKey, FacetValue[]> & {
  priceRange: { min: number; max: number } | null
}

export const emptyFacets = (): Facets => ({
  category: [],
  brand: [],
  storage: [],
  ram: [],
  color: [],
  priceRange: null,
})

const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Citește selecția din query string (valori separate prin virgulă; preț „min-max"). */
export function parseSelectedFilters(
  sp: Record<string, string | string[] | undefined>
): SelectedFilters {
  const get = (k: FilterKey): string[] => {
    const v = sp[k]
    const raw = Array.isArray(v) ? v.join(",") : v ?? ""
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  const priceRaw = Array.isArray(sp.price) ? sp.price[0] : sp.price
  const [pMin, pMax] = (priceRaw ?? "").split("-")
  return {
    category: get("category"),
    brand: get("brand"),
    storage: get("storage"),
    ram: get("ram"),
    color: get("color"),
    price: { min: num(pMin), max: num(pMax) },
  }
}

/** Serializează intervalul de preț pentru URL („min-max", capete opționale). */
export const serializePrice = (p: PriceRange): string | null =>
  p.min == null && p.max == null ? null : `${p.min ?? ""}-${p.max ?? ""}`

export const countActiveFilters = (s: SelectedFilters): number =>
  FILTER_KEYS.reduce((n, k) => n + s[k].length, 0) +
  (s.price.min != null || s.price.max != null ? 1 : 0)

export const hasAnyFacet = (f: Facets): boolean =>
  FILTER_KEYS.some((k) => f[k].length > 0) || f.priceRange != null
