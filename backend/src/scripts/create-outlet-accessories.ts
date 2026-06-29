import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  updateProductsWorkflow,
  batchPriceListPricesWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Creates outlet accessory products surfaced as checkboxes on every bed
 * product page (via the existing `metadata.upgrades` mechanism), then writes
 * the right handles into each bed's metadata.
 *
 *   Materasso (set Astin)            base €600, outlet €400  → -33%   [matrimoniali]
 *   Materasso singolo (set Astin)    base €350, outlet €200  → -43%   [singoli]
 *   Panca contenitore                base €300, outlet €150  → -50%   [tutti]
 *   2 Comodini abbinati              base €300, outlet €150  → -50%   [tutti]
 *
 * The outlet (sale) prices are added to the active "Lancio Astin" price list,
 * so the storefront renders them as strikethrough original + sale.
 *
 * Run:
 *   yarn medusa exec ./src/scripts/create-outlet-accessories.ts
 *   DRY_RUN=true yarn medusa exec ./src/scripts/create-outlet-accessories.ts
 *
 * Idempotent: products are skipped if a matching handle already exists; bed
 * metadata is reconciled to the desired upgrades per bed type (singoli get the
 * singolo mattress and never the matrimoniale one, and vice versa).
 */

const CURRENCY = (process.env.IMPORT_CURRENCY || "eur").toLowerCase()
const PRICE_LIST_TITLE = process.env.PRICE_LIST_TITLE ?? "Lancio Astin"
const DRY_RUN = process.env.DRY_RUN === "true"

const MATRIMONIALI_HANDLES = [
  "set-lux-amore", "set-lux-cappy", "set-lux-kuvars", "set-lux-latte",
  "set-lux-leon", "set-lux-linda", "set-lux-line", "set-lux-picasso",
  "set-lux-piyano", "set-lux-platinium", "set-lux-smeraldo", "set-lux-sultan",
  "set-lux-vita", "set-grand", "set-camelli",
  "set-luna-matrimoniale", "set-odessa-matrimoniale", "set-kristal-matrimoniale",
  "set-perla-matrimoniale",
]

const SINGOLI_HANDLES = [
  "set-duke-singolo", "set-rose-singolo", "set-latte-singolo",
  "set-kristal-singolo", "set-luna-singolo", "set-odessa-singolo",
  "set-perla-singolo",
]

const BED_HANDLES = [...MATRIMONIALI_HANDLES, ...SINGOLI_HANDLES]

// Mattress that should NOT appear on the opposite bed type.
const MATTRESS_MATRIMONIALE_HANDLE = "outlet-materasso-set"
const MATTRESS_SINGOLO_HANDLE = "outlet-materasso-singolo"
const COMMON_UPGRADE_HANDLES = ["outlet-panca-contenitore", "outlet-2-comodini"]

function desiredUpgradesFor(bedHandle: string): string[] {
  const isSingolo = SINGOLI_HANDLES.includes(bedHandle)
  const mattress = isSingolo
    ? MATTRESS_SINGOLO_HANDLE
    : MATTRESS_MATRIMONIALE_HANDLE
  return [mattress, ...COMMON_UPGRADE_HANDLES]
}

// Handles that must be stripped from a bed's upgrades because they belong to
// the other bed type. (Currently just the cross-type mattress.)
function strayUpgradesFor(bedHandle: string): string[] {
  const isSingolo = SINGOLI_HANDLES.includes(bedHandle)
  return [isSingolo ? MATTRESS_MATRIMONIALE_HANDLE : MATTRESS_SINGOLO_HANDLE]
}

type OutletProduct = {
  handle: string
  title: string
  subtitle: string
  description: string
  original_amount: number
  sale_amount: number
}

