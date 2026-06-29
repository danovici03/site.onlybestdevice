import { listBestSellers } from "@lib/data/best-sellers"
import { listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"

import BestSellersTabs from "./best-sellers-tabs"

type BestSellersProps = {
  countryCode: string
  categoryHandles?: string[]
  limitPerTab?: number
}

const BestSellers = async ({
  countryCode,
  categoryHandles,
  limitPerTab = 8,
}: BestSellersProps) => {
  const region = await getRegion(countryCode)
  if (!region) return null

  const allCategories = await listCategories({ parent_category_id: "null" })

  const candidates = categoryHandles
    ? categoryHandles
        .map((h) => allCategories.find((c) => c.handle === h))
        .filter((c): c is NonNullable<typeof c> => !!c)
    : allCategories.slice(0, 4)

  const tabs = (
    await Promise.all(
      candidates.map(async (cat) => {
        const ranking = await listBestSellers({
          categoryId: cat.id,
          limit: limitPerTab,
        })
        const rankedIds = ranking.map((r) => r.product_id)

        const rankedProducts: HttpTypes.StoreProduct[] = rankedIds.length
          ? await listProducts({
              countryCode,
              queryParams: { id: rankedIds, limit: rankedIds.length },
            }).then(({ response }) => {
              const byId = new Map(response.products.map((p) => [p.id, p]))
              return rankedIds
                .map((id) => byId.get(id))
                .filter((p): p is HttpTypes.StoreProduct => !!p)
            })
          : []

        let products = rankedProducts
        if (products.length < limitPerTab) {
          const fillerLimit = limitPerTab - products.length
          const exclude = new Set(products.map((p) => p.id))
          const fillers = await listProducts({
            countryCode,
            queryParams: {
              limit: limitPerTab,
              category_id: [cat.id],
              order: "-created_at",
            },
          }).then(({ response }) =>
            response.products.filter((p) => !exclude.has(p.id)).slice(0, fillerLimit)
          )
          products = [...products, ...fillers]
        }

        return {
          id: cat.id,
          handle: cat.handle,
          label: cat.name,
          products,
          rankedCount: rankedProducts.length,
        }
      })
    )
  ).filter((t) => t.products.length > 0)

  if (tabs.length === 0) return null

  return <BestSellersTabs tabs={tabs} />
}

export default BestSellers
