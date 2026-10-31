import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  DEFERRED_PRODUCT_TAGS,
  MAX_TARGETED_PRODUCTS,
  productRevalidationTags,
  revalidateStorefront,
  revalidateStorefrontLater,
} from "./storefront-revalidate"

/** Ce trimiteau evenimentele de produs înainte de revalidarea țintită. */
const GLOBAL_PRODUCT_TAGS = ["products", "categories", "best-sellers", "carts"]

/**
 * Revalidarea unei modificări de produs: pagina produsului și listările acum,
 * restul catalogului amânat (vezi `productRevalidationTags`).
 *
 * Evenimentele aduc doar id-ul, iar pagina se cere după handle — de aici
 * interogarea. Dacă handle-ul nu se poate afla (produs șters, eroare) sau sunt
 * prea multe produse, revenim la tagurile globale: un site corect e mai
 * important decât o regenerare economisită.
 */
export const revalidateProducts = async (
  container: MedusaContainer,
  logger: Logger,
  eventName: string,
  {
    productIds = [],
    variantIds = [],
    carts,
    fallbackTags = GLOBAL_PRODUCT_TAGS,
  }: {
    productIds?: string[]
    variantIds?: string[]
    carts: boolean
    /** Ce pleacă dacă revalidarea țintită nu e posibilă. */
    fallbackTags?: string[]
  }
) => {
  let products: Array<{ id: string; handle?: string | null }> | null = null
  try {
    // Peste prag (o categorie întreagă) oricum revenim la fallback.
    if (productIds.length + variantIds.length <= MAX_TARGETED_PRODUCTS) {
      products = await loadProducts(container, productIds, variantIds)
    }
  } catch (e) {
    logger.warn(
      `Revalidare țintită imposibilă pe ${eventName}: ${(e as Error).message}`
    )
  }

  const targeted =
    products?.length &&
    products.length <= MAX_TARGETED_PRODUCTS &&
    products.every((p) => p.handle)

  if (!targeted) {
    await revalidateStorefront(logger, eventName, fallbackTags)
    return
  }

  const tags = productRevalidationTags(products!, { carts })
  const ok = await revalidateStorefront(logger, eventName, tags)
  // Un storefront care respinge tagurile noi ar rămâne pe date vechi.
  if (!ok) {
    await revalidateStorefront(logger, eventName, fallbackTags)
    return
  }
  revalidateStorefrontLater(logger, eventName, DEFERRED_PRODUCT_TAGS)
}

const loadProducts = async (
  container: MedusaContainer,
  productIds: string[],
  variantIds: string[]
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const ids = new Set(productIds)

  if (variantIds.length) {
    const { data } = await query.graph({
      entity: "product_variant",
      fields: ["id", "product_id"],
      filters: { id: variantIds },
    })
    for (const v of data ?? []) if (v.product_id) ids.add(v.product_id)
  }
  if (!ids.size) return []

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { id: [...ids] },
  })
  // Un id fără rând (produs șters între timp) lasă produsul fără handle, deci
  // pe ruta globală.
  const handles = new Map((data ?? []).map((p: any) => [p.id, p.handle]))
  return [...ids].map((id) => ({ id, handle: handles.get(id) ?? null }))
}
