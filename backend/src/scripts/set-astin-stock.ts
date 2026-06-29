import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Configures stock + lead time for the first wave of Astin products.
 *
 * Per variant the script does:
 *   - manage_inventory: true
 *   - ensures one inventory_item + variant link
 *   - ensures one inventory_level at the default stock location
 *   - if the variant size is listed in `in_stock` → that quantity, allow_backorder=false
 *   - otherwise → quantity 0, allow_backorder=true (orderable as "su ordinazione")
 *
 * Per product:
 *   - sets metadata.lead_time_weeks (used by the storefront badge for backorder variants)
 *
 * Idempotent: re-runs update quantities + flags, do not duplicate inventory items.
 *
 * Run:
 *   yarn medusa exec ./src/scripts/set-astin-stock.ts
 *   DRY_RUN=true yarn medusa exec ./src/scripts/set-astin-stock.ts
 */

type AstinStockRow = {
  handle: string
  lead_time_weeks: string
  // size (Option 1 Value, e.g. "160x200") → stocked quantity.
  // Any variant whose size is NOT listed here is set to 0 + backorder.
  in_stock: Record<string, number>
}

/**
 * Fill in `in_stock` per product with the dimensions you actually have in
 * warehouse. Sizes you omit become "su ordinazione" (backorder) with the
 * lead time below shown as a badge on the storefront.
 *
 * Set Lux dimensions: 90x190, 90x200, 100x200, 120x200, 140x190, 150x200,
 * 160x200, 180x200. Materasso varies.
 */
const DATA: AstinStockRow[] = [
  { handle: "set-lux-kuvars",         lead_time_weeks: "4-6", in_stock: {} },
  { handle: "set-lux-cappy",          lead_time_weeks: "4-6", in_stock: {} },
  { handle: "set-lux-piyano",         lead_time_weeks: "4-6", in_stock: {} },
  { handle: "set-lux-sultan",         lead_time_weeks: "4-6", in_stock: {} },
  { handle: "set-lux-amore",          lead_time_weeks: "4-6", in_stock: {} },
  { handle: "set-lux-line",           lead_time_weeks: "4-6", in_stock: {} },
  { handle: "set-grand",              lead_time_weeks: "4-6", in_stock: {} },
  { handle: "set-luna-matrimoniale",  lead_time_weeks: "4-6", in_stock: {} },
  { handle: "set-luna-singolo",       lead_time_weeks: "4-6", in_stock: {} },
  { handle: "set-duke-singolo",       lead_time_weeks: "4-6", in_stock: {} },
  { handle: "set-rose-singolo",       lead_time_weeks: "4-6", in_stock: {} },
  { handle: "materasso-saphire-pedli", lead_time_weeks: "4-6", in_stock: {} },
]

const DRY_RUN = process.env.DRY_RUN === "true"

type ResolvedVariant = {
  variant_id: string
  product_id: string
  product_handle: string
  size: string
  sku: string | null
  manage_inventory: boolean
  allow_backorder: boolean
  inventory_item_id: string | null
  level_id: string | null
  current_stock: number | null
}

const resolveVariants = async (
  query: any,
  handles: string[],
  locationId: string
): Promise<ResolvedVariant[]> => {
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "variants.id",
      "variants.sku",
      "variants.manage_inventory",
      "variants.allow_backorder",
      "variants.options.value",
      "variants.options.option.title",
      "variants.inventory_items.inventory.id",
      "variants.inventory_items.inventory.location_levels.id",
      "variants.inventory_items.inventory.location_levels.location_id",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
    ],
    filters: { handle: handles },
  })

  const resolved: ResolvedVariant[] = []
  for (const p of products as any[]) {
    for (const v of p.variants ?? []) {
      // The Astin import uses a single option "Dimensione" (or "Larghezza"/
      // "Misura"/"Colore" for accessories). Use the first option value.
      const size = v.options?.[0]?.value ?? ""
      const invItem = v.inventory_items?.[0]?.inventory
      const level = invItem?.location_levels?.find(
        (l: any) => l.location_id === locationId
      )
      resolved.push({
        variant_id: v.id,
        product_id: p.id,
        product_handle: p.handle,
        size,
        sku: v.sku ?? null,
        manage_inventory: !!v.manage_inventory,
        allow_backorder: !!v.allow_backorder,
        inventory_item_id: invItem?.id ?? null,
        level_id: level?.id ?? null,
        current_stock: level?.stocked_quantity ?? null,
      })
    }
  }
  return resolved
}

