import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  upsertVariantPricesWorkflow,
  updateProductVariantsWorkflow,
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"

const CURRENCY = (process.env.IMPORT_CURRENCY || "eur").toLowerCase()
const DRY_RUN = process.env.DRY_RUN === "true"
const ENABLE_INVENTORY = process.env.ENABLE_INVENTORY === "true"

type ListinoRow = {
  row: number
  sku: string
  price?: number
  stock?: number
  note?: string
}

// Listino prezzato il 18/05/2026 — 45 prodotti.
// Note:
//   - price: prezzo di vendita in EUR (omesso = nessun aggiornamento prezzo)
//   - stock: quantità a magazzino (omesso = nessun aggiornamento inventario)
//   - Righe assenti (16, 41, 45) = nessun dato fornito, saltate.
const DATA: ListinoRow[] = [
  { row: 1, sku: "ARV-PANNA-PAN-001", price: 120, stock: 24 },
  { row: 2, sku: "ARV-BIANCO-BIA-002", stock: 0, note: "nu mai este" },
  { row: 3, sku: "ARV-ETB-ST34S-SCHWARZ-PR-ANT-007", stock: 85 },
  { row: 4, sku: "ARV-2-COG-004", price: 6, stock: 100 },
  { row: 5, sku: "ARV-JERSEY-COGNAC-COG-003", price: 6, stock: 100 },
  { row: 6, sku: "ARV-GIALLO-GIA-005", price: 12, stock: 90 },
  { row: 7, sku: "ARV-2-ANT-006", price: 8, stock: 120 },
  { row: 8, sku: "ARV-GELDERN-GRI-008", price: 12, stock: 120 },
  { row: 9, sku: "ARV-HOBBS-STIL-NER-014", price: 14, stock: 100 },
  { row: 10, sku: "ARV-2-COG-011", price: 120 },
  { row: 11, sku: "ARV-ARIEL-GIA-010", price: 12, note: "la fel cu row 6" },
  { row: 12, sku: "ARV-2-TAL-009", price: 120, stock: 1 },
  { row: 13, sku: "ARV-ETB-ST34S-NER-012", price: 14, note: "la fel cu row 9" },
  { row: 14, sku: "ARV-2-ANT-013", price: 8, note: "la fel cu row 7" },
  { row: 15, sku: "ARV-BIANCO-BIA-021", stock: 0, note: "vândut" },
  // row 16 ARV-ANGOLARE-GRI-016: tăiat cu pix, skip complet
  { row: 17, sku: "ARV-ANGOLARE-MAR-019", stock: 0, note: "vândut" },
  { row: 18, sku: "ARV-ANGOLARE-NER-017", price: 860, stock: 1 },
  { row: 19, sku: "ARV-ANGOLARE-BEI-015", price: 860, stock: 1 },
  { row: 20, sku: "ARV-ANGOLARE-COG-018", price: 1300, note: "la fel cu row 33" },
  { row: 21, sku: "ARV-ANGOLARE-BEI-020", stock: 0, note: "dublură" },
  { row: 22, sku: "ARV-GRIGIO-GRI-026", stock: 0, note: "dublură" },
  { row: 23, sku: "ARV-ANGOLARE-CAM-023", stock: 0, note: "dublură" },
  { row: 24, sku: "ARV-ANGOLARE-CAM-024", stock: 0, note: "vândut" },
  { row: 25, sku: "ARV-ANGOLARE-ANT-025", stock: 0, note: "vândut" },
  { row: 26, sku: "ARV-ANTRACITE-ANT-027", stock: 0, note: "vândut" },
  { row: 27, sku: "ARV-CHESTERFIELD-VER-022", stock: 0, note: "vândut" },
  { row: 28, sku: "ARV-VERDE-VER-028", stock: 0, note: "vândut" },
  { row: 29, sku: "ARV-ANGOLARE-PAN-034", stock: 0, note: "vândut" },
  { row: 30, sku: "ARV-ANGOLARE-PAN-030", stock: 0, note: "vândut" },
  { row: 31, sku: "ARV-BIANCO-BIA-033", price: 450, stock: 1 },
  { row: 32, sku: "ARV-ANGOLARE-GRI-029", stock: 0, note: "dublură" },
  { row: 33, sku: "ARV-ANGOLARE-BEI-032", price: 1300, stock: 1 },
  { row: 34, sku: "ARV-ANGOLARE-BIA-031", stock: 0, note: "dublură" },
  { row: 35, sku: "ARV-GRIGIO-GRI-035", price: 320, stock: 1 },
  { row: 36, sku: "ARV-ANGOLARE-ANT-036", price: 850, stock: 1 },
  { row: 37, sku: "ARV-COGNAC-COG-040", price: 1600, stock: 1 },
  { row: 38, sku: "ARV-ANGOLARE-PAN-037", price: 1600, stock: 1, note: "la fel cu row 37" },
  { row: 39, sku: "ARV-COGNAC-COG-039", price: 320, stock: 1 },
  { row: 40, sku: "ARV-COGNAC-COG-038", stock: 0, note: "dublură" },
  // row 41 ARV-2-VER-044: gol, skip
  { row: 42, sku: "ARV-ANGOLARE-NER-041", stock: 0, note: "dublură" },
  { row: 43, sku: "ARV-NERO-NER-042", stock: 0, note: "dublură" },
  { row: 44, sku: "ARV-HOBBS-PAN-043", price: 120 },
  // row 45 ARV-HOBBS-GREEN-VER-045: gol, skip
]

