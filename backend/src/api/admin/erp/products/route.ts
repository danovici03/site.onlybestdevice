import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { upsertProducts, type ProductInput } from "../../../../lib/erp/products"

/**
 * Creeaza in Medusa produsele nascute in gestiunea Laravel.
 *
 *   POST /admin/erp/products
 *   { "items": [ { "sku": "IPH15-128-BLK",
 *                  "title": "iPhone 15 128GB Negru",
 *                  "description": "…",
 *                  "handle": "iphone-15-128gb-negru",
 *                  "price": 3999,
 *                  "quantity": 3 } ] }
 *
 * Produsul se creeaza ca **draft**, cu o singura varianta (SKU-ul din gestiune)
 * si cu stocul aplicat in acelasi apel. Raspunsul contine `variant_id` si
 * `product_id`, pe care ERP-ul le salveaza in `products.medusa_variant_id` /
 * `medusa_product_id` — de acolo incolo stocul curge prin /admin/erp/stock.
 *
 * Idempotent pe SKU: un SKU existent nu se dubleaza, se intoarce varianta gasita
 * (`created: false`), deci un retry dupa timeout e inofensiv.
 *
 * Autentificare: ca toate rutele /admin — Secret API Key in HTTP Basic, cheia pe
 * post de username si parola goala.
 */

const MAX_ITEMS = 100

type Body = { items?: ProductInput[] }

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

  try {
    const result = await upsertProducts(req.scope, items)

    logger.info(
      `[erp] produse: ${result.created} create, ${result.linked} deja existente (legate), ` +
        `${result.errors.length} erori.`,
    )

    return res.json(result)
  } catch (e) {
    const message = (e as Error).message
    logger.error(`[erp] creare produse esuata: ${message}`)
    return res.status(500).json({ error: message })
  }
}
