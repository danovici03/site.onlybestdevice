/**
 * Pune numele în fișele clienților fără cont, din comenzile lor.
 *
 * Medusa creează clientul vizitator doar cu emailul, așa că în admin apărea
 * emailul în loc de nume. Comenzile noi se rezolvă singure (subscriberul
 * `order-guest-customer-name.ts`); scriptul ăsta repară clienții de dinainte.
 *
 * Pentru fiecare client fără cont ia cea mai nouă comandă care are nume în
 * adresa de facturare sau de livrare — aceeași regulă ca subscriberul („ultima
 * comandă câștigă”). Clienții cu cont nu se ating, iar fișele care au deja
 * numele ăsta se sar. Idempotent.
 *
 * Rulare:  cd backend && yarn medusa exec ./src/scripts/backfill-guest-customer-names.ts
 *   DRY_RUN=1   doar raport, fără scriere
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import {
  ORDER_NAME_FIELDS,
  fullName,
  guestCustomerName,
  type OrderNameSource,
} from "../lib/orders/customer-name"

const orderHasName = (order: OrderNameSource) =>
  !!fullName(order.billing_address) || !!fullName(order.shipping_address)

const PAGE = 200

export default async function backfillGuestCustomerNames({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const customers = container.resolve(Modules.CUSTOMER)
  const dryRun = !!process.env.DRY_RUN
  const decided = new Set<string>()

  // Cea mai nouă comandă câștigă: o parcurgem prima și o reținem.
  const updates = new Map<
    string,
    { first_name: string; last_name: string; email: string; order: number }
  >()

  for (let skip = 0; ; skip += PAGE) {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", ...ORDER_NAME_FIELDS],
      // `id` departajează comenzile cu același created_at, altfel paginile
      // se pot suprapune.
      pagination: { skip, take: PAGE, order: { created_at: "DESC", id: "ASC" } },
    })

    for (const order of orders ?? []) {
      const id = order.customer?.id
      // Doar cea mai nouă comandă cu nume decide; cele mai vechi nu contează.
      if (!id || decided.has(id)) continue
      if (!orderHasName(order as any)) continue
      decided.add(id)
      const name = guestCustomerName(order as any)
      if (name) {
        updates.set(id, {
          ...name,
          email: order.customer?.email ?? "",
          order: Number(order.display_id),
        })
      }
    }

    if (!orders || orders.length < PAGE) break
  }

  for (const [id, u] of updates) {
    logger.info(
      `${dryRun ? "[DRY_RUN] " : ""}${u.email} → ${u.first_name} ${u.last_name} (din comanda #${u.order})`
    )
    if (!dryRun) {
      await customers.updateCustomers(id, {
        first_name: u.first_name,
        last_name: u.last_name,
      })
    }
  }

  logger.info(
    `${dryRun ? "[DRY_RUN] De completat" : "Completat"}: ${updates.size} clienți fără cont.`
  )
}
