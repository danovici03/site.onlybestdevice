import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { buybackService, reviseFromInspection } from "../../../../../../lib/buyback/orders"
import { AnswersSchema } from "../../../../../../lib/buyback/schema"

/** Previzualizarea ofertei revizuite din răspunsurile tehnicianului (nu salvează). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = z.object({ inspection: AnswersSchema }).safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Date invalide", error: parsed.error.flatten() })
  }
  const order = await buybackService(req.scope).retrieveBuybackOrder(req.params.id)
  const r = await reviseFromInspection(req.scope, order, parsed.data.inspection)
  res.json({
    quote: r.quote,
    revised_price: r.revised_price,
    revised_voucher_price: r.revised_voucher_price,
  })
}
