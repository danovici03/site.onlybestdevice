import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { RETURN_REQUEST_MODULE } from "../../../../../modules/return-request"
import type ReturnRequestModuleService from "../../../../../modules/return-request/service"
import { publicReturnRequest } from "../../../../../lib/returns/return-requests"

/**
 * Cererile de retur ale clientului logat, pentru pagina „Retururi” din cont.
 * Include și cererile trimise din formularul public, dacă comanda e pe contul
 * lui (customer_id-ul se ia din comandă).
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const service: ReturnRequestModuleService = req.scope.resolve(
    RETURN_REQUEST_MODULE,
  )
  const requests = await service.listReturnRequests(
    { customer_id: req.auth_context.actor_id },
    { order: { requested_at: "DESC" }, take: 200 },
  )
  res.json({ return_requests: requests.map(publicReturnRequest) })
}
