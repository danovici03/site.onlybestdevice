import { HttpTypes } from "@medusajs/types"

/** Produsul de serviciu din Medusa, ascuns din catalog. */
export const WARRANTY_HANDLE = "garantie-extinsa"

/** Cheia din metadata liniei de garanție care spune ce produs acoperă. */
export const WARRANTY_FOR = "warranty_for"
export const WARRANTY_FOR_TITLE = "warranty_for_title"

type Line = HttpTypes.StoreCartLineItem

export function isWarrantyLine(item: Line): boolean {
  return (
    item.product_handle === WARRANTY_HANDLE ||
    item.variant?.product?.handle === WARRANTY_HANDLE
  )
}

/** Produsul pe care îl acoperă o linie de garanție, dacă e legată de unul. */
export function warrantyTargetTitle(item: Line): string | null {
  const raw = (item.metadata as Record<string, unknown> | undefined)?.[
    WARRANTY_FOR_TITLE
  ]
  return typeof raw === "string" && raw.length > 0 ? raw : null
}

/**
 * Ce produse din coș au deja garanție extinsă.
 *
 * `hasUnlinked` acoperă garanțiile adăugate înainte ca liniile să poarte
 * metadata — n-avem cum să știm ce acoperă, așa că în prezența lor nu mai
 * propunem nimic. Mai bine ratăm o ofertă decât să-i cerem unui client să
 * cumpere a doua oară ceva ce are deja.
 */
export function warrantyCoverage(cart?: HttpTypes.StoreCart | null): {
  coveredProductIds: Set<string>
  hasUnlinked: boolean
} {
  const coveredProductIds = new Set<string>()
  let hasUnlinked = false

  for (const line of cart?.items ?? []) {
    if (!isWarrantyLine(line)) continue

    const target = (line.metadata as Record<string, unknown> | undefined)?.[
      WARRANTY_FOR
    ]

    if (typeof target === "string" && target.length > 0) {
      coveredProductIds.add(target)
    } else {
      hasUnlinked = true
    }
  }

  return { coveredProductIds, hasUnlinked }
}

/** Propunem garanție doar pentru produsele reale care n-au deja una. */
export function shouldOfferWarranty(
  item: Line,
  cart?: HttpTypes.StoreCart | null
): boolean {
  if (isWarrantyLine(item)) return false
  // Fără produs identificabil n-am putea lega garanția de nimic, iar o linie
  // nelegată ar ascunde apoi ofertele pentru tot coșul.
  if (!item.product_id) return false

  const { coveredProductIds, hasUnlinked } = warrantyCoverage(cart)
  if (hasUnlinked) return false

  return !coveredProductIds.has(item.product_id ?? "")
}