export default async function setAstinStock({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const byHandle = new Map(DATA.map((d) => [d.handle, d]))
  const handles = [...byHandle.keys()]

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  if (!stockLocations?.length) {
    logger.error("Nessuna stock location trovata. Crea una location prima.")
    return
  }
  const defaultLocation = stockLocations[0]
  logger.info(
    `Stock location: ${defaultLocation.name} (${defaultLocation.id}). DRY_RUN=${DRY_RUN}.`
  )

  let variants = await resolveVariants(query, handles, defaultLocation.id)
  if (!variants.length) {
    logger.warn("Nessuna variante trovata per gli handle indicati.")
    return
  }

  // Classify each variant.
  type Plan = {
    v: ResolvedVariant
    target_stock: number
    target_backorder: boolean
  }
  const plans: Plan[] = variants.map((v) => {
    const row = byHandle.get(v.product_handle)!
    const inStock = row.in_stock[v.size]
    if (typeof inStock === "number" && inStock > 0) {
      return { v, target_stock: inStock, target_backorder: false }
    }
    return { v, target_stock: 0, target_backorder: true }
  })

  const needsManageInventoryToggle = plans.filter((p) => !p.v.manage_inventory)
  const needsBackorderToggle = plans.filter(
    (p) => p.v.allow_backorder !== p.target_backorder
  )
  const needsInventoryItem = plans.filter((p) => !p.v.inventory_item_id)

  const stockedCount = plans.filter((p) => p.target_stock > 0).length
  const backorderCount = plans.filter((p) => p.target_backorder).length

  logger.info(
    `Trovate ${variants.length} varianti su ${byHandle.size} prodotti. ` +
      `${stockedCount} con stock, ${backorderCount} su ordinazione.`
  )
  logger.info(
    `Bootstrap: ${needsManageInventoryToggle.length} manage_inventory ON, ` +
      `${needsBackorderToggle.length} allow_backorder da aggiornare, ` +
      `${needsInventoryItem.length} inventory_item da creare.`
  )

  if (DRY_RUN) {
    for (const p of plans) {
      logger.info(
        `  ${p.v.product_handle} ${p.v.size} → stock ${p.v.current_stock ?? "—"} → ${p.target_stock}` +
          ` backorder ${p.v.allow_backorder} → ${p.target_backorder}`
      )
    }
    return
  }

  // ---- Phase 1: flip manage_inventory and allow_backorder ----
  const variantPatches: Array<{
    id: string
    manage_inventory?: boolean
    allow_backorder?: boolean
  }> = []
  for (const p of plans) {
    const patch: { id: string; manage_inventory?: boolean; allow_backorder?: boolean } = {
      id: p.v.variant_id,
    }
    if (!p.v.manage_inventory) patch.manage_inventory = true
    if (p.v.allow_backorder !== p.target_backorder)
      patch.allow_backorder = p.target_backorder
    if (patch.manage_inventory !== undefined || patch.allow_backorder !== undefined) {
      variantPatches.push(patch)
    }
  }
  if (variantPatches.length) {
    logger.info(`Aggiornamento di ${variantPatches.length} varianti (manage_inventory/backorder)…`)
    await updateProductVariantsWorkflow(container).run({
      input: { product_variants: variantPatches },
    })
  }

  // ---- Phase 2: create missing inventory items + variant links (with initial level) ----
  if (needsInventoryItem.length) {
    logger.info(
      `Creazione di ${needsInventoryItem.length} inventory_item + livello iniziale…`
    )
    const itemInputs = needsInventoryItem.map((p) => ({
      sku: p.v.sku ?? `${p.v.product_handle}-${p.v.size}`,
      location_levels: [
        {
          location_id: defaultLocation.id,
          stocked_quantity: p.target_stock,
        },
      ],
    }))
    const { result: createdItems } = await createInventoryItemsWorkflow(container).run({
      input: { items: itemInputs },
    })

    const itemBySku = new Map<string, string>()
    for (const item of createdItems as any[]) {
      if (item.sku) itemBySku.set(item.sku, item.id)
    }

    const linksToCreate = needsInventoryItem
      .map((p) => {
        const sku = p.v.sku ?? `${p.v.product_handle}-${p.v.size}`
        const inventoryItemId = itemBySku.get(sku)
        if (!inventoryItemId) return null
        return {
          [Modules.PRODUCT]: { variant_id: p.v.variant_id },
          [Modules.INVENTORY]: { inventory_item_id: inventoryItemId },
        }
      })
      .filter((l): l is NonNullable<typeof l> => !!l)

    if (linksToCreate.length) {
      await link.create(linksToCreate)
      logger.info(`✓ Creati ${linksToCreate.length} link variant ↔ inventory_item.`)
    }
  }

  // ---- Phase 3: re-resolve to pick up new items + levels ----
  if (needsInventoryItem.length) {
    variants = await resolveVariants(query, handles, defaultLocation.id)
  }

  // ---- Phase 4: ensure inventory levels for remaining variants ----
  const justBootstrapped = new Set(needsInventoryItem.map((p) => p.v.variant_id))
  const remaining = variants.filter((v) => !justBootstrapped.has(v.variant_id))

  const levelsToCreate: Array<{ inventory_item_id: string; location_id: string; stocked_quantity: number }> = []
  const levelsToUpdate: Array<{ id: string; inventory_item_id: string; location_id: string; stocked_quantity: number }> = []

  for (const v of remaining) {
    const row = byHandle.get(v.product_handle)!
    const inStock = row.in_stock[v.size]
    const target = typeof inStock === "number" && inStock > 0 ? inStock : 0
    if (!v.inventory_item_id) continue // shouldn't happen after phase 3
    if (v.level_id) {
      if (v.current_stock !== target) {
        levelsToUpdate.push({
          id: v.level_id,
          inventory_item_id: v.inventory_item_id,
          location_id: defaultLocation.id,
          stocked_quantity: target,
        })
      }
    } else {
      levelsToCreate.push({
        inventory_item_id: v.inventory_item_id,
        location_id: defaultLocation.id,
        stocked_quantity: target,
      })
    }
  }

  if (levelsToCreate.length) {
    logger.info(`Creazione di ${levelsToCreate.length} inventory levels…`)
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: levelsToCreate },
    })
  }
  if (levelsToUpdate.length) {
    logger.info(`Aggiornamento di ${levelsToUpdate.length} inventory levels…`)
    await updateInventoryLevelsWorkflow(container).run({
      input: { updates: levelsToUpdate },
    })
  }

  // ---- Phase 5: product metadata (lead_time_weeks) ----
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "metadata"],
    filters: { handle: handles },
  })
  const metaUpdates = (products as any[])
    .map((p) => {
      const row = byHandle.get(p.handle)
      if (!row) return null
      const current = p.metadata?.lead_time_weeks
      if (current === row.lead_time_weeks) return null
      return {
        id: p.id,
        metadata: { ...(p.metadata ?? {}), lead_time_weeks: row.lead_time_weeks },
      }
    })
    .filter((u): u is { id: string; metadata: any } => !!u)

  for (const u of metaUpdates) {
    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: u.id },
        update: { metadata: u.metadata },
      },
    })
  }
  if (metaUpdates.length) {
    logger.info(`✓ Metadata lead_time_weeks aggiornato su ${metaUpdates.length} prodotti.`)
  }

  logger.info(
    `Fatto. ${stockedCount} varianti in stock, ${backorderCount} su ordinazione, ` +
      `${needsInventoryItem.length} inventory_item creati, ` +
      `${levelsToCreate.length} levels creati, ${levelsToUpdate.length} levels aggiornati.`
  )
}
