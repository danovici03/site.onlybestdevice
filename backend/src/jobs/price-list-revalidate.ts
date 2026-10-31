import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  crossedBoundaries,
  PRICE_LIST_BOUNDARY_TAGS,
  type ScheduledPriceList,
} from "../lib/price-list-boundaries"
import { revalidateStorefront } from "../lib/storefront-revalidate"

/**
 * Împrospătează prețurile de pe site când un price list programat începe sau se
 * termină. Vezi `lib/price-list-boundaries.ts`.
 */
export default async function priceListRevalidate(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: lists } = await query.graph({
    entity: "price_list",
    fields: ["title", "status", "starts_at", "ends_at"],
  })

  const boundaries = crossedBoundaries(
    (lists ?? []) as ScheduledPriceList[],
    Date.now()
  )
  if (!boundaries.length) return

  await revalidateStorefront(
    logger,
    `price list: ${boundaries.join(", ")}`,
    PRICE_LIST_BOUNDARY_TAGS
  )
}

export const config = {
  name: "price-list-revalidate",
  schedule: "* * * * *",
}
