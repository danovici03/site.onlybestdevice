import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Emailurile de comandă plasată pentru plata cu cardul se amână până când
 * banii chiar intră.
 *
 * Motivul: comanda se creează ÎNAINTE de a trimite clientul la Netopia — n-ai
 * cum altfel, providerul are nevoie de un id de comandă. Dacă trimiteam
 * confirmarea acolo, oricine ajungea pe pagina băncii și se răzgândea primea
 * „comandă confirmată" fără să fi plătit un leu, iar voi pregăteați colete
 * pentru comenzi neplătite.
 *
 * Fluxul: `order.placed` marchează comanda ca „email amânat", iar
 * `payment.captured` (IPN-ul Netopia confirmă plata) trimite efectiv.
 */

export const ORDER_EMAIL_FIELDS = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "total",
  "metadata",
  "items.*",
  "items.product_title",
  "items.product_handle",
  "items.variant_title",
  "items.thumbnail",
  "items.total",
  "shipping_address.*",
  "payment_collections.payment_sessions.provider_id",
]

/** Comandă cu plata pe pagina băncii, care încă n-a fost confirmată. */
export const awaitsCardPayment = (order: any): boolean => {
  const isNetopia = (order?.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .some((ps: any) => ps?.provider_id?.includes("netopia"))
  if (!isNetopia) return false
  return order?.metadata?.netopia?.status !== "confirmed"
}

const emailsMeta = (order: any) =>
  (order?.metadata?.emails ?? {}) as Record<string, unknown>

/** True dacă `order.placed` a amânat emailurile și încă nu le-a trimis nimeni. */
export const hasDeferredEmails = (order: any): boolean =>
  Boolean(emailsMeta(order).order_placed_deferred) &&
  !emailsMeta(order).order_placed_sent

/** Scrie un flag în `metadata.emails`, păstrând restul metadatei. */
export const markEmails = async (
  container: any,
  order: any,
  patch: Record<string, unknown>
) => {
  const orderModule = container.resolve(Modules.ORDER)
  await orderModule.updateOrders(order.id, {
    metadata: {
      ...((order.metadata ?? {}) as Record<string, unknown>),
      emails: { ...emailsMeta(order), ...patch },
    },
  })
}

/**
 * Anunță clientul că plata nu a trecut și îi dă linkul de reluare. Comanda
 * rămâne pe loc — nu o anulăm, ca el să poată relua fără să refacă coșul.
 */
export const sendPaymentFailedEmail = async (
  container: any,
  order: any,
  reason?: string | null
) => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (!order?.email) {
    logger.warn(`payment failed: comanda ${order?.id} nu are email de client`)
    return
  }
  if (emailsMeta(order).payment_failed_sent) return

  const notification = container.resolve(Modules.NOTIFICATION)
  await notification.createNotifications({
    to: order.email,
    channel: "email",
    template: "payment-failed-customer",
    data: { order, reason, storefront_url: process.env.STOREFRONT_URL },
  })
  await markEmails(container, order, {
    payment_failed_sent: new Date().toISOString(),
  })
}

/**
 * Trimite confirmarea către client și notificarea către admin. Notificarea de
 * admin pleacă doar dacă ADMIN_ORDER_NOTIFICATION_EMAIL e setat.
 */
export const sendOrderPlacedEmails = async (container: any, order: any) => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notification = container.resolve(Modules.NOTIFICATION)

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
      })
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
      })
    )
  }

  await Promise.all(sends)
}
