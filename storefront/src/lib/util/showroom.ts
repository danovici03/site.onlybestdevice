import { HttpTypes } from "@medusajs/types"

export const SHOWROOM_BADGE_LABEL = "Expus în showroom"

export const SHOWROOM_DESCRIPTION =
  "Produs expus în showroom-ul nostru, disponibil la un preț special. În stare foarte bună și poate fi văzut direct înainte de achiziție."

const SHOWROOM_TAGS = new Set([
  "showroom",
  "esposto-showroom",
  "esposto",
  "expus-showroom",
  "expus",
])

export const isShowroomProduct = (product: HttpTypes.StoreProduct): boolean => {
  return (product.tags ?? []).some((t) =>
    SHOWROOM_TAGS.has((t.value ?? "").toLowerCase())
  )
}
