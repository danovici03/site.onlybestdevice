import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"

/**
 * Filtrare produse după specificațiile scrise de scriptul backend
 * `extract-product-filters.ts` în `product.metadata` (filter_brand /
 * filter_storage / filter_ram / filter_color / filter_color_hex), plus filtru
 * de preț calculat din variante.
 *
 * Filtrarea se face pe server, peste setul deja încărcat pentru categorie
 * (vezi paginated-products), iar selecția trăiește în query string-ul URL.
 */

export type FilterKey = "brand" | "storage" | "ram" | "color"

export const FILTER_KEYS: FilterKey[] = ["brand", "storage", "ram", "color"]

export const FILTER_LABELS: Record<FilterKey, string> = {
  brand: "Marcă",
  storage: "Stocare",
  ram: "Memorie RAM",
  color: "Culoare",
}

const META_KEY: Record<FilterKey, string> = {
  brand: "filter_brand",
  storage: "filter_storage",
  ram: "filter_ram",
  color: "filter_color",
}

export type PriceRange = { min: number | null; max: number | null }

export type SelectedFilters = Record<FilterKey, string[]> & {
  price: PriceRange
}

export const emptySelectedFilters = (): SelectedFilters => ({
  brand: [],
  storage: [],
  ram: [],
  color: [],
  price: { min: null, max: null },
})

const metaOf = (p: HttpTypes.StoreProduct) =>
  (p.metadata ?? {}) as Record<string, unknown>

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v : null

export const readFilterValue = (
  product: HttpTypes.StoreProduct,
  key: FilterKey
): string | null => str(metaOf(product)[META_KEY[key]])

const readColorHex = (product: HttpTypes.StoreProduct): string | null =>
  str(metaOf(product).filter_color_hex)

/** Prețul (calculat) al produsului, ca număr; null dacă lipsește. */
export function productPrice(product: HttpTypes.StoreProduct): number | null {
  const { cheapestPrice } = getProductPrice({ product })
  const n = cheapestPrice?.calculated_price_number
  return typeof n === "number" && n > 0 ? n : null
}

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

export type FacetValue = { value: string; count: number; hex?: string | null }
export type Facets = Record<FilterKey, FacetValue[]> & {
  priceRange: { min: number; max: number } | null
}

const storageGb = (label: string): number => {
  const n = parseFloat(label)
  if (!Number.isFinite(n)) return 0
  return /tb/i.test(label) ? n * 1024 : n
}

/** Fațetele disponibile (valori + nr. produse) calculate din setul categoriei. */
export function computeFacets(products: HttpTypes.StoreProduct[]): Facets {
  const brand = new Map<string, number>()
  const storage = new Map<string, number>()
  const ram = new Map<string, number>()
  const color = new Map<string, { label: string; hex: string | null; count: number }>()
  let priceMin = Infinity
  let priceMax = -Infinity

  for (const p of products) {
    const b = readFilterValue(p, "brand")
    if (b) brand.set(b, (brand.get(b) ?? 0) + 1)
    const s = readFilterValue(p, "storage")
    if (s) storage.set(s, (storage.get(s) ?? 0) + 1)
    const r = readFilterValue(p, "ram")
    if (r) ram.set(r, (ram.get(r) ?? 0) + 1)
    const c = readFilterValue(p, "color")
    if (c) {
      const key = c.toLowerCase()
      const e = color.get(key) ?? { label: c, hex: readColorHex(p), count: 0 }
      e.count++
      if (!e.hex) e.hex = readColorHex(p)
      color.set(key, e)
    }
    const price = productPrice(p)
    if (price != null) {
      priceMin = Math.min(priceMin, price)
      priceMax = Math.max(priceMax, price)
    }
  }

  const arr = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([value, count]) => ({ value, count }))

  return {
    brand: arr(brand).sort(
      (a, b) => b.count - a.count || a.value.localeCompare(b.value)
    ),
    storage: arr(storage).sort(
      (a, b) => storageGb(a.value) - storageGb(b.value)
    ),
    ram: arr(ram).sort((a, b) => parseFloat(a.value) - parseFloat(b.value)),
    color: Array.from(color.values())
      .map((e) => ({ value: e.label, hex: e.hex, count: e.count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    priceRange:
      Number.isFinite(priceMin) && priceMax > priceMin
        ? { min: Math.floor(priceMin), max: Math.ceil(priceMax) }
        : null,
  }
}

export const hasAnyFacet = (f: Facets): boolean =>
  FILTER_KEYS.some((k) => f[k].length > 0) || f.priceRange != null

/** Aplică selecția (AND între fațete, OR în interiorul unei fațete). */
export function applyFilters(
  products: HttpTypes.StoreProduct[],
  s: SelectedFilters
): HttpTypes.StoreProduct[] {
  return products.filter((p) => {
    if (s.brand.length && !s.brand.includes(readFilterValue(p, "brand") ?? ""))
      return false
    if (
      s.storage.length &&
      !s.storage.includes(readFilterValue(p, "storage") ?? "")
    )
      return false
    if (s.ram.length && !s.ram.includes(readFilterValue(p, "ram") ?? ""))
      return false
    if (s.color.length) {
      const c = (readFilterValue(p, "color") ?? "").toLowerCase()
      if (!s.color.some((x) => x.toLowerCase() === c)) return false
    }
    if (s.price.min != null || s.price.max != null) {
      const price = productPrice(p)
      if (price == null) return false
      if (s.price.min != null && price < s.price.min) return false
      if (s.price.max != null && price > s.price.max) return false
    }
    return true
  })
}
