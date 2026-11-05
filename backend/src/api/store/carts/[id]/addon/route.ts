import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { z } from "zod"

import {
  ADDON_FOR,
  ADDON_FOR_TITLE,
  resolveAddonUnitPrice,
} from "../../../../../lib/second-hand"
import { syncWarrantyLines } from "../../../../../lib/warranty-cart"

/**
 * Adaugă în coș un serviciu Second Hand (baterie nouă, folie montată) pentru
 * un produs anume. Același motiv ca `/warranty`: prețul e per produs și nu
 * poate veni din browser, deci aici se trimite doar ce produs se deservește.
 */

const BodySchema = z.object({
  /** Serviciile alese odată: baterie și/sau folie, într-un singur apel. */
  variant_ids: z.array(z.string().min(1)).min(1).max(5),
  target_product_id: z.string().min(1),
  quantity: z.number().int().positive().max(100).default(1),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = BodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues[0]?.message ?? "Cerere invalidă"
    )
  }
  const { target_product_id, quantity } = parsed.data
  const variant_ids = [...new Set(parsed.data.variant_ids)]

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "currency_code", "items.product_id"],
    filters: { id: req.params.id },
  })
  const cart = (carts as any[])[0]
  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Coșul nu există")
  }

  // Serviciul fără telefonul lui ar fi șters imediat de sync, iar ruta ar
  // răspunde totuși „ok". Mai bine o eroare clară.
  const inCart = ((cart.items ?? []) as any[]).some(
    (i) => i?.product_id === target_product_id
  )
  if (!inCart) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Produsul nu este în coș"
    )
  }

  const items = await Promise.all(
    variant_ids.map(async (variant_id) => {
      const { amount, targetTitle } = await resolveAddonUnitPrice(
        req.scope,
        target_product_id,
        variant_id,
        cart.currency_code
      )
      return {
        variant_id,
        quantity,
        ...(amount !== undefined ? { unit_price: amount } : {}),
        metadata: {
          [ADDON_FOR]: target_product_id,
          [ADDON_FOR_TITLE]: targetTitle,
        },
      }
    })
  )

  await addToCartWorkflow(req.scope).run({
    input: { cart_id: req.params.id, items },
  })

  // Aliniază cantitatea cu produsul și scoate dublurile (același serviciu
  // adăugat de două ori pe același produs).
  await syncWarrantyLines(req.scope, req.params.id)

  res.status(200).json({ ok: true })
}
