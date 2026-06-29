import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

export default async function shipmentCreatedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (event.data.no_notification) return

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notification = container.resolve(Modules.NOTIFICATION)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // Find the fulfillment + its order via the fulfillment-order link.
  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: [
      "id",
      "tracking_numbers",
      "labels.*",
      "order.id",
      "order.display_id",
      "order.email",
      "order.currency_code",
    ],
    filters: { id: event.data.id },
  })

  const shipment = fulfillments?.[0]
  const order = (shipment as any)?.order
  if (!shipment || !order?.email) {
    logger.warn(
      `shipment.created: missing order/email for fulfillment ${event.data.id}`,
    )
    return
  }

  await notification.createNotifications({
    to: order.email,
    channel: "email",
    template: "shipment-created",
    data: {
      order,
      shipment,
      storefront_url: process.env.STOREFRONT_URL,
    },
  })
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
