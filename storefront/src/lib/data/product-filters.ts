"use server"

import { sdk } from "@lib/config"
import { productTag } from "@lib/util/cache-tags"
import { getCacheOptions } from "./cookies"

export type ProductFilterDTO = {
  key: string
  label: string
  type: "select" | "number"
  value: string | null
  slug: string | null
  value_number: number | null
  unit: string | null
}

/**
 * Valorile de filtru ale produsului (modulul `product_filter` din backend).
 * Sub `product-<id>`: completarea automată revalidează doar produsul salvat.
 * `products` rămâne pentru schimbările de filtre din admin, care ating tot
 * catalogul.
 */
export const listProductFilters = async (
  productId: string
): Promise<ProductFilterDTO[]> => {
  const next = {
    ...(await getCacheOptions(["products", productTag(productId)])),
  }

  try {
    const { filters } = await sdk.client.fetch<{ filters: ProductFilterDTO[] }>(
      `/store/products/${productId}/filters`,
      { method: "GET", next, cache: "force-cache" }
    )
    return filters ?? []
  } catch {
    // Fără filtre pagina merge mai departe, doar fără marca din breadcrumb.
    return []
  }
}
