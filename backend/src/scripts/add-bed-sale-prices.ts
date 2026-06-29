import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { batchPriceListPricesWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Adds bed-variant sale prices (default 800 EUR) to the active "Lancio Astin"
 * price list.
 *
 * Background: the previous fix-bed-prices.ts ran `upsertVariantPricesWorkflow`
 * with `previousVariantIds`, which Medusa interprets as "clear all prices for
 * these variants" — including the rule-bound price-list prices. As a result
 * the sale prices for the 26 Astin beds disappeared from "Lancio Astin"
 * (inspect-price-lists confirms 0 bed prices left in the list).
 *
 * This script repopulates them at 800 EUR each. It is idempotent: prices that
 * already exist in the price list for these variants are skipped, not
 * duplicated.
 *
 * Run:
 *   yarn medusa exec ./src/scripts/add-bed-sale-prices.ts
 *   DRY_RUN=true yarn medusa exec ./src/scripts/add-bed-sale-prices.ts
 *   SALE_AMOUNT=750 yarn medusa exec ./src/scripts/add-bed-sale-prices.ts
 *   PRICE_LIST_TITLE="Lancio Astin" yarn medusa exec ./src/scripts/add-bed-sale-prices.ts
 */

const BED_HANDLES = [
  "set-lux-amore", "set-lux-cappy", "set-lux-kuvars", "set-lux-latte",
  "set-lux-leon", "set-lux-linda", "set-lux-line", "set-lux-picasso",
  "set-lux-piyano", "set-lux-platinium", "set-lux-smeraldo", "set-lux-sultan",
  "set-lux-vita", "set-grand", "set-camelli",
  "set-luna-matrimoniale", "set-odessa-matrimoniale", "set-kristal-matrimoniale",
  "set-perla-matrimoniale", "set-duke-singolo", "set-rose-singolo",
  "set-latte-singolo", "set-kristal-singolo", "set-luna-singolo",
  "set-odessa-singolo", "set-perla-singolo",
]

const SALE_AMOUNT = Number(process.env.SALE_AMOUNT ?? "800")
const CURRENCY = (process.env.IMPORT_CURRENCY || "eur").toLowerCase()
const PRICE_LIST_TITLE = process.env.PRICE_LIST_TITLE ?? "Lancio Astin"
const DRY_RUN = process.env.DRY_RUN === "true"

export default async function addBedSalePrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  if (!Number.isFinite(SALE_AMOUNT) || SALE_AMOUNT <= 0) {
    throw new Error(`Invalid SALE_AMOUNT: ${process.env.SALE_AMOUNT}`)
  }

  // Resolve the price list.
  const { data: lists } = await query.graph({
    entity: "price_list",
    fields: [
      "id",
      "title",
      "status",
      "type",
      "prices.id",
      "prices.variant.id",
      "prices.variant.product.handle",
    ],
    filters: { title: PRICE_LIST_TITLE },
  })
  const priceList = (lists as any[])[0]
  if (!priceList) {
    throw new Error(`Price list "${PRICE_LIST_TITLE}" not found.`)
  }
  if (priceList.status !== "active") {
    logger.warn(
      `Price list "${PRICE_LIST_TITLE}" status=${priceList.status} (not active)`
    )
  }
  logger.info(`Target price list: ${priceList.title} (${priceList.id})`)

  // Resolve bed variants.
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.title"],
    filters: { handle: BED_HANDLES },
  })

  const variants: Array<{ id: string; handle: string; title: string }> = []
  for (const p of products as any[]) {
    for (const v of p.variants ?? []) {
      variants.push({ id: v.id, handle: p.handle, title: v.title })
    }
  }
  logger.info(`Found ${variants.length} bed variants across ${(products as any[]).length} products`)

  // Variants that already have a price in this list — skip them.
  const existingVariantIds = new Set<string>(
    (priceList.prices ?? [])
      .filter((pr: any) => BED_HANDLES.includes(pr.variant?.product?.handle))
      .map((pr: any) => pr.variant.id)
  )
  const toCreate = variants.filter((v) => !existingVariantIds.has(v.id))

  logger.info(
    `Plan: create ${toCreate.length} sale prices @ ${SALE_AMOUNT} ${CURRENCY.toUpperCase()}` +
      `, skip ${variants.length - toCreate.length} already present.`
  )

  if (!toCreate.length) {
    logger.info("Nothing to do.")
    return
  }

  for (const v of toCreate.slice(0, 10)) {
    logger.info(`  ${v.handle} / ${v.title}`)
  }
  if (toCreate.length > 10) {
    logger.info(`  …and ${toCreate.length - 10} more`)
  }

  if (DRY_RUN) {
    logger.info("DRY_RUN=true — not writing.")
    return
  }

  await batchPriceListPricesWorkflow(container).run({
    input: {
      data: {
        id: priceList.id,
        create: toCreate.map((v) => ({
          amount: SALE_AMOUNT,
          currency_code: CURRENCY,
          variant_id: v.id,
        })),
        update: [],
        delete: [],
      },
    },
  })

  logger.info(`✓ Added ${toCreate.length} sale prices to "${priceList.title}".`)
}
