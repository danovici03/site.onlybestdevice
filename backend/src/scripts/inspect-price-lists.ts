import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

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

export default async function inspectPriceLists({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: lists } = await query.graph({
    entity: "price_list",
    fields: [
      "id",
      "title",
      "status",
      "type",
      "starts_at",
      "ends_at",
      "prices.id",
      "prices.amount",
      "prices.currency_code",
      "prices.variant.id",
      "prices.variant.title",
      "prices.variant.product.handle",
    ],
  })

  logger.info(`Found ${(lists as any[]).length} price list(s):`)

  for (const pl of lists as any[]) {
    const allPrices = pl.prices ?? []
    const bedPrices = allPrices.filter((p: any) =>
      BED_HANDLES.includes(p.variant?.product?.handle)
    )
    logger.info(
      `\n[${pl.status}] ${pl.title} (${pl.id}) type=${pl.type} ` +
        `starts=${pl.starts_at ?? "—"} ends=${pl.ends_at ?? "—"} ` +
        `total_prices=${allPrices.length} bed_prices=${bedPrices.length}`
    )
    for (const p of bedPrices.slice(0, 5)) {
      logger.info(
        `  ${p.variant.product.handle} / ${p.variant.title}: ${p.amount} ${p.currency_code}`
      )
    }
    if (bedPrices.length > 5) {
      logger.info(`  …and ${bedPrices.length - 5} more bed prices`)
    }
  }

  // Also check promotions
  const { data: promos } = await query.graph({
    entity: "promotion",
    fields: ["id", "code", "is_automatic", "status", "type"],
  })
  logger.info(`\nFound ${(promos as any[]).length} promotion(s):`)
  for (const pr of promos as any[]) {
    logger.info(
      `  ${pr.code ?? "(no code)"} status=${pr.status} type=${pr.type} auto=${pr.is_automatic}`
    )
  }
}
