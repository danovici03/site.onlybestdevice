import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { findGuestOrder } from "../../../../lib/returns/guest-lookup"
import { serializeOrderForReturn } from "../../../../lib/returns/return-requests"

/**
 * Pasul 1 din formularul de retur pentru vizitatori: număr comandă + email →
 * produsele comenzii și cât se mai poate returna din fiecare. POST, nu GET,
 * ca emailul să nu ajungă în loguri de acces și cache-uri.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const order = await findGuestOrder(req, (req.body ?? {}) as any)
  res.json({ order: await serializeOrderForReturn(req.scope, order) })
}
