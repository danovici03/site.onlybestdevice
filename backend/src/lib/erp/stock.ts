import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Aplicarea stocului venit din ERP (Laravel) peste variantele Medusa.
 *
 * Contractul: `quantity` = cate bucati sunt DISPONIBILE pentru vanzare online,
 * asa cum le vede gestiunea (stoc nou, nerezervat).
 *
 * Detaliul important: Medusa calculeaza disponibilul ca
 * `stocked_quantity - reserved_quantity`, iar comenzile neonorate tin rezervari
 * active pe inventar. Daca am scrie direct `stocked_quantity = quantity`, comenzile
 * pe care Laravel le-a scazut deja ar fi scazute a doua oara prin rezervarile Medusa.
 * De aceea scriem `stocked_quantity = quantity + reserved_quantity`, ceea ce face ca
 * disponibilul din Medusa sa fie exact numarul trimis de ERP.
 */

export type StockInput = {
  variant_id?: string
  sku?: string
  quantity: number
}

export type StockResult = {
  location_id: string
  updated: number
  created_items: number
  enabled_manage_inventory: number
  results: Array<{
    variant_id: string
    sku: string | null
    requested: number
    stocked_quantity: number
    reserved_quantity: number
  }>
  errors: Array<{ variant_id?: string; sku?: string; message: string }>
}

const VARIANT_FIELDS = [
  "id",
  "sku",
  "manage_inventory",
  "allow_backorder",
  "product_id",
  "inventory_items.inventory.id",
  "inventory_items.inventory.location_levels.id",
  "inventory_items.inventory.location_levels.location_id",
  "inventory_items.inventory.location_levels.stocked_quantity",
  "inventory_items.inventory.location_levels.reserved_quantity",
]

/**
 * Locatia de stoc pe care scriem. Cu o singura locatie (cazul curent) e cea
 * implicita; ERP_STOCK_LOCATION_ID o forteaza cand vor fi mai multe.
 */
export const resolveStockLocationId = async (container: any): Promise<string | null> => {
  const forced = process.env.ERP_STOCK_LOCATION_ID
  if (forced) return forced

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })

  return locations?.[0]?.id ?? null
}

/**
 * True daca locatia de stoc e legata de cel putin un sales channel. Fara legatura,
 * nivelurile ei nu conteaza pentru disponibilitatea din magazin.
 */
const locationServesASalesChannel = async (
  container: any,
  locationId: string,
): Promise<boolean> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data } = await query.graph({
      entity: "sales_channel_location",
      fields: ["sales_channel_id"],
      filters: { stock_location_id: locationId },
    })

    return !!data?.length
  } catch (e) {
    // Verificarea in sine a esuat — nu stim daca legatura lipseste. Blocarea ar
    // opri toate push-urile de stoc pentru un motiv neconfirmat, deci lasam sa
    // treaca: refuzam doar cand chiar am constatat absenta legaturii.
    container.resolve(ContainerRegistrationKeys.LOGGER)?.warn?.(
      `[erp] nu am putut verifica legatura sales channel ↔ locatie: ${(e as Error).message}`,
    )
    return true
  }
}

