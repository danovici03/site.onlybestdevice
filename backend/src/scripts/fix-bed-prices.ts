import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { upsertVariantPricesWorkflow } from "@medusajs/medusa/core-flows"

/**
 * One-shot fix: divide every bed variant price by 100.
 *
 * Background: `import-products-xlsx.ts` (and `import-astin.ts`) inherited the
 * Medusa v1 convention of `Math.round(price * 100)` to store amounts in cents.
 * Medusa v2 stores amounts in the main currency unit (EUR). After the last
 * listino migration entered `1500` / `1000` in xlsx, the script wrote
 * `150000` / `100000` instead — the storefront then displays
 * "€150,000.00 / €100,000.00" instead of "€1,500 / €1,000".
 *
 * This script reads every price (including any rule-bound entries) for the
 * 26 Astin bed variants and re-upserts the same set with `amount / 100`,
 * preserving currency_code and price_rules.
 *
 * Run:
 *   yarn medusa exec ./src/scripts/fix-bed-prices.ts
 *   DRY_RUN=true yarn medusa exec ./src/scripts/fix-bed-prices.ts
 *
 * Idempotent guard: variants whose largest price is < 10000 are assumed
 * already fixed and skipped.
 */

const HANDLES = [
  "set-lux-amore", "set-lux-cappy", "set-lux-kuvars", "set-lux-latte",
  "set-lux-leon", "set-lux-linda", "set-lux-line", "set-lux-picasso",
  "set-lux-piyano", "set-lux-platinium", "set-lux-smeraldo", "set-lux-sultan",
  "set-lux-vita", "set-grand", "set-camelli",
  "set-luna-matrimoniale", "set-odessa-matrimoniale", "set-kristal-matrimoniale",
  "set-perla-matrimoniale", "set-duke-singolo", "set-rose-singolo",
  "set-latte-singolo", "set-kristal-singolo", "set-luna-singolo",
  "set-odessa-singolo", "set-perla-singolo",
]

const DRY_RUN = process.env.DRY_RUN === "true"
const SAFETY_THRESHOLD = 10000 // any variant whose max price < this is treated as already fixed

export default async function fixBedPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "variants.id",
      "variants.title",
      "variants.price_set.prices.id",
      "variants.price_set.prices.amount",
      "variants.price_set.prices.currency_code",
      "variants.price_set.prices.price_rules.attribute",
      "variants.price_set.prices.price_rules.value",
    ],
    filters: { handle: HANDLES },
  })

  type Update = {
    handle: string
    variant_id: string
    product_id: string
    title: string
    prices: {
      amount: number
      currency_code: string
      rules?: Record<string, string>
    }[]
    summary: string
  }

  const updates: Update[] = []
  const skippedAlreadyFixed: string[] = []
  const skippedNoPrices: string[] = []

  for (const p of products as any[]) {
    for (const v of p.variants ?? []) {
      const oldPrices = (v.price_set?.prices ?? []) as Array<{
        id: string
        amount: number
        currency_code: string
        price_rules?: Array<{ attribute: string; value: string }>
      }>

      if (!oldPrices.length) {
        skippedNoPrices.push(`${p.handle} / ${v.title}`)
        continue
      }

      const maxAmount = Math.max(...oldPrices.map((pr) => pr.amount))
      if (maxAmount < SAFETY_THRESHOLD) {
        skippedAlreadyFixed.push(`${p.handle} / ${v.title} (max=${maxAmount})`)
        continue
      }

      const newPrices = oldPrices.map((pr) => {
        const rules = (pr.price_rules ?? []).reduce<Record<string, string>>(
          (acc, r) => {
            acc[r.attribute] = r.value
            return acc
          },
          {}
        )
        return {
          amount: pr.amount / 100,
          currency_code: pr.currency_code,
          ...(Object.keys(rules).length ? { rules } : {}),
        }
      })

      updates.push({
        handle: p.handle,
        variant_id: v.id,
        product_id: p.id,
        title: v.title,
        prices: newPrices,
        summary: oldPrices
          .map(
            (pr, i) =>
              `${pr.amount}→${newPrices[i].amount} ${pr.currency_code}` +
              ((pr.price_rules?.length ?? 0)
                ? ` [${pr.price_rules!.map((r) => `${r.attribute}=${r.value}`).join(",")}]`
                : "")
          )
          .join(" | "),
      })
    }
  }

  logger.info(
    `Plan: ${updates.length} variants to fix, ` +
      `${skippedAlreadyFixed.length} already correct, ` +
      `${skippedNoPrices.length} with no prices.`
  )
  for (const u of updates.slice(0, 30)) {
    logger.info(`  ${u.handle} / ${u.title}: ${u.summary}`)
  }
  if (updates.length > 30) logger.info(`  …and ${updates.length - 30} more`)
  if (skippedAlreadyFixed.length) {
    logger.info(
      `Already fixed (skipped): ${skippedAlreadyFixed.slice(0, 5).join(", ")}` +
        (skippedAlreadyFixed.length > 5 ? `, …` : "")
    )
  }
  if (skippedNoPrices.length) {
    logger.warn(`No prices found on: ${skippedNoPrices.join(", ")}`)
  }

  if (!updates.length) {
    logger.info("Nothing to do.")
    return
  }

  if (DRY_RUN) {
    logger.info("DRY_RUN=true — not writing.")
    return
  }

  await upsertVariantPricesWorkflow(container).run({
    input: {
      variantPrices: updates.map((u) => ({
        variant_id: u.variant_id,
        product_id: u.product_id,
        prices: u.prices,
      })),
      previousVariantIds: updates.map((u) => u.variant_id),
    },
  })
  logger.info(`✓ Fixed prices on ${updates.length} variants.`)
}
