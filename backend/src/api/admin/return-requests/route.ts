import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { RETURN_REQUEST_MODULE } from "../../../modules/return-request"
import { RETURN_REQUEST_STATUSES } from "../../../modules/return-request/models/return-request"
import type ReturnRequestModuleService from "../../../modules/return-request/service"

/**
 * Lista „Cereri retur” din admin. Filtre: `status`, `order_id` (widgetul de pe
 * comandă) și `q` — un număr caută după numărul comenzii, altfel după email /
 * nume. Întoarce și numărul de cereri pe fiecare status, pentru filtre.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: ReturnRequestModuleService = req.scope.resolve(
    RETURN_REQUEST_MODULE,
  )
  const q = req.query as Record<string, string | undefined>

  const filters: Record<string, unknown> = {}
  if (q.status && (RETURN_REQUEST_STATUSES as readonly string[]).includes(q.status)) {
    filters.status = q.status
  }
  if (q.order_id) filters.order_id = q.order_id

  const search = q.q?.trim()
  if (search) {
    const asNumber = Number(search.replace(/^#/, ""))
    if (Number.isInteger(asNumber) && asNumber > 0) {
      filters.display_id = asNumber
    } else {
      filters.q = search
    }
  }

  const take = Math.min(Number(q.limit ?? 50) || 50, 200)
  const skip = Math.max(Number(q.offset ?? 0) || 0, 0)

  const [return_requests, count] = await service.listAndCountReturnRequests(
    filters,
    { take, skip, order: { requested_at: "DESC" } },
  )

  // Câte sunt pe fiecare status (fără filtrul de status), pentru etichetele
  // din filtru — cererile noi trebuie să sară în ochi.
  const counts: Record<string, number> = {}
  if (!q.order_id) {
    await Promise.all(
      RETURN_REQUEST_STATUSES.map(async (status) => {
        const [, n] = await service.listAndCountReturnRequests(
          { status },
          { take: 1, select: ["id"] },
        )
        counts[status] = n
      }),
    )
  }

  res.json({ return_requests, count, counts })
}
