import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  updateProductsWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"

const PLACEHOLDER_CENTS = Number(
  process.env.PLACEHOLDER_PRICE_CENTS ?? "10000"
)
const CURRENCY = (process.env.PLACEHOLDER_CURRENCY || "eur").toLowerCase()
const DRY_RUN = process.env.DRY_RUN === "true"

export default async function publishDrafts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: drafts } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "variants.id",
      "variants.prices.id",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
    filters: { status: "draft" },
  })

  if (!drafts.length) {
    logger.info("No draft products found.")
    return
  }
  logger.info(
    `Found ${drafts.length} draft products. ` +
      `Placeholder: ${PLACEHOLDER_CENTS / 100} ${CURRENCY.toUpperCase()}. ` +
      (DRY_RUN ? "DRY_RUN=true (no writes)." : "Live run.")
  )

  const variantPrices: {
    variant_id: string
    product_id: string
    prices: { amount: number; currency_code: string }[]
  }[] = []
  const previousVariantIds: string[] = []

  let added = 0
  let replaced = 0
  let kept = 0

  for (const p of drafts as any[]) {
    for (const v of p.variants ?? []) {
      const prices = v.prices ?? []
      const eur = prices.find(
        (pr: any) => pr.currency_code?.toLowerCase() === CURRENCY
      )
      const hasRealEur = eur && Number(eur.amount) > 0

      if (hasRealEur) {
        kept++
        continue
      }

      variantPrices.push({
        variant_id: v.id,
        product_id: p.id,
        prices: [{ amount: PLACEHOLDER_CENTS, currency_code: CURRENCY }],
      })
      if (prices.length > 0) {
        previousVariantIds.push(v.id)
        replaced++
      } else {
        added++
      }
    }
  }

  logger.info(
    `Variants: ${added} to add new EUR price, ` +
      `${replaced} to replace 0/missing-EUR, ` +
      `${kept} kept as-is.`
  )

  if (DRY_RUN) {
    logger.info("DRY_RUN — skipping price upsert and status publish.")
    return
  }

  if (variantPrices.length) {
    await upsertVariantPricesWorkflow(container).run({
      input: { variantPrices, previousVariantIds },
    })
    logger.info(
      `Placeholder applied on ${variantPrices.length} variants.`
    )
  }

  const draftIds = (drafts as any[]).map((p) => p.id)
  await updateProductsWorkflow(container).run({
    input: {
      selector: { id: draftIds },
      update: { status: ProductStatus.PUBLISHED },
    },
  })
  logger.info(`Published ${drafts.length} products.`)
}
