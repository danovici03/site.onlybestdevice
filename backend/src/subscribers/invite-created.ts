import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

export default async function inviteCreatedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notification = container.resolve(Modules.NOTIFICATION)
  const userModule = container.resolve(Modules.USER)

  const invite = await userModule.retrieveInvite(event.data.id)
  if (!invite?.email || !invite.token) {
    logger.warn(`invite.created: invite ${event.data.id} missing email/token`)
    return
  }

  await notification.createNotifications({
    to: invite.email,
    channel: "email",
    template: "invite-created",
    data: {
      invite,
      admin_url: process.env.MEDUSA_BACKEND_URL || process.env.ADMIN_URL,
    },
  })
}

export const config: SubscriberConfig = {
  event: ["invite.created", "invite.resent"],
}
