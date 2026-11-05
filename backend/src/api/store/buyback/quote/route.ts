import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { buybackService, loadRules } from "../../../../lib/buyback/data"
import { computeQuote } from "../../../../lib/buyback/pricing"
import { signQuote } from "../../../../lib/buyback/quote-token"
import { allowQuote } from "../../../../lib/buyback/rate-limit"
import { questionsFor } from "../../../../lib/buyback/catalog"
import { AnswersSchema, normalizeStorage } from "../../../../lib/buyback/schema"

const QuoteSchema = z.object({
  handle: z.string().min(1).max(200),
  storage: z.string().min(1).max(20),
  color: z.string().max(80).nullable().optional(),
  answers: AnswersSchema,
})

/**
 * Oferta pentru client. Întoarce doar suma (transfer + voucher) și un token
 * semnat — calculul pe bucăți rămâne la noi, ca la flip. La refuz trimitem
 * motivul, ca clientul să înțeleagă de ce nu primește ofertă.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!allowQuote(req)) {
    return res.status(429).json({ message: "Prea multe evaluări. Încearcă din nou în câteva minute." })
  }
  const parsed = QuoteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Răspunsuri incomplete", error: parsed.error.flatten() })
  }
  const { handle, color, answers } = parsed.data
  const storage = normalizeStorage(parsed.data.storage)

  const service = buybackService(req.scope)
  const [device] = (await service.listBuybackDevices(
    { handle, is_active: true },
    { relations: ["prices"], take: 1 },
  )) as any[]
  const price = device?.prices?.find((p: any) => p.storage === storage)
  if (!device || !price) return res.status(404).json({ message: "Model sau stocare negăsite" })

  // Pe modelele la care întrebăm de baterie, răspunsul e obligatoriu: lipsa lui
  // ar sări scăderea pentru baterie uzată și ar semna oferta la preț întreg.
  if (questionsFor(device.brand).battery && typeof answers.battery !== "number") {
    return res.status(400).json({ message: "Răspunsuri incomplete: lipsește starea bateriei" })
  }

  const colors: string[] = Array.isArray(device.colors) ? device.colors : []
  const safeColor = color && colors.includes(color) ? color : null

  const quote = computeQuote({
    device: { id: device.id, brand: device.brand },
    basePrice: price.base_price,
    answers,
    rules: await loadRules(req.scope),
  })

  if (quote.status === "unavailable") {
    return res.status(404).json({ message: "Nu preluăm momentan această variantă" })
  }
  if (quote.status === "rejected") {
    return res.json({ quote: { status: "rejected", reasons: quote.reasons } })
  }
  if (quote.status === "too_low") {
    return res.json({ quote: { status: "too_low" } })
  }

  const { token, expires_at } = signQuote({
    price_id: price.id,
    device_id: device.id,
    storage: price.storage,
    color: safeColor,
    answers,
    base_price: quote.base_price,
    price: quote.price,
    voucher_price: quote.voucher_price,
    voucher_bonus_percent: quote.voucher_bonus_percent,
  })

  res.json({
    quote: {
      status: "offer",
      price: quote.price,
      voucher_price: quote.voucher_price,
      voucher_bonus_percent: quote.voucher_bonus_percent,
      expires_at,
      token,
    },
  })
}
