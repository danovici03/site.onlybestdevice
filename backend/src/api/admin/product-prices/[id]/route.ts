import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { readProductPrices, writeProductPrices } from "../../../../lib/pricing"
import {
  readWarrantyCard,
  writeWarrantyPrices,
} from "../../../../lib/warranty-prices"

/**
 * Prețurile unui produs în forma „preț normal + preț promoțional", plus
 * prețurile garanției extinse pentru produsul acesta.
 *
 * Rută proprie, nu `/admin/products/:id/variants/batch`: vectorul `prices` al
 * Medusei e set complet, iar un client care nu retrimite toate rândurile cu
 * `id`-urile lor le șterge tăcut. Traducerea o face `lib/pricing.ts`, cardul din
 * admin trimite doar numere.
 *
 * Garanția stă în aceeași rută pentru că e același card și același buton de
 * salvare: operatorul pune prețul produsului și prețul garanției lui într-o
 * singură apăsare. În spate sunt lucruri diferite — preț de variantă și
 * `metadata` de produs — dar asta nu-l privește.
 */

const AmountSchema = z.number().positive().nullable().optional()

const UpdateSchema = z
  .object({
    variants: z
      .array(
        z.object({
          id: z.string().min(1),
          price: z.number().positive().optional(),
          sale_price: z.number().positive().nullable().optional(),
        })
      )
      .optional(),
    /** `null` pe o durată scoate prețul propriu și lasă produsul pe cel implicit. */
    warranty: z
      .object({ one_year: AmountSchema, two_years: AmountSchema })
      .optional(),
  })
  .refine((v) => v.variants?.length || v.warranty, {
    message: "Nimic de actualizat",
  })

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const [prices, warranty] = await Promise.all([
    readProductPrices(req.scope, id),
    readWarrantyCard(req.scope, id),
  ])
  res.json({ ...prices, warranty })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { id } = req.params
  const { variants, warranty } = parsed.data

  // Garanția se scrie prima: e o singură scriere de `metadata`, deci dacă pică,
  // pică înaintea prețurilor și operatorul revine la un card necontradictoriu.
  if (warranty) {
    await writeWarrantyPrices(req.scope, id, warranty)
  }

  const prices = variants?.length
    ? await writeProductPrices(req.scope, id, variants)
    : await readProductPrices(req.scope, id)

  res.json({ ...prices, warranty: await readWarrantyCard(req.scope, id) })
}