const OUTLET_PRODUCTS: OutletProduct[] = [
  {
    handle: "outlet-materasso-set",
    title: "Materasso (set Astin)",
    subtitle: "Aggiungilo al tuo set letto",
    description:
      "Materasso abbinato al set letto Astin scelto. Prezzo outlet riservato " +
      "all'acquisto insieme al letto. Il modello (Saphire Pedli, Diamond, Perla, " +
      "Kristal, Ultra Pocket, Kuvars o Intense) è quello indicato nella " +
      "descrizione del set selezionato.",
    original_amount: 600,
    sale_amount: 400,
  },
  {
    handle: "outlet-materasso-singolo",
    title: "Materasso singolo (set Astin)",
    subtitle: "Aggiungilo al tuo set letto",
    description:
      "Materasso singolo abbinato al set letto Astin scelto. Prezzo outlet " +
      "riservato all'acquisto insieme al letto. Il modello è quello indicato " +
      "nella descrizione del set selezionato.",
    original_amount: 350,
    sale_amount: 200,
  },
  {
    handle: "outlet-panca-contenitore",
    title: "Panca contenitore",
    subtitle: "Aggiungila al tuo set letto",
    description:
      "Panca a fine letto con vano contenitore. Tutto allo stesso colore " +
      "del letto. Prezzo outlet riservato all'acquisto insieme al letto.",
    original_amount: 300,
    sale_amount: 150,
  },
  {
    handle: "outlet-2-comodini",
    title: "2 Comodini abbinati",
    subtitle: "Aggiungili al tuo set letto",
    description:
      "Coppia di comodini abbinati al set letto. Tutto allo stesso colore " +
      "del letto. Prezzo outlet riservato all'acquisto insieme al letto.",
    original_amount: 300,
    sale_amount: 150,
  },
]

const UPGRADE_HANDLES = OUTLET_PRODUCTS.map((p) => p.handle)

