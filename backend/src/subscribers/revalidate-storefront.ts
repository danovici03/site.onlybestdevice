import {
  ContainerRegistrationKeys,
} from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

import { revalidateProducts } from "../lib/product-revalidate"
import { revalidateStorefront } from "../lib/storefront-revalidate"

// Map Medusa event name → cache tags the Next.js storefront should revalidate.
// Produsele și variantele nu stau aici: ele revalidează țintit, vezi
// `PRODUCT_EVENTS` și `lib/product-revalidate.ts`.
const EVENT_TO_TAGS: Record<string, string[]> = {
  "product-category.created": ["categories", "products", "best-sellers"],
  "product-category.updated": ["categories", "products", "best-sellers"],
  "product-category.deleted": ["categories", "products", "best-sellers"],
  // Produsul nu mai există, deci nici handle-ul lui pentru tagul țintit.
  // Rar (câteva pe săptămână), deci tagurile globale nu costă.
  "product.deleted": ["products", "categories", "best-sellers", "carts"],
  "product-collection.created": ["collections", "products"],
  "product-collection.updated": ["collections", "products"],
  "product-collection.deleted": ["collections", "products"],
  // Metodele de plată se activează pe regiune, iar storefront-ul le ține în
  // cache cu `force-cache` sub tag-ul `payment_providers`. Fără el, un provider
  // nou activat rămâne invizibil în checkout până expiră cache-ul.
  "region.created": ["regions", "payment_providers"],
  "region.updated": ["regions", "payment_providers"],
  "region.deleted": ["regions", "payment_providers"],
}

/**
 * Evenimentele de produs → ce id aduc și dacă ating coșurile.
 *
 * `carts` la actualizare: răspunsul coșului include datele produsului, iar
 * bifa „Garanție extinsă" se citește din tagurile lui. Fără invalidarea
 * coșurilor, o bifă schimbată din Admin rămâne fără efect pentru clienții care
 * au deja produsul în coș, până când își modifică ei coșul.
 *
 * Prețul stă pe variantă, nu pe produs: schimbarea lui din Admin (cardul
 * „Preț" sau gridul standard „Edit Prices") emite doar `product-variant.updated`.
 */
const PRODUCT_EVENTS: Record<string, { variant: boolean; carts: boolean }> = {
  "product.created": { variant: false, carts: false },
  "product.updated": { variant: false, carts: true },
  "product-variant.updated": { variant: true, carts: true },
}

export default async function revalidateStorefrontSubscriber({
  event,
  container,
}: SubscriberArgs<{ id?: string; ids?: string[] }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const product = PRODUCT_EVENTS[event.name]
  if (product) {
    const data = event.data as { id?: string; ids?: string[] } | undefined
    const ids = data?.ids?.length ? data.ids : data?.id ? [data.id] : []
    await revalidateProducts(container, logger, event.name, {
      [product.variant ? "variantIds" : "productIds"]: ids,
      carts: product.carts,
    })
    return
  }

  const tags = EVENT_TO_TAGS[event.name]
  if (!tags?.length) return

  await revalidateStorefront(logger, event.name, tags)
}

export const config: SubscriberConfig = {
  event: [...Object.keys(EVENT_TO_TAGS), ...Object.keys(PRODUCT_EVENTS)],
}