export const applyStock = async (
  container: any,
  items: StockInput[],
): Promise<StockResult> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const locationId = await resolveStockLocationId(container)
  if (!locationId) {
    throw new Error(
      "Nicio stock location configurata in Medusa — creeaza una inainte de a trimite stoc.",
    )
  }

  const result: StockResult = {
    location_id: locationId,
    updated: 0,
    created_items: 0,
    enabled_manage_inventory: 0,
    results: [],
    errors: [],
  }

  const variantIds = items.map((i) => i.variant_id).filter(Boolean) as string[]
  const skus = items.map((i) => i.sku).filter(Boolean) as string[]

  const variants: any[] = []
  if (variantIds.length) {
    const { data } = await query.graph({
      entity: "product_variant",
      fields: VARIANT_FIELDS,
      filters: { id: variantIds },
    })
    variants.push(...(data ?? []))
  }
  if (skus.length) {
    const { data } = await query.graph({
      entity: "product_variant",
      fields: VARIANT_FIELDS,
      filters: { sku: skus },
    })
    variants.push(...(data ?? []))
  }

  const byId = new Map<string, any>(variants.map((v) => [v.id, v]))
  const bySku = new Map<string, any>(
    variants.filter((v) => v.sku).map((v) => [v.sku as string, v]),
  )

  type Plan = { variant: any; quantity: number }
  // Indexat pe id-ul variantei: doua pozitii care ajung la aceeasi varianta
  // (variant_id + SKU pentru acelasi produs) ar scrie nivelul de doua ori, iar
  // a doua ar adauga inca o data rezervarile. Ultima valoare castiga.
  const planByVariant = new Map<string, Plan>()

  for (const item of items) {
    const variant = item.variant_id
      ? byId.get(item.variant_id)
      : item.sku
        ? bySku.get(item.sku)
        : undefined

    if (!variant) {
      result.errors.push({
        variant_id: item.variant_id,
        sku: item.sku,
        message: "varianta inexistenta in Medusa",
      })
      continue
    }

    planByVariant.set(variant.id, {
      variant,
      quantity: Math.max(0, Math.trunc(item.quantity)),
    })
  }

  const plans: Plan[] = [...planByVariant.values()]

  if (!plans.length) {
    return result
  }

  // ---- Faza 1: porneste gestiunea de stoc unde e inca oprita ----------------
  // Fara manage_inventory varianta e mereu "in stoc" pe site si poate fi
  // supravanduta. allow_backorder se stinge o singura data, la aprindere, ca sa
  // nu suprascriem o alegere facuta intentionat ulterior din Admin.
  const toEnable = plans.filter((p) => !p.variant.manage_inventory)
  if (toEnable.length) {
    // Prag de siguranta: cat timp manage_inventory e oprit, varianta e mereu
    // disponibila. In clipa in care il aprindem, disponibilul incepe sa fie citit
    // din nivelurile locatiei — iar daca locatia nu e legata de niciun sales
    // channel, Medusa vede zero peste tot si TOT catalogul dispare de pe site.
    // Mai bine refuzam zgomotos decat sa golim magazinul in tacere.
    if (!(await locationServesASalesChannel(container, locationId))) {
      throw new Error(
        `Stock location ${locationId} nu e legata de niciun sales channel. ` +
          "Aprinderea gestiunii de stoc ar scoate catalogul din stoc — leaga-le " +
          "intai in Admin (Settings → Locations & Shipping) si reia.",
      )
    }

    await updateProductVariantsWorkflow(container).run({
      input: {
        product_variants: toEnable.map((p) => ({
          id: p.variant.id,
          manage_inventory: true,
          allow_backorder: false,
        })),
      },
    })
    result.enabled_manage_inventory = toEnable.length
  }

  // ---- Faza 2: creeaza inventory_item + nivel initial unde lipsesc -----------
  const needsItem = plans.filter((p) => !p.variant.inventory_items?.[0]?.inventory?.id)
  if (needsItem.length) {
    const itemInputs = needsItem.map((p) => ({
      sku: p.variant.sku ?? `variant-${p.variant.id}`,
      location_levels: [{ location_id: locationId, stocked_quantity: p.quantity }],
    }))

    const { result: created } = await createInventoryItemsWorkflow(container).run({
      input: { items: itemInputs },
    })

    const createdBySku = new Map<string, string>()
    for (const item of created as any[]) {
      if (item.sku) createdBySku.set(item.sku, item.id)
    }

    const links = needsItem
      .map((p) => {
        const sku = p.variant.sku ?? `variant-${p.variant.id}`
        const inventoryItemId = createdBySku.get(sku)
        if (!inventoryItemId) return null
        return {
          [Modules.PRODUCT]: { variant_id: p.variant.id },
          [Modules.INVENTORY]: { inventory_item_id: inventoryItemId },
        }
      })
      .filter(Boolean)

    if (links.length) {
      await link.create(links as any)
    }

    result.created_items = needsItem.length

    for (const p of needsItem) {
      result.results.push({
        variant_id: p.variant.id,
        sku: p.variant.sku ?? null,
        requested: p.quantity,
        stocked_quantity: p.quantity,
        reserved_quantity: 0,
      })
    }
  }

  // ---- Faza 3: scrie nivelurile pentru variantele care aveau deja inventar ---
  const justCreated = new Set(needsItem.map((p) => p.variant.id))
  const remaining = plans.filter((p) => !justCreated.has(p.variant.id))

  const levelsToCreate: Array<{
    inventory_item_id: string
    location_id: string
    stocked_quantity: number
  }> = []
  const levelsToUpdate: Array<{
    id: string
    inventory_item_id: string
    location_id: string
    stocked_quantity: number
  }> = []

  for (const p of remaining) {
    const inventory = p.variant.inventory_items?.[0]?.inventory
    const level = (inventory?.location_levels ?? []).find(
      (l: any) => l.location_id === locationId,
    )

    const reserved = Number(level?.reserved_quantity ?? 0)
    // Vezi comentariul de sus: adaugam rezervarile inapoi, ca disponibilul
    // calculat de Medusa (stocked - reserved) sa fie exact cantitatea din ERP.
    const target = p.quantity + reserved

    result.results.push({
      variant_id: p.variant.id,
      sku: p.variant.sku ?? null,
      requested: p.quantity,
      stocked_quantity: target,
      reserved_quantity: reserved,
    })

    if (!level) {
      levelsToCreate.push({
        inventory_item_id: inventory.id,
        location_id: locationId,
        stocked_quantity: target,
      })
      continue
    }

    if (Number(level.stocked_quantity ?? 0) !== target) {
      levelsToUpdate.push({
        id: level.id,
        inventory_item_id: inventory.id,
        location_id: locationId,
        stocked_quantity: target,
      })
    }
  }

  if (levelsToCreate.length) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: levelsToCreate },
    })
  }
  if (levelsToUpdate.length) {
    await updateInventoryLevelsWorkflow(container).run({
      input: { updates: levelsToUpdate },
    })
  }

  result.updated = result.created_items + levelsToCreate.length + levelsToUpdate.length

  return result
}