export default async function createOutletAccessories({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)

  logger.info(`Outlet accessories bootstrap. DRY_RUN=${DRY_RUN}`)

  // ---- Resolve sales channel + shipping profile ----
  const channels = await salesChannelService.listSalesChannels()
  if (!channels.length) throw new Error("No sales channels found.")
  const defaultChannel =
    channels.find((c) => c.name === "Default Sales Channel") ?? channels[0]
  const shippingProfiles = await fulfillmentService.listShippingProfiles()
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) throw new Error("No shipping profile found.")

  // ---- Resolve price list ----
  const { data: lists } = await query.graph({
    entity: "price_list",
    fields: ["id", "title", "status"],
    filters: { title: PRICE_LIST_TITLE },
  })
  const priceList = (lists as any[])[0]
  if (!priceList) throw new Error(`Price list "${PRICE_LIST_TITLE}" not found.`)
  logger.info(`Price list: ${priceList.title} (${priceList.id})`)

  // ---- Check existing outlet products ----
  const { data: existingOutlet } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id"],
    filters: { handle: UPGRADE_HANDLES },
  })
  const existingByHandle = new Map<string, any>(
    (existingOutlet as any[]).map((p) => [p.handle, p])
  )
  const missing = OUTLET_PRODUCTS.filter((o) => !existingByHandle.has(o.handle))
  logger.info(
    `Outlet products: ${existingByHandle.size}/${OUTLET_PRODUCTS.length} already exist, ${missing.length} to create.`
  )

  // ---- Step 1: create missing outlet products ----
  let createdProducts: any[] = []
  if (missing.length && !DRY_RUN) {
    const productInputs = missing.map((o) => ({
      title: o.title,
      handle: o.handle,
      subtitle: o.subtitle,
      description: o.description,
      status: ProductStatus.PUBLISHED,
      discountable: true,
      shipping_profile_id: shippingProfile.id,
      sales_channels: [{ id: defaultChannel.id }],
      options: [{ title: "Default", values: ["Standard"] }],
      variants: [
        {
          title: "Standard",
          sku: o.handle,
          manage_inventory: false,
          allow_backorder: true,
          options: { Default: "Standard" },
          prices: [
            { amount: o.original_amount, currency_code: CURRENCY },
          ],
        },
      ],
    }))
    const { result } = await createProductsWorkflow(container).run({
      input: { products: productInputs as any },
    })
    createdProducts = result as any[]
    logger.info(`✓ Created ${createdProducts.length} outlet products.`)
  } else if (missing.length && DRY_RUN) {
    logger.info(`DRY_RUN: would create ${missing.length} outlet products:`)
    for (const m of missing) {
      logger.info(`  ${m.handle} (${m.title}) base=${m.original_amount} sale=${m.sale_amount}`)
    }
  } else {
    logger.info("All outlet products already exist; skipping create.")
  }

  // ---- Step 2: ensure sale prices in price list ----
  // Re-query so we have variants for both pre-existing and newly created ones.
  const { data: outletNow } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id"],
    filters: { handle: UPGRADE_HANDLES },
  })
  const outletByHandle = new Map<string, any>(
    (outletNow as any[]).map((p) => [p.handle, p])
  )

  const { data: listPrices } = await query.graph({
    entity: "price_list",
    fields: ["id", "prices.id", "prices.variant.id"],
    filters: { id: priceList.id },
  })
  const variantsAlreadyInList = new Set<string>(
    ((listPrices as any[])[0]?.prices ?? [])
      .map((pr: any) => pr.variant?.id)
      .filter((id: any): id is string => !!id)
  )

  const salePricesToCreate: { variant_id: string; amount: number; currency_code: string }[] = []
  for (const o of OUTLET_PRODUCTS) {
    const product = outletByHandle.get(o.handle)
    if (!product) {
      if (!DRY_RUN) logger.warn(`Outlet product ${o.handle} not in DB — skipping sale price`)
      continue
    }
    for (const v of product.variants ?? []) {
      if (variantsAlreadyInList.has(v.id)) continue
      salePricesToCreate.push({
        variant_id: v.id,
        amount: o.sale_amount,
        currency_code: CURRENCY,
      })
    }
  }
  logger.info(
    `Sale prices: ${salePricesToCreate.length} to add to "${priceList.title}".`
  )

  if (salePricesToCreate.length && !DRY_RUN) {
    await batchPriceListPricesWorkflow(container).run({
      input: {
        data: {
          id: priceList.id,
          create: salePricesToCreate,
          update: [],
          delete: [],
        },
      },
    })
    logger.info(`✓ Added ${salePricesToCreate.length} outlet sale prices.`)
  }

  // ---- Step 3: write metadata.upgrades on each bed product ----
  const { data: beds } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "metadata"],
    filters: { handle: BED_HANDLES },
  })

  const metadataUpdates: { id: string; metadata: any }[] = []
  for (const b of beds as any[]) {
    const current = (b.metadata ?? {}) as Record<string, any>
    const currentUpgrades: string[] = Array.isArray(current.upgrades)
      ? current.upgrades
      : []
    const desired = desiredUpgradesFor(b.handle)
    const strays = strayUpgradesFor(b.handle)
    // Add desired, remove strays, preserve any other custom handles already there.
    const next = Array.from(
      new Set([
        ...currentUpgrades.filter((h) => !strays.includes(h)),
        ...desired,
      ])
    )
    const unchanged =
      next.length === currentUpgrades.length &&
      next.every((h) => currentUpgrades.includes(h))
    if (unchanged) continue
    metadataUpdates.push({
      id: b.id,
      metadata: { ...current, upgrades: next },
    })
  }
  logger.info(
    `Bed metadata: ${metadataUpdates.length} of ${BED_HANDLES.length} need upgrades updated.`
  )

  if (metadataUpdates.length && !DRY_RUN) {
    for (const u of metadataUpdates) {
      await updateProductsWorkflow(container).run({
        input: { selector: { id: u.id }, update: { metadata: u.metadata } },
      })
    }
    logger.info(`✓ Updated metadata on ${metadataUpdates.length} beds.`)
  } else if (metadataUpdates.length && DRY_RUN) {
    logger.info(`DRY_RUN: would set upgrades on ${metadataUpdates.length} beds.`)
  }

  logger.info(`Fatto.`)
}
