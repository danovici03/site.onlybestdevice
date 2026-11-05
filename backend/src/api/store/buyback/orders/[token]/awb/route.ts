import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { AwbSchema } from "../../../../../../lib/buyback/identity"
import { buybackService, publicOrder } from "../../../../../../lib/buyback/orders"
import { allowSubmit } from "../../../../../../lib/buyback/rate-limit"

const Body = z.object({ awb: AwbSchema })

/**
 * Clientul și-a făcut singur AWB-ul la Fan Courier și ni-l lasă aici, ca să
 * urmărim coletul. Se poate corecta cât timp telefonul n-a ajuns la noi.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!allowSubmit(req)) {
    return res.status(429).json({ message: "Prea multe cereri. Încearcă din nou în câteva minute." })
  }
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "AWB invalid" })

  const service = buybackService(req.scope)
  const [order] = (await service.listBuybackOrders(
    { access_token: String(req.params.token ?? "") },
    { take: 1 },
  )) as any[]
  if (!order) return res.status(404).json({ message: "Preluare negăsită" })
  if (order.status !== "submitted" || order.delivery_method !== "courier") {
    return res.status(409).json({ message: "AWB-ul nu se mai poate schimba", order: publicOrder(order) })
  }

  const updated = await service.updateBuybackOrders({ id: order.id, awb: parsed.data.awb })
  res.json({ order: publicOrder(updated) })
}
