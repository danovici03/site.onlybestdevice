import crypto from "node:crypto"

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  batchPriceListPricesWorkflow,
  createPriceListsWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Applies a fake-markup sale to all products in Soggiorno + Sala da pranzo
 * (categories: soggiorno, divani, poltrone, sala-da-pranzo, sedie). Beds and
 * any Camera da letto product are left untouched.
 *
 * Strategy: the price the customer pays stays exactly as it is today. The
 * variant's *base* EUR price is inflated so the storefront shows a 50–60%
 * strikethrough.
 *
 *   final_for_customer = current base EUR price (becomes sale_price in price list)
 *   new base           = round(current / (1 - d))            where d ∈ [0.50, 0.60]
 *
 * The storefront reads `calculated_amount` (sale) + `original_amount` (base)
 * out of variants.calculated_price (see lib/util/get-product-price.ts).
 *
 * Order of writes is deliberate (and forced by a Medusa quirk):
 *   1. Bump variant base prices to inflated values. Done first because
 *      `upsertVariantPricesWorkflow` with `previousVariantIds` deletes ALL
 *      prices for those variants — including price-list-bound ones
 *      (see add-bed-sale-prices.ts header for the incident this caused).
 *   2. Add sale prices in the "Saldi" price list (= original current base).
 *
 *   There is a brief window between steps 1 and 2 where customers see the
 *   inflated base with no discount applied. To minimise it, both writes
 *   happen back-to-back; we deliberately don't yield to long-running work
 *   between them.
 *
 * Idempotency:
 *   - Variants with ANY price-list-bound EUR price are skipped. That covers
 *     the happy-path re-run (already in "Saldi 2026") AND the partial-failure
 *     case where phase 1 inflated the base but phase 2 left no price-list
 *     marker — re-running would otherwise compound the markup. It also stops
 *     us from overwriting variants that belong to a different sale (e.g.
 *     "Lancio Astin"); those need manual cleanup before we'd touch them.
 *   - The per-variant discount is derived from a seeded hash of `variant_id`,
 *     so re-running with the same RANDOM_SEED produces the same numbers.
 *   - The price list is created on first run; re-runs reuse it.
 *
 * Run:
 *   # safe, prints what would happen
 *   yarn medusa exec ./src/scripts/markup-soggiorno-pranzo.ts
 *
 *   # actually write
 *   DRY_RUN=false yarn medusa exec ./src/scripts/markup-soggiorno-pranzo.ts
 *
 *   # tweak parameters
 *   DISCOUNT_MIN=0.5 DISCOUNT_MAX=0.6 \
 *   PRICE_LIST_TITLE="Saldi 2026" \
 *   RANDOM_SEED="arredovita-saldi-2026" \
 *   DRY_RUN=false yarn medusa exec ./src/scripts/markup-soggiorno-pranzo.ts
 */

const TARGET_CATEGORY_HANDLES = [
  "soggiorno",
  "divani",
  "poltrone",
  "sala-da-pranzo",
  "sedie",
]

const CURRENCY = (process.env.IMPORT_CURRENCY || "eur").toLowerCase()
const DRY_RUN = process.env.DRY_RUN !== "false"
const PRICE_LIST_TITLE = process.env.PRICE_LIST_TITLE ?? "Saldi 2026"
const PRICE_LIST_DESC =
  process.env.PRICE_LIST_DESC ??
  "Sconti su divani, poltrone, sedie e arredi sala da pranzo."
const DISCOUNT_MIN = Number(process.env.DISCOUNT_MIN ?? "0.50")
const DISCOUNT_MAX = Number(process.env.DISCOUNT_MAX ?? "0.60")
const RANDOM_SEED = process.env.RANDOM_SEED ?? "arredovita-saldi-2026"

if (
  !Number.isFinite(DISCOUNT_MIN) ||
  !Number.isFinite(DISCOUNT_MAX) ||
  DISCOUNT_MIN <= 0 ||
  DISCOUNT_MAX >= 1 ||
  DISCOUNT_MIN > DISCOUNT_MAX
) {
  throw new Error(
    `Invalid DISCOUNT_MIN/MAX: ${DISCOUNT_MIN}/${DISCOUNT_MAX}. ` +
      `Must satisfy 0 < min <= max < 1.`
  )
}

// Deterministic [0, 1) drawn from sha256(seed:key) → first 4 bytes / 2^32.
function deterministicUnit(seed: string, key: string): number {
  const hash = crypto.createHash("sha256").update(`${seed}:${key}`).digest()
  return hash.readUInt32BE(0) / 0x1_0000_0000
}

