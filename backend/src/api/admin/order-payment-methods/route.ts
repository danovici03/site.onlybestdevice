import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  describeOrderPayment,
  type PaymentMethod,
} from "../../../lib/orders/payment-method"

/** O pagină din lista de comenzi are 20 de rânduri; lăsăm loc de rezervă. */
const MAX_IDS = 100

const ORDER_ID = /^order_[A-Za-z0-9]+$/

/**
 * Metoda de plată pentru un set de comenzi, pentru coloana „Metodă de plată”
 * din lista de comenzi a adminului.
 *
 *   GET /admin/order-payment-methods?ids=order_1,order_2
 *
 * Nu stă sub `/admin/orders/`: middleware-ul nativ pe `GET /admin/orders/:id`
 * ar prinde și `/admin/orders/payment-methods` și l-ar valida ca pe o comandă.
 *
 * Lista nativă cere doar `*payment_collections`, fără sesiuni, deci providerul
 * nu se poate citi din ce are deja pagina — îl cerem separat, o dată pe pagină.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const raw = String(req.query.ids ?? "")
  const ids = Array.from(
    new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => ORDER_ID.test(id))
    )
  ).slice(0, MAX_IDS)

  if (!ids.length) {
    return res.json({ methods: {} })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "payment_collections.payments.provider_id",
      "payment_collections.payment_sessions.provider_id",
    ],
    filters: { id: ids },
  })

  const methods: Record<string, PaymentMethod | null> = {}
  for (const order of orders ?? []) {
    methods[order.id] = describeOrderPayment(order)
  }

  return res.json({ methods })
}
