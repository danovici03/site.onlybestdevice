import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { buybackService, publicOrder } from "../../../../../lib/buyback/orders"

/** Pagina publică a preluării, deschisă din linkul din email. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const token = String(req.params.token ?? "")
  if (token.length < 20) return res.status(404).json({ message: "Preluare negăsită" })
  const [order] = await buybackService(req.scope).listBuybackOrders({ access_token: token }, { take: 1 })
  if (!order) return res.status(404).json({ message: "Preluare negăsită" })
  res.json({ order: publicOrder(order) })
}
