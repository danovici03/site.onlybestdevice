import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

type PasswordResetPayload = {
  entity_id: string
  actor_type: "customer" | "user"
  token: string
  metadata?: Record<string, unknown>
}

export default async function passwordResetHandler({
  event,
  container,
}: SubscriberArgs<PasswordResetPayload>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notification = container.resolve(Modules.NOTIFICATION)

  const { entity_id, actor_type, token } = event.data
  if (!entity_id || !token) {
    logger.warn("auth.password_reset: missing entity_id or token")
    return
  }

  await notification.createNotifications({
    to: entity_id,
    channel: "email",
    template: "password-reset",
    data: {
      entity_id,
      actor_type,
      token,
      storefront_url: process.env.STOREFRONT_URL,
      admin_url: process.env.MEDUSA_BACKEND_URL || process.env.ADMIN_URL,
    },
  })
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
