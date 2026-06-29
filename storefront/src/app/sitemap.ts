import { MetadataRoute } from "next"
import { listProducts } from "@lib/data/products"
import { listCategories } from "@lib/data/categories"

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
    for (const c of cats) {
      if (c.handle)
        entries.push({
          url: `${BASE}/${REGION}/categories/${c.handle}`,
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
