import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Inspects all products in the Soggiorno + Sala da pranzo category trees so we
 * know exactly what's in scope before we run a fake-markup / sale migration on
 * them.
 *
 * Reports:
 *   - product count per leaf category
 *   - variants with and without base EUR prices
 *   - existing Price List membership (e.g. if any of these are already in
 *     "Lancio Astin" or another sale list, we'd want to know)
 *   - a sample of the cheapest / most expensive variants
 *
 * Run:
 *   yarn medusa exec ./src/scripts/inspect-soggiorno-pranzo.ts
 */

const TARGET_CATEGORY_HANDLES = [
  "soggiorno",
  "divani",
  "poltrone",
  "sala-da-pranzo",
  "sedie",
]

const CURRENCY = (process.env.IMPORT_CURRENCY || "eur").toLowerCase()

export default async function inspectSoggiornoPranzo({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // 1. Resolve target categories.
  const { data: cats } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "parent_category_id"],
    filters: { handle: TARGET_CATEGORY_HANDLES },
  })
  const byHandle = new Map<string, any>(
    (cats as any[]).map((c) => [c.handle, c])
  )
  const missing = TARGET_CATEGORY_HANDLES.filter((h) => !byHandle.has(h))
  if (missing.length) {
    logger.warn(`Categorii lipsă în DB: ${missing.join(", ")}`)
  }
  const targetCategoryIds = (cats as any[]).map((c) => c.id)
  logger.info(
    `Categorii țintă: ${TARGET_CATEGORY_HANDLES.join(", ")} → ${
      targetCategoryIds.length
    } găsite.`
  )

  if (!targetCategoryIds.length) {
    logger.error("Nicio categorie țintă găsită. Rulează seed-categories înainte.")
    return
  }

  // 2. Fetch all products in any of these categories.
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "title",
      "status",
      "tags.value",
      "categories.id",
      "categories.handle",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.prices.id",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.prices.price_list_id",
    ],
    filters: { categories: { id: targetCategoryIds } } as any,
  })

  type Variant = {
    id: string
    title: string
    sku: string | null
    base_eur: number | null
    has_price_list_price: boolean
  }
  type Product = {
    id: string
    handle: string
    title: string
    status: string
    tags: string[]
    category_handles: string[]
    variants: Variant[]
  }

  const normalized: Product[] = (products as any[]).map((p) => ({
    id: p.id,
    handle: p.handle,
    title: p.title,
    status: p.status,
    tags: (p.tags ?? []).map((t: any) => t.value),
    category_handles: (p.categories ?? []).map((c: any) => c.handle),
    variants: (p.variants ?? []).map((v: any) => {
      const eurPrices = (v.prices ?? []).filter(
        (pr: any) => pr.currency_code === CURRENCY
      )
      const basePrice = eurPrices.find((pr: any) => !pr.price_list_id)
      const hasPriceListPrice = eurPrices.some((pr: any) => !!pr.price_list_id)
      return {
        id: v.id,
        title: v.title,
        sku: v.sku ?? null,
        base_eur: basePrice ? Number(basePrice.amount) : null,
        has_price_list_price: hasPriceListPrice,
      }
    }),
  }))

  logger.info(`\n══ Sumar produse ══`)
  logger.info(`Total produse în Soggiorno + Sala da pranzo: ${normalized.length}`)

  // 3. Per-category breakdown.
  const perCategory = new Map<string, number>()
  for (const p of normalized) {
    for (const h of p.category_handles) {
      if (TARGET_CATEGORY_HANDLES.includes(h)) {
        perCategory.set(h, (perCategory.get(h) ?? 0) + 1)
      }
    }
  }
  logger.info(`\nProduse pe categorie (un produs poate fi în mai multe):`)
  for (const h of TARGET_CATEGORY_HANDLES) {
    logger.info(`  ${h.padEnd(18)} ${perCategory.get(h) ?? 0}`)
  }

  // 4. Status breakdown.
  const byStatus = new Map<string, number>()
  for (const p of normalized) {
    byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1)
  }
  logger.info(`\nStatus:`)
  for (const [s, n] of byStatus) logger.info(`  ${s.padEnd(12)} ${n}`)

  // 5. Variant + price stats.
  const allVariants = normalized.flatMap((p) =>
    p.variants.map((v) => ({ ...v, product_handle: p.handle, status: p.status }))
  )
  const publishedVariants = allVariants.filter((v) => v.status === "published")
  const withBase = publishedVariants.filter((v) => v.base_eur !== null)
  const withoutBase = publishedVariants.filter((v) => v.base_eur === null)
  const alreadyOnSale = publishedVariants.filter((v) => v.has_price_list_price)

  logger.info(`\n══ Varianti (doar status=published) ══`)
  logger.info(`Total variante:                ${publishedVariants.length}`)
  logger.info(`  cu preț de bază EUR:         ${withBase.length}`)
  logger.info(`  fără preț de bază EUR:       ${withoutBase.length}`)
  logger.info(`  deja într-un price list EUR: ${alreadyOnSale.length}`)

  if (withBase.length) {
    const amounts = withBase
      .map((v) => v.base_eur!)
      .sort((a, b) => a - b)
    const sum = amounts.reduce((a, b) => a + b, 0)
    const median = amounts[Math.floor(amounts.length / 2)]
    logger.info(
      `\nPreț bază EUR — min=${amounts[0]} max=${amounts[amounts.length - 1]} ` +
        `median=${median} avg=${(sum / amounts.length).toFixed(2)}`
    )
  }

  // 6. Variants without a base price — we'd skip these in the migration.
  if (withoutBase.length) {
    logger.warn(`\nVariante fără preț de bază (vor fi sărite la migrare):`)
    for (const v of withoutBase.slice(0, 15)) {
      logger.warn(`  ${v.product_handle} / ${v.title} (${v.sku ?? "no-sku"})`)
    }
    if (withoutBase.length > 15) {
      logger.warn(`  …și încă ${withoutBase.length - 15}.`)
    }
  }

  // 7. Variants already on a price list — conflict warning.
  if (alreadyOnSale.length) {
    logger.warn(
      `\nVariante deja într-un price list (overlap potențial cu price list "Saldi"):`
    )
    for (const v of alreadyOnSale.slice(0, 15)) {
      logger.warn(
        `  ${v.product_handle} / ${v.title} base=${v.base_eur ?? "—"}`
      )
    }
    if (alreadyOnSale.length > 15) {
      logger.warn(`  …și încă ${alreadyOnSale.length - 15}.`)
    }
  }

  // 8. Sample listing for transparency.
  logger.info(`\n══ Eșantion produse (primele 20) ══`)
  for (const p of normalized.slice(0, 20)) {
    const cats = p.category_handles
      .filter((h) => TARGET_CATEGORY_HANDLES.includes(h))
      .join(",")
    const priceSummary = p.variants
      .map((v) => v.base_eur ?? "—")
      .join("/")
    logger.info(
      `  [${p.status[0]}] ${p.handle.padEnd(36)} ${cats.padEnd(28)} ` +
        `${p.variants.length}v prețuri=${priceSummary}`
    )
  }
  if (normalized.length > 20) {
    logger.info(`  …și încă ${normalized.length - 20} produse.`)
  }

  // 9. Existing price lists summary (sanity).
  const { data: lists } = await query.graph({
    entity: "price_list",
    fields: ["id", "title", "status", "type"],
  })
  logger.info(`\n══ Price lists existente ══`)
  for (const pl of lists as any[]) {
    logger.info(`  [${pl.status}] ${pl.title} (type=${pl.type})`)
  }
}
