import { HttpTypes } from "@medusajs/types"

// În stoc dacă vreo variantă e cumpărabilă. Produsele importate au
// manage_inventory=false (mereu disponibile), deci implicit „În stoc"; arătăm
// „Stoc epuizat" doar când inventarul e gestionat și e 0.
//
// Aceeași regulă o aplică și ruta `/store/catalog` în SQL, ca să pună produsele
// în stoc primele — dacă se schimbă aici, se schimbă și acolo.
export const isInStock = (product: HttpTypes.StoreProduct): boolean => {
  const variants = product.variants ?? []
  if (!variants.length) return true
  return variants.some((v) => {
    const mi = (v as any).manage_inventory
    if (mi === false || mi == null) return true
    if ((v as any).allow_backorder) return true
    return ((v as any).inventory_quantity ?? 0) > 0
  })
}
