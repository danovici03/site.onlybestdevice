import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

import { revalidateStorefront } from "../lib/storefront-revalidate"

// Invalidates the storefront's `hero` cache tag whenever a hero slide is
// created, updated, or deleted from the admin, so the homepage slider
// reflects changes immediately (instead of waiting for the time-based
// revalidate).
export default async function heroRevalidate({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  await revalidateStorefront(logger, event.name, ["hero"])
}

export const config: SubscriberConfig = {
  event: "hero-slide.changed",
}
