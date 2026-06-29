import { HttpTypes } from "@medusajs/types"

export const OUTLET_TAG = "outlet"

export const OUTLET_BADGE_LABEL = "Outlet"

export const OUTLET_DESCRIPTION =
  "Articolo ex esposizione disponibile a prezzo ridotto. Lo stato del bene è documentato nelle foto della scheda prodotto. Garanzia legale di conformità ridotta a 12 mesi ai sensi dell'art. 134 c. 2 Cod. Cons. Diritto di recesso di 14 giorni invariato."

const OUTLET_TAGS = new Set([OUTLET_TAG, "ex-esposizione", "ex-esposto"])

export const isOutletProduct = (product: HttpTypes.StoreProduct): boolean => {
  return (product.tags ?? []).some((t) =>
    OUTLET_TAGS.has((t.value ?? "").toLowerCase())
  )
}
