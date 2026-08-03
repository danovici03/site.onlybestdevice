import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { orderIdForPayment } from "../lib/erp/order-payload"
import {
  ORDER_EMAIL_FIELDS,
  hasDeferredEmails,
  markEmails,
  sendOrderPlacedEmails,
} from "../lib/orders/order-emails"

/**
 * Trimite confirmarea de comandă abia când banii au intrat.
 *
 * Se aplică doar comenzilor la care `order.placed` a amânat emailurile (plată
 * cu cardul pe pagina băncii). Pentru ramburs sau alte metode, emailul a
 * plecat deja la plasare, deci aici nu se întâmplă nimic.
 */
export default async function orderPaidHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const orderId = await orderIdForPayment(container, event.data.id)
  if (!orderId) {
    logger.warn(
      `payment.captured: nu am putut determina comanda pentru plata ${event.data.id}`
    )
    return
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ORDER_EMAIL_FIELDS,
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) return

  // Fără flag înseamnă ori că emailul a plecat la plasare, ori că a plecat
  // deja de aici — în ambele cazuri nu retrimitem.
  if (!hasDeferredEmails(order)) return

  await sendOrderPlacedEmails(container, order)
  await markEmails(container, order, {
    order_placed_sent: new Date().toISOString(),
  })

  logger.info(
    `payment.captured: comanda ${order.id} e plătită — am trimis confirmarea.`
  )
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
