import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { RULE_DEFS } from "../../../../lib/buyback/catalog"
import { buybackService } from "../../../../lib/buyback/data"
import { RuleInputSchema } from "../../../../lib/buyback/schema"

/** Definițiile (etichete, valori implicite) + regulile salvate. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const rules = await buybackService(req.scope).listBuybackRules({}, { take: 5000 })
  res.json({
    defs: Object.entries(RULE_DEFS).map(([key, def]) => ({ key, ...def })),
    rules,
  })
}

const BatchSchema = z.object({
  upsert: z.array(RuleInputSchema).max(500).default([]),
  delete: z.array(z.string().min(1)).max(500).default([]),
})

/**
 * Upsert după (cheie, nivel, brand/dispozitiv): adminul nu ține id-uri, trimite
 * doar „regula asta are acum valoarea asta”. Brandul se salvează cu litere
 * mici, ca „Apple” și „APPLE” să fie aceeași regulă.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = BatchSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Date invalide", error: parsed.error.flatten() })
  }
  const service = buybackService(req.scope)
  const existing = (await service.listBuybackRules({}, { take: 5000 })) as any[]
  const keyOf = (r: { key: string; scope: string; scope_value: string }) =>
    `${r.key}|${r.scope}|${r.scope_value}`
  const byKey = new Map(existing.map((r) => [keyOf(r), r]))

  const toCreate: any[] = []
  const toUpdate: any[] = []
  for (const raw of parsed.data.upsert) {
    const r = {
      ...raw,
      scope_value: raw.scope === "brand" ? raw.scope_value.toLowerCase() : raw.scope_value,
      note: raw.note ?? null,
    }
    const cur = byKey.get(keyOf(r))
    if (cur) toUpdate.push({ id: cur.id, kind: r.kind, value: r.value, note: r.note })
    else toCreate.push(r)
  }

  if (toCreate.length) await service.createBuybackRules(toCreate)
  if (toUpdate.length) await service.updateBuybackRules(toUpdate)
  if (parsed.data.delete.length) await service.deleteBuybackRules(parsed.data.delete)

  res.json({ rules: await service.listBuybackRules({}, { take: 5000 }) })
}
