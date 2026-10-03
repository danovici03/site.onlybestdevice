import REDIRECTS from "@lib/data/brand-category-redirects.json"

/**
 * Subcategoriile-marcă desființate („Apple" sub Tablete) → categoria-părinte
 * filtrată pe marcă: `/categories/tablete/apple` → `/categories/tablete?brand=apple`.
 *
 * Sursa e `brand-category-redirects.json`, generat de scriptul backend
 * `cleanup-brand-categories.ts` (care scrie aceeași hartă și în
 * `backend/src/scripts/data/`). Nu se editează de mână: se rulează scriptul
 * local (DRY_RUN ajunge) și se comit ambele copii.
 *
 * Categoriile care apar după generare cad pe regula generică din pagina de
 * categorie (`brandCategoryFallback` din `lib/data/categories`).
 */

type Entry = {
  parentHandle: string | null
  parentPath: string | null
  path: string
  brandSlug: string | null
}

const byHandle = REDIRECTS as Record<string, Entry>
const byPath = new Map(Object.values(byHandle).map((e) => [e.path, e]))

/** Toate mărcile cunoscute din hartă — pentru regula generică. */
export const KNOWN_BRAND_SLUGS = new Set(
  Object.values(byHandle)
    .map((e) => e.brandSlug)
    .filter((s): s is string => !!s)
)

/**
 * Destinația (relativă la regiune, fără query) și marca pentru segmentele de
 * URL ale unei categorii desființate; `null` dacă nu e una dintre ele.
 *
 * Se potrivesc calea canonică veche (`tablete/apple`) și handle-ul (`apple-tablete`),
 * singur sau sub părintele lui (`tablete/apple-tablete`). Un handle sub alt
 * părinte nu se potrivește: `apple` e și handle-ul Telefoane › Apple, și
 * slug-ul Laptop › Apple.
 */
export function brandCategoryRedirect(
  segments: string[]
): { path: string; brand: string | null } | null {
  const segs = segments.map((s) => s.toLowerCase()).filter(Boolean)
  if (!segs.length) return null

  let entry = byPath.get(segs.join("/"))

  // O subcategorie aflată sub una desființată a urcat un nivel la curățenie
  // (`telefoane-mobile/apple/iphone-16` → `telefoane-mobile/iphone-16`). Ea e
  // încă o categorie, deci merge la noua ei cale, fără filtru de marcă.
  if (!entry) {
    for (let i = segs.length - 1; i >= 1; i--) {
      const retired = byPath.get(segs.slice(0, i).join("/"))
      if (!retired) continue
      const rest = segs.slice(i)
      const base = retired.parentPath ? retired.parentPath.split("/") : []
      return { path: `/categories/${[...base, ...rest].join("/")}`, brand: null }
    }
  }

  if (!entry) {
    const leaf = byHandle[segs[segs.length - 1]]
    const parent = segs.slice(0, -1).join("/")
    if (leaf && (segs.length === 1 || leaf.parentPath === parent)) entry = leaf
  }
  if (!entry) return null

  return {
    path: entry.parentPath ? `/categories/${entry.parentPath}` : "/store",
    brand: entry.brandSlug,
  }
}

/** Query-ul vechi, plus `brand` (fără dublură dacă era deja cerut). */
export function withBrandParam(
  search: URLSearchParams,
  brand: string | null
): string {
  const qs = new URLSearchParams(search)
  if (brand && !qs.getAll("brand").some((b) => b.toLowerCase() === brand)) {
    qs.append("brand", brand)
  }
  const s = qs.toString()
  return s ? `?${s}` : ""
}
