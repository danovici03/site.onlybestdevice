import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { badRequest, revalidateCatalog } from "../../../../lib/product-filters/admin"
import { syncProductFilters } from "../../../../lib/product-filters/autofill"

/**
 * POST /admin/product-filters/recompute  { attribute_ids?, product_ids? }
 *
 * Rulează completarea automată. Fără parametri: tot catalogul, toate filtrele —
 * după ce ai schimbat sursele unui filtru sau l-ai legat de o categorie nouă.
 * Valorile setate manual nu se ating.
 */
const RecomputeSchema = z.object({
  attribute_ids: z.array(z.string()).optional(),
  product_ids: z.array(z.string()).optional(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = RecomputeSchema.safeParse(req.body ?? {})
  if (!parsed.success) return badRequest(res, parsed.error)
  const report = await syncProductFilters(req.scope, parsed.data.product_ids, {
    attributeIds: parsed.data.attribute_ids,
  })
  await revalidateCatalog(req, "recomputed")
  res.json({ report })
}
