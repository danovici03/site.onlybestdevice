import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import {
  ORDER_NAME_FIELDS,
  guestCustomerName,
} from "../lib/orders/customer-name"

/**
 * Copiază numele din adresa comenzii în fișa unui client fără cont.
 *
 * La checkout ca vizitator Medusa creează clientul doar cu emailul, deci în
 * admin (lista de comenzi, pagina Clienți) apărea emailul în loc de nume.
 * Fișa e una pe email, deci se rescrie cu numele ultimei comenzi (aceeași
 * regulă ca scriptul de completare); clienții cu cont nu se ating.
 * Pentru comenzile dinainte: scripts/backfill-guest-customer-names.ts.
 */
export default async function orderGuestCustomerNameHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", ...ORDER_NAME_FIELDS],
      filters: { id: event.data.id },
    })

    const order = orders?.[0]
    const name = order ? guestCustomerName(order as any) : null
    if (!order?.customer?.id || !name) return

    await container
      .resolve(Modules.CUSTOMER)
      .updateCustomers(order.customer.id, name)
  } catch (error) {
    // Doar cosmetic în admin — nu are voie să încurce plasarea comenzii.
    logger.warn(
      `order.placed: nu am putut pune numele clientului pe comanda ${event.data.id}: ${
        (error as Error).message
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
