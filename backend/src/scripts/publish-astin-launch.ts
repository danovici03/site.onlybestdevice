import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createPriceListsWorkflow,
  updateProductsWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Publishes the first wave of Astin set-letto products with launch pricing:
 *   - Regular variant price: 1500 EUR
 *   - "Sale" price list at 1000 EUR — storefront renders this as a striked-out
 *     1500 EUR with the 1000 EUR active price (see lib/util/get-product-price.ts).
 *
 * Idempotent:
 *   - Variant prices are upserted (re-runs replace the EUR price).
 *   - The price list is only created if one with the same TITLE doesn't exist.
 *   - Products are flipped to "published" each run.
 *
 * Run:
 *   yarn medusa exec ./src/scripts/publish-astin-launch.ts
 *   DRY_RUN=true yarn medusa exec ./src/scripts/publish-astin-launch.ts
 */

const HANDLES = [
  "set-lux-kuvars",
  "set-lux-cappy",
  "set-lux-piyano",
  "set-lux-sultan",
  "set-lux-amore",
  "set-lux-line",
  "set-grand",
  "set-luna-matrimoniale",
  "set-luna-singolo",
  "set-duke-singolo",
  "set-rose-singolo",
  "materasso-saphire-pedli",
] as const

const REGULAR_CENTS = 1500_00
const SALE_CENTS = 1000_00
const CURRENCY = (process.env.IMPORT_CURRENCY || "eur").toLowerCase()
const DRY_RUN = process.env.DRY_RUN === "true"
const PRICE_LIST_TITLE = "Lancio Astin"

export default async function publishAstinLaunch({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "status", "variants.id", "variants.title"],
    filters: { handle: [...HANDLES] },
  })

  const found = new Map<string, any>(
    (products as any[]).map((p) => [p.handle, p])
  )
  const missing = HANDLES.filter((h) => !found.has(h))
  if (missing.length) {
    logger.warn(`Missing products in DB (not imported yet?): ${missing.join(", ")}`)
  }
  if (!found.size) {
    logger.info("Nothing to publish.")
    return
  }

  const allVariantIds: string[] = []
  const variantPrices: {
    variant_id: string
    product_id: string
    prices: { amount: number; currency_code: string }[]
  }[] = []

  for (const product of found.values()) {
    for (const v of product.variants ?? []) {
      allVariantIds.push(v.id)
      variantPrices.push({
        variant_id: v.id,
        product_id: product.id,
        prices: [{ amount: REGULAR_CENTS, currency_code: CURRENCY }],
      })
    }
  }

  logger.info(
    `Found ${found.size}/${HANDLES.length} products, ${allVariantIds.length} variants. ` +
      `Regular ${REGULAR_CENTS / 100} ${CURRENCY.toUpperCase()}, ` +
      `sale ${SALE_CENTS / 100} ${CURRENCY.toUpperCase()}. ` +
      (DRY_RUN ? "DRY_RUN=true (no writes)." : "Live run.")
  )

  if (DRY_RUN) {
    for (const [handle, p] of found) {
      logger.info(`  ${handle}: ${p.variants?.length ?? 0} variants, status=${p.status}`)
    }
    return
  }

  // 1) Set regular variant prices to 1500 EUR.
  if (variantPrices.length) {
    await upsertVariantPricesWorkflow(container).run({
      input: { variantPrices, previousVariantIds: allVariantIds },
    })
    logger.info(`Set regular ${REGULAR_CENTS / 100} EUR on ${variantPrices.length} variants.`)
  }

  // 2) Create the sale price list (skip if it already exists by title).
  const { data: existingLists } = await query.graph({
    entity: "price_list",
    fields: ["id", "title"],
    filters: { title: PRICE_LIST_TITLE } as any,
  })
  if (existingLists.length) {
    logger.info(
      `Price list "${PRICE_LIST_TITLE}" already exists (${(existingLists[0] as any).id}) — ` +
        `skipping creation. Edit it in admin (Settings → Price Lists) to change sale prices.`
    )
  } else {
    await createPriceListsWorkflow(container).run({
      input: {
        price_lists_data: [
          {
            title: PRICE_LIST_TITLE,
            name: PRICE_LIST_TITLE,
            description: "Prezzo lancio sui set letto Astin",
            type: "sale",
            status: "active",
            prices: allVariantIds.map((variant_id) => ({
              variant_id,
              amount: SALE_CENTS,
              currency_code: CURRENCY,
            })),
          },
        ] as any,
      },
    })
    logger.info(
      `Created sale price list "${PRICE_LIST_TITLE}" at ${SALE_CENTS / 100} EUR ` +
        `on ${allVariantIds.length} variants.`
    )
  }

  // 3) Flip products to published.
  const productIds = [...found.values()].map((p) => p.id)
  await updateProductsWorkflow(container).run({
    input: {
      selector: { id: productIds },
      update: { status: ProductStatus.PUBLISHED },
    },
  })
  logger.info(`Published ${productIds.length} products.`)
}
