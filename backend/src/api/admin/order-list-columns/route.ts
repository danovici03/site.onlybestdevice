import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  ORDER_NAME_FIELDS,
  orderCustomerName,
} from "../../../lib/orders/customer-name"
import { listOrderProducts } from "../../../lib/orders/order-products"
import {
  describeOrderPayment,
  type PaymentMethod,
} from "../../../lib/orders/payment-method"

/** O pagină din lista de comenzi are 20 de rânduri; lăsăm loc de rezervă. */
const MAX_IDS = 100

const ORDER_ID = /^order_[A-Za-z0-9]+$/

export type OrderListColumns = {
  customer: string | null
  payment: PaymentMethod | null
  products: string[]
}

/**
 * Datele coloanelor pe care le adăugăm în lista de comenzi a adminului
 * („Client”, „Produs vândut” și „Metodă de plată”), pentru un set de comenzi.
 *
 *   GET /admin/order-list-columns?ids=order_1,order_2
 *
 * Nu stă sub `/admin/orders/`: middleware-ul nativ pe `GET /admin/orders/:id`
 * ar prinde și `/admin/orders/list-columns` și l-ar valida ca pe o comandă.
 *
 * Lista nativă nu cere nici liniile comenzii, nici sesiunile de plată, deci
 * nimic din ce ne trebuie nu se poate citi din ce are deja pagina — cerem
 * separat, o dată pe pagină.
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
    return res.json({ orders: {} })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      ...ORDER_NAME_FIELDS,
      // `items.*`, nu câmpuri una câte una: altfel `quantity` vine undefined.
      "items.*",
      "payment_collections.payments.provider_id",
      "payment_collections.payment_sessions.provider_id",
    ],
    filters: { id: ids },
  })

  const columns: Record<string, OrderListColumns> = {}
  for (const order of orders ?? []) {
    columns[order.id] = {
      customer: orderCustomerName(order as any),
      payment: describeOrderPayment(order),
      products: listOrderProducts(order.items as any),
    }
  }

  return res.json({ orders: columns })
}
