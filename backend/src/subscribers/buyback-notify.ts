import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { toEmailOrder } from "../lib/buyback/email-order"
import { buybackService } from "../lib/buyback/orders"

/**
 * Emailurile preluărilor: la trimitere (client + magazin), la fiecare
 * schimbare de status (client) și, când clientul răspunde la oferta
 * revizuită, și magazinului — altfel plata sau returul așteaptă până se uită
 * cineva în admin. La fel când clientul trimite datele pentru borderou. Emise din rutele `buyback/orders`.
 */
export default async function buybackNotify({
  event,
  container,
}: SubscriberArgs<{ id: string; by?: "admin" | "customer" }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notification = container.resolve(Modules.NOTIFICATION)
  const full = (await buybackService(container).retrieveBuybackOrder(event.data.id).catch(() => null)) as any
  if (!full) {
    logger.warn(`${event.name}: preluarea ${event.data.id} nu există`)
    return
  }
  const order = toEmailOrder(full) as any
  const by = event.data.by ?? "admin"

  const storefront_url = process.env.STOREFRONT_URL
  const admin_url = process.env.MEDUSA_BACKEND_URL || process.env.ADMIN_URL
  const sends: Promise<unknown>[] = []
  const adminTo = process.env.ADMIN_ORDER_NOTIFICATION_EMAIL

  if (event.name === "buyback.submitted") {
    sends.push(
      notification.createNotifications({
        to: order.email,
        channel: "email",
        template: "buyback-submitted-customer",
        data: { order, storefront_url },
      }),
    )
    if (adminTo) {
      sends.push(
        notification.createNotifications({
          to: adminTo,
          channel: "email",
          template: "buyback-submitted-admin",
          data: { order, admin_url, storefront_url },
        }),
      )
    }
  } else if (event.name === "buyback.identity_completed") {
    // Clientul a trimis datele pentru borderou: preluarea se poate plăti.
    if (adminTo) {
      sends.push(
        notification.createNotifications({
          to: adminTo,
          channel: "email",
          template: "buyback-identity-admin",
          data: { order, admin_url, storefront_url },
        }),
      )
    }
  } else {
    sends.push(
      notification.createNotifications({
        to: order.email,
        channel: "email",
        template: "buyback-status-customer",
        // `by` alege textul: „aprobată" de noi vs. „ai acceptat oferta".
        data: { order, storefront_url, by },
      }),
    )
    if (event.data.by === "customer" && adminTo) {
      sends.push(
        notification.createNotifications({
          to: adminTo,
          channel: "email",
          template: "buyback-customer-response-admin",
          data: { order, admin_url, storefront_url },
        }),
      )
    }
  }

  const results = await Promise.allSettled(sends)
  for (const r of results) {
    if (r.status === "rejected") logger.warn(`${event.name} #${order.display_id}: email eșuat: ${r.reason?.message ?? r.reason}`)
  }
}

export const config: SubscriberConfig = {
  event: ["buyback.submitted", "buyback.status_changed", "buyback.identity_completed"],
}