type ResolvedVariant = {
  variant_id: string
  product_id: string
  sku: string
  manage_inventory: boolean
  inventory_item_id: string | null
  level_id: string | null
  current_stock: number | null
}

const resolveVariants = async (
  query: any,
  skus: string[],
  locationId: string
): Promise<Map<string, ResolvedVariant>> => {
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "sku",
      "product_id",
      "manage_inventory",
      "inventory_items.inventory.id",
      "inventory_items.inventory.location_levels.id",
      "inventory_items.inventory.location_levels.location_id",
      "inventory_items.inventory.location_levels.stocked_quantity",
    ],
    filters: { sku: skus },
  })

  const bySku = new Map<string, ResolvedVariant>()
  for (const v of variants as any[]) {
    if (!v.sku) continue
    const invItem = v.inventory_items?.[0]?.inventory
    const level = invItem?.location_levels?.find(
      (l: any) => l.location_id === locationId
    )
    bySku.set(v.sku, {
      variant_id: v.id,
      product_id: v.product_id,
      sku: v.sku,
      manage_inventory: !!v.manage_inventory,
      inventory_item_id: invItem?.id ?? null,
      level_id: level?.id ?? null,
      current_stock: level?.stocked_quantity ?? null,
    })
  }
  return bySku
}

export default async function updateArredovitaListino({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  logger.info(
    `Listino: ${DATA.length} righe. DRY_RUN=${DRY_RUN}, ENABLE_INVENTORY=${ENABLE_INVENTORY}.`
  )

  const skus = Array.from(new Set(DATA.map((d) => d.sku)))

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
    `Stock location predefinita: ${defaultLocation.name} (${defaultLocation.id})`
  )

  let bySku = await resolveVariants(query, skus, defaultLocation.id)

  const missing: ListinoRow[] = []
  const planned: {
    row: ListinoRow
    resolved: ResolvedVariant
  }[] = []

  for (const row of DATA) {
    const v = bySku.get(row.sku)
    if (!v) {
      missing.push(row)
      continue
    }
    planned.push({ row, resolved: v })
  }

  const priceUpdates = planned.filter((p) => typeof p.row.price === "number")
  const stockUpdates = planned.filter((p) => typeof p.row.stock === "number")

  const needsManageInventoryToggle = stockUpdates.filter(
    (p) => !p.resolved.manage_inventory
  )
  const needsInventoryItemCreate = stockUpdates.filter(
    (p) => !p.resolved.inventory_item_id
  )

  logger.info(
    `Planificat: ${priceUpdates.length} prezzi, ${stockUpdates.length} stock.`
  )
  if (missing.length) {
    logger.warn(`${missing.length} SKU non trovati (saranno saltati):`)
    for (const m of missing) logger.warn(`  row ${m.row}: ${m.sku}`)
  }
  logger.info(
    `Inventory bootstrap: ${needsManageInventoryToggle.length} varianti da attivare (manage_inventory), ` +
      `${needsInventoryItemCreate.length} inventory_item da creare.`
  )

  const needsBootstrap =
    needsManageInventoryToggle.length || needsInventoryItemCreate.length

  if (needsBootstrap && !ENABLE_INVENTORY) {
    logger.warn(
      `Alcune varianti richiedono manage_inventory=true e/o creazione di inventory_item. ` +
        `Lo stock NON sarà aggiornato. ` +
        `Rilancia con ENABLE_INVENTORY=true per attivarle automaticamente.`
    )
  }

  if (DRY_RUN) {
    logger.info("DRY_RUN=true — nessuna scrittura. Anteprima:")
    for (const p of priceUpdates) {
      logger.info(`  PRICE  ${p.row.sku} → ${p.row.price} €`)
    }
    for (const p of stockUpdates) {
      const v = p.resolved
      let action: string
      if (!v.inventory_item_id) action = "CREATE_ITEM+LEVEL"
      else if (!v.level_id) action = "CREATE_LEVEL"
      else action = "UPDATE_LEVEL"

      const flags: string[] = []
      if (!v.manage_inventory)
        flags.push(ENABLE_INVENTORY ? "→manage_inventory ON" : "manage_inventory OFF")
      if (!v.inventory_item_id && !ENABLE_INVENTORY) flags.push("BLOCCATO")

      logger.info(
        `  STOCK  ${p.row.sku} ${v.current_stock ?? "—"} → ${p.row.stock} [${action}]` +
          (flags.length ? `  (${flags.join(", ")})` : "")
      )
    }
    return
  }

  // ---- Phase 1: toggle manage_inventory=true ----
  if (ENABLE_INVENTORY && needsManageInventoryToggle.length) {
    logger.info(
      `Attivazione manage_inventory su ${needsManageInventoryToggle.length} varianti…`
    )
    await updateProductVariantsWorkflow(container).run({
      input: {
        product_variants: needsManageInventoryToggle.map((p) => ({
          id: p.resolved.variant_id,
          manage_inventory: true,
        })),
      },
    })
  }

  // ---- Phase 2: create inventory_items + link + initial level ----
  if (ENABLE_INVENTORY && needsInventoryItemCreate.length) {
    logger.info(
      `Creazione di ${needsInventoryItemCreate.length} inventory_item + link + livello iniziale…`
    )
    const itemInputs = needsInventoryItemCreate.map((p) => ({
      sku: p.resolved.sku,
      location_levels: [
        {
          location_id: defaultLocation.id,
          stocked_quantity: p.row.stock!,
        },
      ],
    }))
    const { result: createdItems } = await createInventoryItemsWorkflow(
      container
    ).run({ input: { items: itemInputs } })

    const itemBySku = new Map<string, string>()
    for (const item of createdItems as any[]) {
      if (item.sku) itemBySku.set(item.sku, item.id)
    }

    const linksToCreate = needsInventoryItemCreate
      .map((p) => {
        const inventoryItemId = itemBySku.get(p.resolved.sku)
        if (!inventoryItemId) return null
        return {
          [Modules.PRODUCT]: { variant_id: p.resolved.variant_id },
          [Modules.INVENTORY]: { inventory_item_id: inventoryItemId },
        }
      })
      .filter((l): l is NonNullable<typeof l> => !!l)

    if (linksToCreate.length) {
      await link.create(linksToCreate)
      logger.info(`✓ Creati ${linksToCreate.length} link variant ↔ inventory_item.`)
    }
  }

  // ---- Phase 3: re-resolve variants to pick up new inventory items + levels ----
  if (ENABLE_INVENTORY && needsBootstrap) {
    bySku = await resolveVariants(query, skus, defaultLocation.id)
  }

  // ---- Phase 4: prices ----
  if (priceUpdates.length) {
    logger.info(`Aggiornamento prezzi: ${priceUpdates.length} varianti…`)
    await upsertVariantPricesWorkflow(container).run({
      input: {
        variantPrices: priceUpdates.map((p) => ({
          variant_id: p.resolved.variant_id,
          product_id: p.resolved.product_id,
          prices: [
            {
              amount: p.row.price!,
              currency_code: CURRENCY,
            },
          ],
        })),
        previousVariantIds: priceUpdates.map((p) => p.resolved.variant_id),
      },
    })
    logger.info(`✓ Prezzi aggiornati.`)
  }

  // ---- Phase 5: remaining stock updates (variants that already had inventory_item) ----
  const remainingStock = stockUpdates
    .map((p) => ({ row: p.row, resolved: bySku.get(p.row.sku) }))
    .filter(
      (p): p is { row: ListinoRow; resolved: ResolvedVariant } =>
        !!p.resolved && !!p.resolved.inventory_item_id
    )

  // Skip variants that we just created via Phase 2 (their level was set inline).
  const justCreated = new Set(needsInventoryItemCreate.map((p) => p.row.sku))

  const toCreate = remainingStock.filter(
    (p) => !p.resolved.level_id && !justCreated.has(p.row.sku)
  )
  const toUpdate = remainingStock.filter((p) => !!p.resolved.level_id)

  if (toCreate.length) {
    logger.info(`Creazione di ${toCreate.length} inventory levels…`)
    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: toCreate.map((p) => ({
          inventory_item_id: p.resolved.inventory_item_id!,
          location_id: defaultLocation.id,
          stocked_quantity: p.row.stock!,
        })),
      },
    })
    logger.info(`✓ Inventory levels creati.`)
  }

  if (toUpdate.length) {
    logger.info(`Aggiornamento di ${toUpdate.length} inventory levels…`)
    await updateInventoryLevelsWorkflow(container).run({
      input: {
        updates: toUpdate.map((p) => ({
          id: p.resolved.level_id!,
          inventory_item_id: p.resolved.inventory_item_id!,
          location_id: defaultLocation.id,
          stocked_quantity: p.row.stock!,
        })),
      },
    })
    logger.info(`✓ Inventory levels aggiornati.`)
  }

  const blocked = stockUpdates.filter(
    (p) => !ENABLE_INVENTORY && !p.resolved.inventory_item_id
  )

  logger.info(
    `Fatto. Prezzi: ${priceUpdates.length}, ` +
      `item+link creati: ${ENABLE_INVENTORY ? needsInventoryItemCreate.length : 0}, ` +
      `livelli creati: ${toCreate.length}, ` +
      `livelli aggiornati: ${toUpdate.length}, ` +
      `bloccati: ${blocked.length}, ` +
      `SKU mancanti: ${missing.length}.`
  )
}
