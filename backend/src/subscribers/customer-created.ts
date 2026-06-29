import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

export default async function customerCreatedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notification = container.resolve(Modules.NOTIFICATION)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name", "has_account"],
    filters: { id: event.data.id },
  })

  const customer = customers?.[0]
  if (!customer?.email) {
    logger.warn(`customer.created: customer ${event.data.id} has no email`)
    return
  }

  // Skip guest customers created during checkout — they don't have an account
  // and would receive a welcome email they didn't ask for.
  if (!customer.has_account) {
    return
  }

  await notification.createNotifications({
    to: customer.email,
    channel: "email",
    template: "customer-welcome",
    data: {
      customer,
      storefront_url: process.env.STOREFRONT_URL,
    },
  })
}

export const config: SubscriberConfig = {
  event: "customer.created",
}
