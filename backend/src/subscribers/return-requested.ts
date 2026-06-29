import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

// Emitted by our custom POST /store/orders/:id/return-request route.
export default async function returnRequestedHandler({
  event,
  container,
}: SubscriberArgs<{ order_id: string; request_id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notification = container.resolve(Modules.NOTIFICATION)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "metadata",
      "items.id",
      "items.product_title",
      "items.product_handle",
      "items.title",
      "items.variant_title",
      "items.thumbnail",
      "items.quantity",
      "shipping_address.first_name",
      "shipping_address.last_name",
    ],
    filters: { id: event.data.order_id },
  })

  const order = orders?.[0]
  if (!order) {
    logger.warn(`return.requested: order ${event.data.order_id} not found`)
    return
  }

  const requests =
    (order.metadata?.return_requests as Array<Record<string, any>> | undefined) ??
    []
  const request = requests.find((r) => r.id === event.data.request_id)
  if (!request) {
    logger.warn(
      `return.requested: request ${event.data.request_id} not on order metadata`,
    )
    return
  }

  const sends: Promise<unknown>[] = []
  const adminUrl = process.env.MEDUSA_BACKEND_URL || process.env.ADMIN_URL
  const storefrontUrl = process.env.STOREFRONT_URL
  const adminTo = process.env.ADMIN_ORDER_NOTIFICATION_EMAIL

  if (adminTo) {
    sends.push(
      notification.createNotifications({
        to: adminTo,
        channel: "email",
        template: "return-requested-admin",
        data: { order, request, admin_url: adminUrl, storefront_url: storefrontUrl },
      }),
    )
  } else {
    logger.warn(
      "return.requested: ADMIN_ORDER_NOTIFICATION_EMAIL not set — skipping admin notification",
    )
  }

  if (order.email) {
    sends.push(
      notification.createNotifications({
        to: order.email,
        channel: "email",
        template: "return-requested-customer",
        data: { order, request, storefront_url: storefrontUrl },
      }),
    )
  } else {
    logger.warn(
      `return.requested: order ${order.id} has no customer email — skipping customer notification`,
    )
  }

  await Promise.all(sends)
}

export const config: SubscriberConfig = {
  event: "return.requested",
}
