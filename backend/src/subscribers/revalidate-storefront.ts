import {
  ContainerRegistrationKeys,
} from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

// Map Medusa event name → cache tags the Next.js storefront should revalidate.
const EVENT_TO_TAGS: Record<string, string[]> = {
  "product-category.created": ["categories", "products", "best-sellers"],
  "product-category.updated": ["categories", "products", "best-sellers"],
  "product-category.deleted": ["categories", "products", "best-sellers"],
  "product.created": ["products", "categories", "best-sellers"],
  "product.updated": ["products", "categories", "best-sellers"],
  "product.deleted": ["products", "categories", "best-sellers"],
  "product-collection.created": ["collections", "products"],
  "product-collection.updated": ["collections", "products"],
  "product-collection.deleted": ["collections", "products"],
  "region.created": ["regions"],
  "region.updated": ["regions"],
  "region.deleted": ["regions"],
}

export default async function revalidateStorefront({
  event,
  container,
}: SubscriberArgs<unknown>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const url = process.env.STOREFRONT_REVALIDATE_URL
  const secret = process.env.REVALIDATE_SECRET

  if (!url || !secret) {
    logger.debug(
      "Skipping storefront revalidation — STOREFRONT_REVALIDATE_URL or REVALIDATE_SECRET not set."
    )
    return
  }

  const tags = EVENT_TO_TAGS[event.name]
  if (!tags || tags.length === 0) return

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ tags }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      logger.warn(
        `Storefront revalidate ${res.status} for ${event.name} (${tags.join(", ")}): ${text}`
      )
    } else {
      logger.info(
        `Revalidated storefront [${tags.join(", ")}] on ${event.name}`
      )
    }
  } catch (e) {
    logger.warn(
      `Storefront revalidate failed for ${event.name}: ${(e as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: Object.keys(EVENT_TO_TAGS),
}
