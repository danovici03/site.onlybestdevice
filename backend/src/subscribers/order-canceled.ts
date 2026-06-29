import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

export default async function orderCanceledHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notification = container.resolve(Modules.NOTIFICATION)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "total",
      "items.product_title",
      "items.product_handle",
      "items.title",
      "items.variant_title",
      "items.thumbnail",
      "items.quantity",
      "items.total",
      "shipping_address.first_name",
    ],
    filters: { id: event.data.id },
  })

  const order = orders?.[0]
  if (!order) {
    logger.warn(`order.canceled: order ${event.data.id} not found`)
    return
  }

  if (!order.email) {
    logger.warn(`order.canceled: order ${order.id} has no customer email`)
    return
  }

  await notification.createNotifications({
    to: order.email,
    channel: "email",
    template: "order-canceled-customer",
    data: { order, storefront_url: process.env.STOREFRONT_URL },
  })
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
