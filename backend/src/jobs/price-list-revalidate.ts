import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  crossedBoundaries,
  PRICE_LIST_BOUNDARY_TAGS,
  type ScheduledPriceList,
} from "../lib/price-list-boundaries"
import {
  buildPriceSnapshot,
  changedProducts,
  priceChangeTags,
  type PriceListRow,
  type PriceSnapshot,
} from "../lib/price-list-changes"
import {
  DEFERRED_PRODUCT_TAGS,
  revalidateStorefront,
  revalidateStorefrontLater,
} from "../lib/storefront-revalidate"

/**
 * Instantaneul stă în memoria procesului. După un restart, prima rulare doar îl
 * reface: ce s-a schimbat cât timp backend-ul a fost oprit se împrospătează pe
 * TTL-ul storefront-ului.
 */
let snapshot: PriceSnapshot | null = null

const PRICE_LIST_ROWS = `
  SELECT p.id AS product_id, p.handle, v.id AS variant_id,
         pr.price_list_id, pr.currency_code, pr.amount,
         pr.min_quantity, pr.max_quantity
  FROM price pr
  JOIN price_list pl ON pl.id = pr.price_list_id
    AND pl.deleted_at IS NULL AND pl.status = 'active'
    AND (pl.starts_at IS NULL OR pl.starts_at <= NOW())
    AND (pl.ends_at IS NULL OR pl.ends_at >= NOW())
  JOIN product_variant_price_set vps ON vps.price_set_id = pr.price_set_id
    AND vps.deleted_at IS NULL
  JOIN product_variant v ON v.id = vps.variant_id AND v.deleted_at IS NULL
  JOIN product p ON p.id = v.product_id AND p.deleted_at IS NULL
  WHERE pr.deleted_at IS NULL
`

const revalidateChangedPrices = async (
  container: MedusaContainer,
  logger: Logger
) => {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const { rows } = await pg.raw(PRICE_LIST_ROWS)
  const next = buildPriceSnapshot(rows as PriceListRow[])

  if (!snapshot) {
    snapshot = next
    return
  }

  const changed = changedProducts(snapshot, next)
  if (!changed.length) {
    // Prețurile sunt aceleași, dar handle-ul se poate schimba: scoaterea
    // ulterioară din listă trebuie să golească pagina de sub handle-ul nou.
    snapshot = next
    return
  }

  const event = `price list: ${changed.length} produse cu preț schimbat`
  const ok = await revalidateStorefront(logger, event, priceChangeTags(changed))
  // Instantaneul rămâne pe loc, deci rularea următoare reîncearcă aceleași
  // produse dacă storefront-ul e indisponibil (deploy Vercel, 502).
  if (!ok) return

  snapshot = next
  revalidateStorefrontLater(logger, event, DEFERRED_PRODUCT_TAGS)
}

/**
 * Împrospătează prețurile de pe site când un price list programat începe sau se
 * termină și când i se schimbă conținutul. Vezi `lib/price-list-boundaries.ts`
 * și `lib/price-list-changes.ts`.
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
  if (boundaries.length) {
    await revalidateStorefront(
      logger,
      `price list: ${boundaries.join(", ")}`,
      PRICE_LIST_BOUNDARY_TAGS
    )
  }

  await revalidateChangedPrices(container, logger)
}

export const config = {
  name: "price-list-revalidate",
  schedule: "* * * * *",
}
