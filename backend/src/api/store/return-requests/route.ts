import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { findGuestOrder } from "../../../lib/returns/guest-lookup"
import {
  createReturnRequestForOrder,
  publicReturnRequest,
  type ReturnRequestItemInput,
} from "../../../lib/returns/return-requests"

type Body = {
  display_id: string | number
  email: string
  phone?: string
  items: ReturnRequestItemInput[]
  note?: string
}

/**
 * Cererea de retur pentru clienții fără cont (sau care nu sunt logați):
 * comanda se identifică din nou după număr + email, nu după id-ul primit la
 * pasul 1, ca nimeni să nu poată trimite cereri pe comenzile altora.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as Body
  const order = await findGuestOrder(req, body)
  const request = await createReturnRequestForOrder(req.scope, order, {
    items: body.items,
    note: body.note,
    phone: typeof body.phone === "string" ? body.phone.slice(0, 40) : undefined,
    source: "guest",
  })
  res.status(201).json({ return_request: publicReturnRequest(request) })
}
