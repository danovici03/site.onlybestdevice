import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { buybackService, loadRules } from "../../../../lib/buyback/data"
import { computeQuote } from "../../../../lib/buyback/pricing"
import { AnswersSchema } from "../../../../lib/buyback/schema"

/** Calculatorul din admin: ce ofertă ar primi clientul, cu tot calculul. */
const QuoteSchema = z.object({
  price_id: z.string().min(1),
  answers: AnswersSchema,
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = QuoteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Date invalide", error: parsed.error.flatten() })
  }
  const service = buybackService(req.scope)
  const price = (await service.retrieveBuybackPrice(parsed.data.price_id, {
    relations: ["device"],
  })) as any
  const quote = computeQuote({
    device: { id: price.device.id, brand: price.device.brand },
    basePrice: price.base_price,
    answers: parsed.data.answers,
    rules: await loadRules(req.scope),
  })
  res.json({ quote })
}
