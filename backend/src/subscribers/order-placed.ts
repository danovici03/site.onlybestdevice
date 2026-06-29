import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

export default async function orderPlacedHandler({
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
      "items.*",
      "items.product_title",
      "items.product_handle",
      "items.variant_title",
      "items.thumbnail",
      "items.total",
      "shipping_address.*",
    ],
    filters: { id: event.data.id },
  })

  const order = orders?.[0]
  if (!order) {
    logger.warn(`order.placed: order ${event.data.id} not found`)
    return
  }

  const storefrontUrl = process.env.STOREFRONT_URL
  const adminUrl = process.env.MEDUSA_BACKEND_URL || process.env.ADMIN_URL
  const adminTo = process.env.ADMIN_ORDER_NOTIFICATION_EMAIL

  const sends: Promise<unknown>[] = []

  if (order.email) {
    sends.push(
      notification.createNotifications({
        to: order.email,
        channel: "email",
        template: "order-placed-customer",
        data: { order, storefront_url: storefrontUrl },
      }),
    )
  } else {
    logger.warn(`order.placed: order ${order.id} has no customer email`)
  }

  if (adminTo) {
    sends.push(
      notification.createNotifications({
        to: adminTo,
        channel: "email",
        template: "order-placed-admin",
        data: { order, admin_url: adminUrl },
      }),
    )
  }

  await Promise.all(sends)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
