import { MetadataRoute } from "next"
import { listProducts } from "@lib/data/products"
import { listCategories } from "@lib/data/categories"
import { categorySlug } from "@lib/util/category-slug"

const BASE = (
  process.env.NEXT_PUBLIC_BASE_URL || "https://onlybestdevice.ro"
).replace(/\/$/, "")
const REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "ro"

const STATIC_PATHS = [
  "",
  "/store",
  "/livrare",
  "/retur",
  "/garantie",
  "/service",
  "/contact",
  "/suport",
  "/faq",
  "/termeni",
  "/confidentialitate",
  "/informatii-legale",
  "/cookie",
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
    url: `${BASE}/${REGION}${p}`,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.6,
  }))

  try {
    const cats = await listCategories()
    // Calea canonică, nu handle-ul: `apple-tablete` redirectează 308 către
    // `tablete/apple`, iar un sitemap plin de redirecturi irosește crawl budget.
    const byId = new Map(cats.map((c) => [c.id, c]))
    for (const c of cats) {
      const path: string[] = []
      const seen = new Set<string>()
      let cur: (typeof cats)[number] | undefined = c
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id)
        path.unshift(categorySlug(cur.name ?? ""))
        cur = cur.parent_category?.id
          ? byId.get(cur.parent_category.id)
          : undefined
      }
      if (path.length && path.every(Boolean))
        entries.push({
          url: `${BASE}/${REGION}/categories/${path.join("/")}`,
          changeFrequency: "weekly",
          priority: 0.7,
        })
    }
  } catch {
    // ignoră dacă backend-ul nu e disponibil la build
  }

  try {
    const limit = 100
    let offset = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { response } = await listProducts({
        countryCode: REGION,
        queryParams: { limit, offset, fields: "handle" } as any,
      })
      for (const pr of response.products) {
        if (pr.handle)
          entries.push({
            url: `${BASE}/${REGION}/products/${pr.handle}`,
            changeFrequency: "weekly",
            priority: 0.8,
          })
      }
      offset += limit
      if (!response.products.length || offset >= (response.count ?? 0)) break
    }
  } catch {
    // ignoră dacă backend-ul nu e disponibil la build
  }

  return entries
}
