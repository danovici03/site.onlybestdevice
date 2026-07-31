import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { applyStock, type StockInput } from "../../../../lib/erp/stock"

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
 * `x-medusa-access-token` (Admin → Settings → API Key Management).
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

    return res.json(result)
  } catch (e) {
    const message = (e as Error).message
    logger.error(`[erp] stoc esuat: ${message}`)
    return res.status(500).json({ error: message })
  }
}
