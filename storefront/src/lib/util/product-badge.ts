import { HttpTypes } from "@medusajs/types"

import { SALE_BADGE_LABEL, isSaleProduct } from "./sale"
import { SHOWROOM_BADGE_LABEL, isShowroomProduct } from "./showroom"

/**
 * Eticheta din colțul cardului de produs, sau `null` dacă produsul n-are una.
 *
 * Ordinea contează: e o singură pastilă, deci prima regulă care se potrivește
 * câștigă. „Expus în showroom" e prima pentru că spune ceva despre starea
 * fizică a produsului, nu despre cum îl promovăm.
 *
 * Ținută aici, nu în componente: aceeași etichetă trebuie să apară și în
 * carusela de pe home, și în grila din listări — două copii ale regulii ar
 * însemna că același produs poate primi badge-uri diferite în cele două locuri.
 */
export const getProductBadge = (
  product: HttpTypes.StoreProduct
): string | null => {
  if (isShowroomProduct(product)) return SHOWROOM_BADGE_LABEL

  const tags = (product.tags ?? []).map((t) => t.value?.toLowerCase() ?? "")
  if (tags.includes("new") || tags.includes("nuovo") || tags.includes("nou"))
    return "Nou"
  if (tags.includes("bestseller") || tags.includes("best-seller"))
    return "Best seller"
  if (isSaleProduct(product)) return SALE_BADGE_LABEL

  return null
}
