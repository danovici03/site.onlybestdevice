import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import {
  SH_GRADES,
  readSecondHandCard,
  writeSecondHand,
} from "../../../../lib/second-hand"

/**
 * Cardul „Second Hand" din admin: datele produsului folosit și prețurile
 * proprii ale serviciilor. Bifa în sine e tagul `second-hand`, pus de admin
 * prin `setProductTag` ca toate celelalte bife.
 */

const Nullable = <T extends z.ZodTypeAny>(t: T) => t.nullable().optional()

const UpdateSchema = z.object({
  details: z
    .object({
      grade: Nullable(z.enum(SH_GRADES)),
      battery_health: Nullable(z.number().min(1).max(100)),
      warranty_months: Nullable(z.number().int().min(1).max(60)),
      notes: Nullable(z.string().max(2000)),
    })
    .optional(),
  prices: z
    .object({
      battery: Nullable(z.number().positive()),
      screen_protector: Nullable(z.number().positive()),
    })
    .optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(await readSecondHandCard(req.scope, req.params.id))
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message })
  }
  await writeSecondHand(req.scope, req.params.id, parsed.data as any)
  res.json(await readSecondHandCard(req.scope, req.params.id))
}
