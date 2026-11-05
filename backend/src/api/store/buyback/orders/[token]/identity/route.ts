import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { IdentitySchema, needsIdentity } from "../../../../../../lib/buyback/identity"
import { buybackService, emitBuybackEvent, publicOrder, withOrderLock } from "../../../../../../lib/buyback/orders"
import { allowSubmit } from "../../../../../../lib/buyback/rate-limit"

/**
 * Datele pentru borderou, completate de client după ce oferta finală e
 * acceptată. O singură dată: după ce le-a trimis, le mai schimbăm doar din
 * admin (clientul ne scrie), ca linkul preluării să nu poată rescrie actul.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!allowSubmit(req)) {
    return res.status(429).json({ message: "Prea multe cereri. Încearcă din nou în câteva minute." })
  }
  const parsed = IdentitySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Date invalide", error: parsed.error.flatten() })
  }

  const service = buybackService(req.scope)
  const [order] = (await service.listBuybackOrders(
    { access_token: String(req.params.token ?? "") },
    { take: 1 },
  )) as any[]
  if (!order) return res.status(404).json({ message: "Preluare negăsită" })

  const result = await withOrderLock(req.scope, order.id, async () => {
    const current = (await service.retrieveBuybackOrder(order.id)) as any
    if (!needsIdentity(current)) return { conflict: current }
    const updated = await service.updateBuybackOrders({ id: current.id, ...parsed.data })
    return { updated }
  })
  if ("conflict" in result) {
    return res.status(409).json({ message: "Datele nu se mai pot completa aici", order: publicOrder(result.conflict) })
  }

  await emitBuybackEvent(req.scope, "buyback.identity_completed", { id: order.id })
  res.json({ order: publicOrder(result.updated) })
}
