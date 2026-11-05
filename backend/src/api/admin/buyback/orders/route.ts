import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { BUYBACK_ORDER_STATUSES } from "../../../../modules/buyback/models/buyback-order"
import { buybackService } from "../../../../lib/buyback/orders"

/** Lista preluărilor. Filtre: `status`, `q` (număr, email, nume, model). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = buybackService(req.scope)
  const q = req.query as Record<string, string | undefined>

  const filters: Record<string, unknown> = {}
  if (q.status && (BUYBACK_ORDER_STATUSES as readonly string[]).includes(q.status)) {
    filters.status = q.status
  }
  const search = q.q?.trim()
  if (search) {
    const n = Number(search.replace(/^#/, ""))
    if (Number.isInteger(n) && n > 0) filters.display_id = n
    else filters.q = search
  }

  const take = Math.min(Number(q.limit ?? 50) || 50, 200)
  const skip = Math.max(Number(q.offset ?? 0) || 0, 0)
  const [orders, count] = await service.listAndCountBuybackOrders(filters, {
    take,
    skip,
    order: { submitted_at: "DESC" },
  })

  const counts: Record<string, number> = {}
  await Promise.all(
    BUYBACK_ORDER_STATUSES.map(async (status) => {
      const [, n] = await service.listAndCountBuybackOrders({ status }, { take: 1, select: ["id"] })
      counts[status] = n
    }),
  )
  res.json({ orders, count, counts })
}
