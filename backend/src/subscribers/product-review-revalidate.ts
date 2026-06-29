import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

// Invalidates the storefront's per-product reviews tag whenever the
// public-visible state of a review changes (published, unpublished, or
// edited while public). Storefront accepts the `reviews-<product_id>`
// prefix via src/app/api/revalidate/route.ts.
export default async function productReviewRevalidate({
  event,
  container,
}: SubscriberArgs<{ id: string; product_id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const url = process.env.STOREFRONT_REVALIDATE_URL
  const secret = process.env.REVALIDATE_SECRET

  if (!url || !secret) {
    logger.debug(
      "Skipping storefront revalidation — STOREFRONT_REVALIDATE_URL or REVALIDATE_SECRET not set.",
    )
    return
  }

  const productId = event.data?.product_id
  if (!productId) return

  const tags = [`reviews-${productId}`, "products"]

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
        `Storefront revalidate ${res.status} for ${event.name} (${tags.join(", ")}): ${text}`,
      )
    } else {
      logger.info(
        `Revalidated storefront [${tags.join(", ")}] on ${event.name}`,
      )
    }
  } catch (e) {
    logger.warn(
      `Storefront revalidate failed for ${event.name}: ${(e as Error).message}`,
    )
  }
}

export const config: SubscriberConfig = {
  event: ["product-review.published", "product-review.unpublished"],
}