function discountFor(variantId: string): number {
  const r = deterministicUnit(RANDOM_SEED, variantId)
  return DISCOUNT_MIN + r * (DISCOUNT_MAX - DISCOUNT_MIN)
}

// Round to a "natural-looking" amount so the strikethrough doesn't look like
// €1911.11. Heuristic:
//   < 100   → nearest 5
//   < 1000  → nearest 10
//   >= 1000 → nearest 50
function roundNaturally(amount: number): number {
  if (amount < 100) return Math.round(amount / 5) * 5
  if (amount < 1000) return Math.round(amount / 10) * 10
  return Math.round(amount / 50) * 50
}

export default async function markupSoggiornoPranzo({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info(
    `Markup Soggiorno+Pranzo. DRY_RUN=${DRY_RUN}, ` +
      `discount=[${DISCOUNT_MIN}, ${DISCOUNT_MAX}], ` +
      `seed="${RANDOM_SEED}", price_list="${PRICE_LIST_TITLE}".`
  )

  // 1. Resolve target categories.
  const { data: cats } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
    filters: { handle: TARGET_CATEGORY_HANDLES },
  })
  const targetCategoryIds = (cats as any[]).map((c) => c.id)
  if (!targetCategoryIds.length) {
    logger.error(
      `Nicio categorie țintă (${TARGET_CATEGORY_HANDLES.join(", ")}) ` +
        `nu există în DB. Rulează seed-categories înainte.`
    )
    return
  }
  logger.info(
    `${targetCategoryIds.length}/${TARGET_CATEGORY_HANDLES.length} categorii țintă găsite.`
  )

  // 2. Resolve products in those categories. Only published — drafts have
  //    no public price anyway.
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "status",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.prices.price_list_id",
    ],
    filters: {
      categories: { id: targetCategoryIds },
      status: "published",
    } as any,
  })
  logger.info(`${(products as any[]).length} produse published în scope.`)

  if (!(products as any[]).length) {
    logger.info("Nicio produs publicat în Soggiorno/Pranzo. Nothing to do.")
    return
  }

  // 3. Resolve target price list (may not exist yet).
  const { data: lists } = await query.graph({
    entity: "price_list",
    fields: ["id", "title", "status", "type"],
    filters: { title: PRICE_LIST_TITLE },
  })
  const existingPriceList = (lists as any[])[0] ?? null
  if (existingPriceList) {
    logger.info(
      `Price list "${PRICE_LIST_TITLE}" găsit (${existingPriceList.id}, ` +
        `status=${existingPriceList.status}, type=${existingPriceList.type}).`
    )
  } else {
    logger.info(`Price list "${PRICE_LIST_TITLE}" nu există — va fi creat.`)
  }

  // 4. Plan: per variant, decide what to do.
  type Plan = {
    product_id: string
    product_handle: string
    variant_id: string
    variant_title: string
    variant_sku: string | null
    current_base: number
    discount: number
    new_base: number
  }

  const plans: Plan[] = []
  const skipped: { reason: string; what: string }[] = []

  for (const p of products as any[]) {
    for (const v of p.variants ?? []) {
      const eurPrices = (v.prices ?? []).filter(
        (pr: any) => pr.currency_code === CURRENCY
      )
      const basePrice = eurPrices.find((pr: any) => !pr.price_list_id)
      const priceListEntry = eurPrices.find((pr: any) => !!pr.price_list_id)

      if (!basePrice) {
        skipped.push({
          reason: "fără preț de bază EUR",
          what: `${p.handle} / ${v.title}`,
        })
        continue
      }
      if (priceListEntry) {
        // Any price-list-bound EUR price → skip. Covers happy-path re-runs
        // (already in Saldi 2026), partial-failure re-runs where phase 1
        // succeeded, and conflicts with other sales like Lancio Astin.
        skipped.push({
          reason: "are deja un preț în price list (re-run sau conflict)",
          what: `${p.handle} / ${v.title}`,
        })
        continue
      }

      const currentBase = Number(basePrice.amount)
      if (!Number.isFinite(currentBase) || currentBase <= 0) {
        skipped.push({
          reason: `preț de bază invalid (${basePrice.amount})`,
          what: `${p.handle} / ${v.title}`,
        })
        continue
      }

      const d = discountFor(v.id)
      const newBaseRaw = currentBase / (1 - d)
      const newBase = roundNaturally(newBaseRaw)

      // Refuse to go DOWN — would create a sconto > 60% or a negative markup.
      if (newBase <= currentBase) {
        skipped.push({
          reason: `markup ar scădea baza (current=${currentBase}, new=${newBase})`,
          what: `${p.handle} / ${v.title}`,
        })
        continue
      }

      plans.push({
        product_id: p.id,
        product_handle: p.handle,
        variant_id: v.id,
        variant_title: v.title,
        variant_sku: v.sku ?? null,
        current_base: currentBase,
        discount: d,
        new_base: newBase,
      })
    }
  }

  // 5. Report.
  logger.info(
    `Plan: ${plans.length} variante de marcat, ${skipped.length} sărite.`
  )
  if (skipped.length) {
    const byReason = new Map<string, number>()
    for (const s of skipped) {
      byReason.set(s.reason, (byReason.get(s.reason) ?? 0) + 1)
    }
    for (const [r, n] of byReason) logger.info(`  skip [${r}]: ${n}`)
  }

  if (!plans.length) {
    logger.info("Nimic de făcut. Exit.")
    return
  }

  logger.info(`\nPrimele 15 variante planificate:`)
  for (const pl of plans.slice(0, 15)) {
    const shown = (1 - pl.current_base / pl.new_base) * 100
    logger.info(
      `  ${pl.product_handle.padEnd(40)} ${pl.variant_title.padEnd(18)} ` +
        `${pl.current_base} → base ${pl.new_base} ` +
        `(d=${(pl.discount * 100).toFixed(1)}% shown=${shown.toFixed(1)}%)`
    )
  }
  if (plans.length > 15) {
    logger.info(`  …și încă ${plans.length - 15} variante.`)
  }

  if (DRY_RUN) {
    logger.info(`\nDRY_RUN=true. Nimic scris. Folosește DRY_RUN=false pentru live.`)
    return
  }

  // 7a. Inflate base variant prices FIRST. `previousVariantIds` would wipe any
  //     price-list prices on these variants — but since we'll write those in
  //     7b, the order takes care of it.
  const variantUpdates = plans.map((pl) => ({
    variant_id: pl.variant_id,
    product_id: pl.product_id,
    prices: [{ amount: pl.new_base, currency_code: CURRENCY }],
  }))

  await upsertVariantPricesWorkflow(container).run({
    input: {
      variantPrices: variantUpdates,
      previousVariantIds: variantUpdates.map((u) => u.variant_id),
    },
  })
  logger.info(`✓ Actualizat baza pe ${variantUpdates.length} variante.`)

  // 7b. Sale prices into the price list — uses the CURRENT base captured in
  //     the plan, which is the price the customer pays today.
  const salePrices = plans.map((pl) => ({
    variant_id: pl.variant_id,
    amount: pl.current_base,
    currency_code: CURRENCY,
  }))

  try {
    if (!existingPriceList) {
      await createPriceListsWorkflow(container).run({
        input: {
          price_lists_data: [
            {
              title: PRICE_LIST_TITLE,
              name: PRICE_LIST_TITLE,
              description: PRICE_LIST_DESC,
              type: "sale",
              status: "active",
              prices: salePrices,
            },
          ] as any,
        },
      })
      logger.info(
        `✓ Creat price list "${PRICE_LIST_TITLE}" cu ${salePrices.length} prețuri sale.`
      )
    } else {
      await batchPriceListPricesWorkflow(container).run({
        input: {
          data: {
            id: existingPriceList.id,
            create: salePrices,
            update: [],
            delete: [],
          },
        },
      })
      logger.info(
        `✓ Adăugat ${salePrices.length} prețuri sale la "${PRICE_LIST_TITLE}".`
      )
    }
  } catch (err) {
    // Phase 1 already inflated the base — without phase 2 the storefront will
    // show higher prices with no discount. Make this visible so a human can
    // either roll back base prices or replay phase 2 from the admin.
    logger.error(
      `⚠ Phase 2 a EȘUAT după ce Phase 1 a urcat baza pe ${variantUpdates.length} variante. ` +
        `Storefront-ul va arăta prețurile inflatate FĂRĂ sconto până la remediere. ` +
        `Variant_ids afectați: ${variantUpdates.map((u) => u.variant_id).join(",")}`
    )
    throw err
  }

  logger.info(`\nFatto. ${plans.length} variante marcate cu sconto 50-60%.`)
}
