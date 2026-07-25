import { HttpTypes } from "@medusajs/types"

import { listProducts } from "./products"
import { WARRANTY_HANDLE } from "@lib/util/warranty"

/**
 * Produsul de serviciu „Garanție extinsă" (variante +1 an / +2 ani, prețuri
 * din Admin). E același pentru tot catalogul — pagina de produs, coșul și
 * finalizarea îl cer de aici ca să nu repete handle-ul prin cod.
 */
export async function getWarrantyProduct({
  countryCode,
  regionId,
}: {
  countryCode?: string
  regionId?: string
}): Promise<HttpTypes.StoreProduct | undefined> {
  if (!countryCode && !regionId) return undefined

  return listProducts({
    countryCode,
    regionId,
    queryParams: { handle: WARRANTY_HANDLE },
  })
    .then(({ response }) => response.products[0] ?? undefined)
    .catch(() => undefined)
}
