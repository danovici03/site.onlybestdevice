import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { z } from "zod"

import { resolveWarrantyUnitPrice } from "../../../../../lib/warranty-prices"

/**
 * Adaugă în coș garanția extinsă pentru un produs anume.
 *
 * Rută proprie pentru că `POST /store/carts/:id/line-items` acceptă doar
 * `variant_id`, `quantity` și `metadata` — nu are cum să ducă un preț. Iar
 * prețul chiar nu poate veni din browser: garanția are acum sumă proprie pe
 * fiecare produs, iar dacă am accepta-o de la client oricine ar cumpăra-o cu
 * 1 leu. Aici trimitem doar ce produs se acoperă, restul se citește pe server.
 *
 * Fără preț propriu pe produs nu trimitem `unit_price` deloc: linia primește
 * atunci prețul variantei de serviciu, exact ca înainte de această rută.
 *
 * `unit_price` marchează linia cu `is_custom_price`, iar reîmprospătarea coșului
 * (`get-variants-and-items-with-prices`) sare peste re-prețuirea liniilor
 * marcate. Deci prețul nu revine la cel de catalog la următoarea modificare a
 * coșului sau la schimbarea cantității.
 */

const BodySchema = z.object({
  /** Varianta produsului de serviciu: „+1 an" sau „+2 ani". */
  variant_id: z.string().min(1),
  /** Produsul acoperit — el dă și prețul, și legătura din coș. */
  target_product_id: z.string().min(1),
  quantity: z.number().int().positive().max(100).default(1),
})

/** Cheile din metadata liniei; aliniate cu `storefront/lib/util/warranty.ts`. */
const WARRANTY_FOR = "warranty_for"
const WARRANTY_FOR_TITLE = "warranty_for_title"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = BodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues[0]?.message ?? "Cerere invalidă"
    )
  }

  const { variant_id, target_product_id, quantity } = parsed.data

  // Coșul se citește înainte de workflow ca să știm moneda (prețul propriu e
  // implicit în moneda magazinului) și ca un coș inexistent să dea 404 aici, nu
  // o eroare de workflow.
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "currency_code"],
    filters: { id: req.params.id },
  })

  const cart = (carts as any[])[0]
  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Coșul nu există")
  }

  const { amount, targetTitle } = await resolveWarrantyUnitPrice(
    req.scope,
    target_product_id,
    variant_id,
    cart.currency_code
  )

  await addToCartWorkflow(req.scope).run({
    input: {
      cart_id: req.params.id,
      items: [
        {
          variant_id,
          quantity,
          ...(amount !== undefined ? { unit_price: amount } : {}),
          metadata: {
            [WARRANTY_FOR]: target_product_id,
            [WARRANTY_FOR_TITLE]: targetTitle,
          },
        },
      ],
    },
  })

  res.status(200).json({ ok: true })
}
