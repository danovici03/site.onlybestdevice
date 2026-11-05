import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { buybackService, revalidateBuyback } from "../../../../lib/buyback/data"

/**
 * Salvarea tabelului de prețuri: doar celulele modificate. `base_price: null`
 * = nu mai cumpărăm stocarea asta; `delete` scoate stocarea din listă.
 */
const BatchSchema = z.object({
  update: z
    .array(
      z.object({
        id: z.string().min(1),
        base_price: z.number().int().min(0).max(100000).nullable(),
      }),
    )
    .max(5000)
    .default([]),
  delete: z.array(z.string().min(1)).max(500).default([]),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = BatchSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Date invalide", error: parsed.error.flatten() })
  }
  const service = buybackService(req.scope)
  if (parsed.data.update.length) await service.updateBuybackPrices(parsed.data.update)
  if (parsed.data.delete.length) await service.deleteBuybackPrices(parsed.data.delete)
  revalidateBuyback(req.scope, "buyback.prices")
  res.json({ updated: parsed.data.update.length, deleted: parsed.data.delete.length })
}
