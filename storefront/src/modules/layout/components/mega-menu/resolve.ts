import { listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { getProductPrice } from "@lib/util/get-product-price"

import {
  MEGA_MENU,
  MegaMenuProduct,
  ResolvedMegaRoot,
} from "./data"

const PRODUCTS_PER_CATEGORY = 4

// Enriches the curated mega-menu with real Medusa products for each category,
// matched by handle. Everything is defensive — any failure degrades to an
// empty product list so the nav never breaks a page render.
export async function resolveMegaMenu(
  countryCode: string
): Promise<ResolvedMegaRoot[]> {
  let handleToId = new Map<string, string>()
  try {
    const categories = await listCategories({ fields: "id,handle", limit: 200 })
    handleToId = new Map(
      categories.map((c) => [c.handle as string, c.id as string])
    )
  } catch {
    handleToId = new Map()
  }

  return Promise.all(
    MEGA_MENU.map(async (root) => {
      const items = await Promise.all(
        root.items.map(async (item) => {
          const handle = item.href.replace(/^\/categories\//, "")
          const categoryId = handleToId.get(handle)

          if (!categoryId) {
            return { ...item, count: 0, products: [] as MegaMenuProduct[] }
          }

          try {
            const {
              response: { products, count },
            } = await listProducts({
              countryCode,
              queryParams: {
                category_id: [categoryId],
                limit: PRODUCTS_PER_CATEGORY,
              },
            })

            const resolved: MegaMenuProduct[] = products.map((p) => {
              const { cheapestPrice } = getProductPrice({ product: p })
              return {
                title: p.title ?? "",
                handle: p.handle ?? "",
                thumbnail: p.thumbnail ?? null,
                price: cheapestPrice?.calculated_price ?? null,
              }
            })

            return { ...item, count, products: resolved }
          } catch {
            return { ...item, count: 0, products: [] as MegaMenuProduct[] }
          }
        })
      )

      return { ...root, items }
    })
  )
}
