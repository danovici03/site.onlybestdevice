import { HttpTypes } from "@medusajs/types"

import { listProducts } from "./products"
import { SH_SERVICES_HANDLE } from "@lib/util/second-hand"

/**
 * Produsul de serviciu „Servicii Second Hand" (variante „Baterie nouă 100%" /
 * „Folie de sticlă montată"). Se cere doar pe paginile produselor SH.
 */
export async function getSecondHandServices({
  countryCode,
}: {
  countryCode: string
}): Promise<HttpTypes.StoreProduct | undefined> {
  return listProducts({
    countryCode,
    queryParams: { handle: SH_SERVICES_HANDLE },
  })
    .then(({ response }) => response.products[0] ?? undefined)
    .catch(() => undefined)
}
