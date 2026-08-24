import {
  ContainerRegistrationKeys,
} from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

import { revalidateStorefront } from "../lib/storefront-revalidate"

// Map Medusa event name → cache tags the Next.js storefront should revalidate.
const EVENT_TO_TAGS: Record<string, string[]> = {
  "product-category.created": ["categories", "products", "best-sellers"],
  "product-category.updated": ["categories", "products", "best-sellers"],
  "product-category.deleted": ["categories", "products", "best-sellers"],
  "product.created": ["products", "categories", "best-sellers"],
  // `carts` la actualizare: răspunsul coșului include datele produsului, iar
  // bifa „Garanție extinsă" se citește din tagurile lui. Fără invalidarea
  // coșurilor, o bifă schimbată din Admin rămâne fără efect pentru clienții
  // care au deja produsul în coș, până când își modifică ei coșul.
  "product.updated": ["products", "categories", "best-sellers", "carts"],
  "product.deleted": ["products", "categories", "best-sellers", "carts"],
  // Prețul stă pe variantă, nu pe produs: schimbarea lui din Admin (cardul
  // „Preț" sau gridul standard „Edit Prices") emite doar `product-variant.updated`.
  // Fără linia asta, site-ul rămâne pe prețul vechi până expiră cache-ul.
  "product-variant.updated": ["products", "categories", "best-sellers", "carts"],
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

export default async function revalidateStorefrontSubscriber({
  event,
  container,
}: SubscriberArgs<unknown>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const tags = EVENT_TO_TAGS[event.name]
  if (!tags?.length) return

  await revalidateStorefront(logger, event.name, tags)
}

export const config: SubscriberConfig = {
  event: Object.keys(EVENT_TO_TAGS),
}
