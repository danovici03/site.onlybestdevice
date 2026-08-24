import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

import { revalidateStorefront } from "../lib/storefront-revalidate"

// Invalidates the storefront's per-product reviews tag whenever the
// public-visible state of a review changes (published, unpublished, or
// edited while public). Storefront accepts the `reviews-<product_id>`
// prefix via src/app/api/revalidate/route.ts.
export default async function productReviewRevalidate({
  event,
  container,
}: SubscriberArgs<{ id: string; product_id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const productId = event.data?.product_id
  if (!productId) return

  await revalidateStorefront(logger, event.name, [
    `reviews-${productId}`,
    "products",
  ])
}

export const config: SubscriberConfig = {
  event: ["product-review.published", "product-review.unpublished"],
}
