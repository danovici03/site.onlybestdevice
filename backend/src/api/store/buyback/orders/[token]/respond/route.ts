import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { buybackService, emitBuybackEvent, publicOrder, withOrderLock } from "../../../../../../lib/buyback/orders"

const RespondSchema = z.object({ accept: z.boolean() })

/** Răspunsul clientului la oferta revizuită după verificare. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = RespondSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "Date invalide" })

  const service = buybackService(req.scope)
  const [order] = (await service.listBuybackOrders(
    { access_token: String(req.params.token ?? "") },
    { take: 1 },
  )) as any[]
  if (!order) return res.status(404).json({ message: "Preluare negăsită" })
  if (order.status !== "revised") {
    return res.status(409).json({ message: "Oferta nu mai așteaptă un răspuns", order: publicOrder(order) })
  }

  const accept = parsed.data.accept
  // Sub lock, ca răspunsul clientului să nu se suprapună cu o modificare din admin.
  const result = await withOrderLock(req.scope, order.id, async () => {
    const current = (await service.retrieveBuybackOrder(order.id)) as any
    if (current.status !== "revised") return { conflict: current }
    const updated = await service.updateBuybackOrders({
      id: current.id,
      status: accept ? "accepted" : "declined",
      final_amount: accept
        ? current.payout_method === "voucher"
          ? current.revised_voucher_price
          : current.revised_price
        : null,
      // Explicația ofertei revizuite nu mai are sens după răspuns.
      customer_message: null,
      status_changed_at: new Date(),
    })
    return { updated }
  })
  if ("conflict" in result) {
    return res.status(409).json({ message: "Oferta nu mai așteaptă un răspuns", order: publicOrder(result.conflict) })
  }
  await emitBuybackEvent(req.scope, "buyback.status_changed", { id: order.id, by: "customer" })
  res.json({ order: publicOrder(result.updated) })
}
