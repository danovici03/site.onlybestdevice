import { HttpTypes } from "@medusajs/types"

export const OUTLET_TAG = "outlet"

export const OUTLET_BADGE_LABEL = "Resigilat"

export const OUTLET_DESCRIPTION =
  "Produs resigilat / ex-expunere disponibil la preț redus. Starea produsului este documentată în fotografiile din pagina produsului. Garanția legală de conformitate este redusă la 12 luni. Dreptul de retur de 14 zile rămâne neschimbat."

const OUTLET_TAGS = new Set([
  OUTLET_TAG,
  "ex-esposizione",
  "ex-esposto",
  "resigilat",
  "ex-expunere",
])

export const isOutletProduct = (product: HttpTypes.StoreProduct): boolean => {
  return (product.tags ?? []).some((t) =>
    OUTLET_TAGS.has((t.value ?? "").toLowerCase())
  )
}
