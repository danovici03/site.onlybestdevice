import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

// Invalidates the storefront's `hero` cache tag whenever a hero slide is
// created, updated, or deleted from the admin, so the homepage slider
// reflects changes immediately (instead of waiting for the time-based
// revalidate). No-op if revalidation env vars are not configured.
export default async function heroRevalidate({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const url = process.env.STOREFRONT_REVALIDATE_URL
  const secret = process.env.REVALIDATE_SECRET

  if (!url || !secret) {
    logger.debug(
      "Skipping storefront revalidation — STOREFRONT_REVALIDATE_URL or REVALIDATE_SECRET not set."
    )
    return
  }

  const tags = ["hero"]

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
  event: "hero-slide.changed",
}
