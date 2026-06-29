import { HttpTypes } from "@medusajs/types"

export const SHOWROOM_BADGE_LABEL = "Esposto in showroom"

export const SHOWROOM_DESCRIPTION =
  "Articolo esposto nel nostro showroom, disponibile a un prezzo speciale. In ottime condizioni e visionabile di persona prima dell'acquisto."

const SHOWROOM_TAGS = new Set(["showroom", "esposto-showroom", "esposto"])

export const isShowroomProduct = (product: HttpTypes.StoreProduct): boolean => {
  return (product.tags ?? []).some((t) =>
    SHOWROOM_TAGS.has((t.value ?? "").toLowerCase())
  )
}
