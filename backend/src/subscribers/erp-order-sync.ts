import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { isErpConfigured, postToErp } from "../lib/erp/client"
import { fetchErpOrderPayload, orderIdForPayment } from "../lib/erp/order-payload"

/**
 * Trimite comenzile catre ERP-ul din Laravel (gestiunea de stoc si vanzari),
 * echivalentul webhook-ului `order.*` din WooCommerce.
 *
 * Trimitem la fiecare eveniment relevant payload-ul COMPLET si curent al comenzii,
 * nu un delta: handler-ul din Laravel e idempotent (pe medusa_order_id si pe
 * schimbarea de status), deci o retrimitere e inofensiva, iar un eveniment pierdut
 * se repara de la sine la urmatorul.
 *
 * Config necesar (backend/.env):
 *   ERP_WEBHOOK_URL=https://gestiune.example.ro/webhooks/medusa/order
 *   ERP_WEBHOOK_SECRET=<acelasi cu MEDUSA_WEBHOOK_SECRET din Laravel>
 */

/** Evenimente al caror payload contine direct id-ul comenzii. */
const ORDER_ID_EVENTS = new Set([
  "order.placed",
  "order.canceled",
  "order.completed",
  "order.updated",
  "order.archived",
])

/** Evenimente care trimit `order_id` (fulfillment, retururi, schimburi). */
const ORDER_REF_EVENTS = new Set([
  "order.fulfillment_created",
  "order.fulfillment_canceled",
  "order.return_received",
  "order.claim_created",
  "order.exchange_created",
])

/** Evenimente de plata: payload-ul are id-ul platii, comanda se rezolva prin link. */
const PAYMENT_EVENTS = new Set(["payment.captured", "payment.refunded"])

export default async function erpOrderSync({
  event,
  container,
}: SubscriberArgs<{ id?: string; order_id?: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (!isErpConfigured()) {
    return
  }

  const orderId = await resolveOrderId(event, container)

  if (!orderId) {
    logger.warn(`[erp] ${event.name}: nu am putut determina comanda — sar peste.`)
    return
  }

  const payload = await fetchErpOrderPayload(container, orderId)

  if (!payload) {
    logger.warn(`[erp] ${event.name}: comanda ${orderId} nu a fost gasita.`)
    return
  }

  if (!payload.line_items.length) {
    logger.warn(`[erp] ${event.name}: comanda ${orderId} nu are linii — ERP-ul ar respinge-o.`)
    return
  }

  const result = await postToErp(event.name, payload as unknown as Record<string, unknown>, logger)

  if (result.ok) {
    logger.info(
      `[erp] ${event.name} → comanda #${payload.display_id ?? orderId} trimisa (status canonic: ${payload.status}).`,
    )
  }
}

const resolveOrderId = async (
  event: { name: string; data: { id?: string; order_id?: string } },
  container: any,
): Promise<string | null> => {
  const data = event.data ?? {}

  if (ORDER_ID_EVENTS.has(event.name)) {
    return data.id ?? null
  }

  if (ORDER_REF_EVENTS.has(event.name)) {
    return data.order_id ?? null
  }

  if (PAYMENT_EVENTS.has(event.name) && data.id) {
    return orderIdForPayment(container, data.id)
  }

  return data.order_id ?? data.id ?? null
}

export const config: SubscriberConfig = {
  event: [
    ...ORDER_ID_EVENTS,
    ...ORDER_REF_EVENTS,
    ...PAYMENT_EVENTS,
  ],
}
