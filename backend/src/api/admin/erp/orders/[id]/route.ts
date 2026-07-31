import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { fetchErpOrderPayload } from "../../../../../lib/erp/order-payload"

/**
 * Payload-ul normalizat al unei comenzi, in exact forma pe care o trimite
 * subscriber-ul catre ERP.
 *
 *   GET /admin/erp/orders/order_01...
 *
 * Folosit de `php artisan medusa:reimport-order` pentru comenzile la care
 * webhook-ul n-a ajuns (ERP oprit, retea picata) — reimportul trece prin acelasi
 * handler ca webhook-ul, deci payload-ul trebuie sa fie identic bit cu bit.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id

  if (!orderId) {
    return res.status(400).json({ error: "id lipsa" })
  }

  const order = await fetchErpOrderPayload(req.scope, orderId)

  if (!order) {
    return res.status(404).json({ error: "comanda inexistenta" })
  }

  return res.json({ order })
}
