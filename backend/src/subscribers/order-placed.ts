import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import {
  ORDER_EMAIL_FIELDS,
  markEmails,
  sendOrderPlacedEmails,
} from "../lib/orders/order-emails"
import { awaitsCardPayment } from "../lib/orders/payment-state"

export default async function orderPlacedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ORDER_EMAIL_FIELDS,
    filters: { id: event.data.id },
  })

  const order = orders?.[0]
  if (!order) {
    logger.warn(`order.placed: order ${event.data.id} not found`)
    return
  }

  // Card neplătit încă: emailurile pleacă la `payment.captured`, nu acum.
  if (awaitsCardPayment(order)) {
    await markEmails(container, order, { order_placed_deferred: true })
    logger.info(
      `order.placed: comanda ${order.id} așteaptă plata cu cardul — amân emailurile.`
    )
    return
  }

  await sendOrderPlacedEmails(container, order)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
