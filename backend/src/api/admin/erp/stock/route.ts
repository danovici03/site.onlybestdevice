import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { applyStock, type StockInput, type StockResult } from "../../../../lib/erp/stock"
import {
  GLOBAL_STOCK_TAGS,
  MAX_TARGETED_PRODUCTS,
  revalidateStorefront,
  stockRevalidationTags,
} from "../../../../lib/storefront-revalidate"

/**
 * Scrie stocul venit din ERP-ul Laravel.
 *
 *   POST /admin/erp/stock
 *   { "items": [ { "variant_id": "variant_01...", "quantity": 3 },
 *                 { "sku": "IPH15-128-BLK",       "quantity": 0 } ] }
 *
 * `quantity` = bucati disponibile pentru vanzare online. Ruta face upsert-ul
 * complet (aprinde manage_inventory, creeaza inventory_item + nivel daca lipsesc)
 * intr-un singur apel, ca ERP-ul sa nu ramana la jumatate daca pica un request.
 *
 * Autentificare: ruta e sub /admin, deci cere un Secret API Key trimis in
 * HTTP Basic cu cheia pe post de username, parola goala (Admin → Settings →
 * API Key Management → Secret API keys).
 */

const MAX_ITEMS = 500

type Body = { items?: StockInput[] }

export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const items = req.body?.items

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "`items` lipseste sau e gol" })
  }

  if (items.length > MAX_ITEMS) {
    return res
      .status(400)
      .json({ error: `maxim ${MAX_ITEMS} pozitii per apel (primite ${items.length})` })
  }

  const invalid = items.find(
    (i) => (!i?.variant_id && !i?.sku) || typeof i?.quantity !== "number",
  )
  if (invalid) {
    return res.status(400).json({
      error: "fiecare pozitie are nevoie de `variant_id` sau `sku` si de `quantity` numeric",
    })
  }

  try {
    const result = await applyStock(req.scope, items)

    logger.info(
      `[erp] stoc aplicat: ${result.updated} variante actualizate, ` +
        `${result.created_items} inventory_item create, ` +
        `${result.enabled_manage_inventory} cu manage_inventory pornit, ` +
        `${result.errors.length} erori.`,
    )

    // Cantitatea stă pe inventory_level, iar schimbarea ei nu emite
    // `product.updated` / `product-variant.updated` — deci subscriberul de
    // revalidare nu se declanșează și site-ul ar rămâne pe stocul vechi.
    // Invalidăm explicit, dar doar produsele schimbate (vezi
    // `stockRevalidationTags`): tagul global la fiecare vânzare regenera tot
    // site-ul pe Vercel.
    if (result.changed.length) {
      await revalidateStock(req.scope, logger, result.changed)
    }

    return res.json(result)
  } catch (e) {
    const message = (e as Error).message
    logger.error(`[erp] stoc esuat: ${message}`)
    return res.status(500).json({ error: message })
  }
}

const revalidateStock = async (
  container: MedusaRequest["scope"],
  logger: Logger,
  changed: StockResult["changed"],
) => {
  // Handle-ul intră în tag: pagina de produs e cerută după handle, nu după id.
  let handles = new Map<string, string>()
  if (changed.length <= MAX_TARGETED_PRODUCTS) {
    try {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product",
        fields: ["id", "handle"],
        filters: { id: changed.map((c) => c.product_id) },
      })
      handles = new Map((data ?? []).map((p: any) => [p.id, p.handle]))
    } catch (e) {
      logger.warn(`[erp] handle-urile pentru revalidare: ${(e as Error).message}`)
    }
  }

  const products = changed.map((c) => ({
    id: c.product_id,
    handle: handles.get(c.product_id),
    availability_changed: c.availability_changed,
  }))
  // Fără handle, pagina produsului n-ar fi invalidată; tagul global e mai sigur.
  const tags = products.every((p) => p.handle)
    ? stockRevalidationTags(products)
    : [...GLOBAL_STOCK_TAGS]

  const ok = await revalidateStorefront(logger, "erp.stock", tags)
  // Un storefront încă nedeployat respinge tagurile noi cu 400 („Unknown
  // tags"); revenim la tagul global, ca stocul să nu rămână vechi.
  if (!ok && tags.some((t) => !GLOBAL_STOCK_TAGS.includes(t))) {
    await revalidateStorefront(logger, "erp.stock", [...GLOBAL_STOCK_TAGS])
  }
}
