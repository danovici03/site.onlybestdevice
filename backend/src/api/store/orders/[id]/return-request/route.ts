import { MedusaError } from "@medusajs/framework/utils"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import {
  createReturnRequestForOrder,
  loadOrderForReturn,
  publicReturnRequest,
  serializeOrderForReturn,
  type ReturnRequestItemInput,
} from "../../../../../lib/returns/return-requests"

type ReturnRequestBody = {
  items: ReturnRequestItemInput[]
  note?: string
}

// Cererea de retur trimisă din contul clientului. Se salvează în modulul
// `return_request` (pagina „Cereri retur” din admin); returul propriu-zis
// (stoc, rambursare) se face în continuare din comanda din admin.
// Varianta pentru vizitatori e în /store/return-requests.
export const POST = async (
  req: AuthenticatedMedusaRequest<ReturnRequestBody>,
  res: MedusaResponse,
) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Unauthorized")
  }

  const order = await loadOrderForReturn(req.scope, { id: req.params.id })
  if (!order || order.customer_id !== customerId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  const body = (req.body ?? {}) as ReturnRequestBody
  const request = await createReturnRequestForOrder(req.scope, order, {
    items: body.items,
    note: body.note,
    source: "account",
  })

  res.status(201).json({ return_request: publicReturnRequest(request) })
}

// Ce se mai poate returna din comandă (cantitatea rămasă pe fiecare linie),
// pentru formularul din cont.
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Unauthorized")
  }
  const order = await loadOrderForReturn(req.scope, { id: req.params.id })
  if (!order || order.customer_id !== customerId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }
  res.json({ order: await serializeOrderForReturn(req.scope, order) })
}
