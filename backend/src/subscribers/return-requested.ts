import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { RETURN_REQUEST_MODULE } from "../modules/return-request"
import type ReturnRequestModuleService from "../modules/return-request/service"

// Emis de rutele de cerere retur (din cont și pentru vizitatori). Cererea stă
// în modulul `return_request`; aici trimitem emailurile către magazin și client.
export default async function returnRequestedHandler({
  event,
  container,
}: SubscriberArgs<{ order_id: string; request_id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notification = container.resolve(Modules.NOTIFICATION)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const service: ReturnRequestModuleService = container.resolve(
    RETURN_REQUEST_MODULE,
  )

  const request = (await service
    .retrieveReturnRequest(event.data.request_id)
    .catch(() => null)) as any
  if (!request) {
    logger.warn(`return.requested: request ${event.data.request_id} not found`)
    return
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "customer_id",
      "items.id",
      "items.product_title",
      "items.title",
      "items.variant_title",
      "items.thumbnail",
      "items.*",
      "shipping_address.first_name",
      "shipping_address.last_name",
    ],
    filters: { id: request.order_id },
  })
  const order = orders?.[0]
  if (!order) {
    logger.warn(`return.requested: order ${request.order_id} not found`)
    return
  }

  const sends: Promise<unknown>[] = []
  const adminUrl = process.env.MEDUSA_BACKEND_URL || process.env.ADMIN_URL
  const storefrontUrl = process.env.STOREFRONT_URL
  const adminTo = process.env.ADMIN_ORDER_NOTIFICATION_EMAIL
  const to = request.email || order.email

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

  if (to) {
    sends.push(
      notification.createNotifications({
        to,
        channel: "email",
        template: "return-requested-customer",
        data: { order, request, storefront_url: storefrontUrl },
      }),
    )
  }

  await Promise.all(sends)
}

export const config: SubscriberConfig = {
  event: "return.requested",
}
