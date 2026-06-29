import { listProducts } from "@lib/data/products"

import IconicProductsGrid from "./iconic-products-grid"

const ICONIC_TAGS = new Set(["iconic", "iconico"])
const MAX_ITEMS = 4

type IconicProductsProps = {
  countryCode: string
}

const IconicProducts = async ({ countryCode }: IconicProductsProps) => {
  const { response } = await listProducts({
    countryCode,
    queryParams: { limit: 100, order: "-created_at" },
  })

  const tagged = response.products.filter((p) =>
    (p.tags ?? []).some((t) =>
      t.value ? ICONIC_TAGS.has(t.value.toLowerCase()) : false
    )
  )

  // Fallback to newest products so the section never renders empty.
  const picks = (tagged.length ? tagged : response.products).slice(0, MAX_ITEMS)

  if (picks.length === 0) return null

  return <IconicProductsGrid products={picks} />
}

export default IconicProducts
