import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { readProductPrices, writeProductPrices } from "../../../../lib/pricing"

/**
 * Prețurile unui produs în forma „preț normal + preț promoțional".
 *
 * Rută proprie, nu `/admin/products/:id/variants/batch`: vectorul `prices` al
 * Medusei e set complet, iar un client care nu retrimite toate rândurile cu
 * `id`-urile lor le șterge tăcut. Traducerea o face `lib/pricing.ts`, cardul din
 * admin trimite doar numere.
 */

const UpdateSchema = z.object({
  variants: z
    .array(
      z.object({
        id: z.string().min(1),
        price: z.number().positive().optional(),
        sale_price: z.number().positive().nullable().optional(),
      })
    )
    .min(1, "Nicio variantă de actualizat"),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  res.json(await readProductPrices(req.scope, id))
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { id } = req.params
  res.json(await writeProductPrices(req.scope, id, parsed.data.variants))
}
