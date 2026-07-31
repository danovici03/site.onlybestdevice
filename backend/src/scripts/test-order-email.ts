/**
 * Test manual al emailului de comandă: randează șabloanele „order-placed-*"
 * cu ultima comandă din baza de date și le trimite prin providerul configurat
 * (Resend). Se rulează cu:
 *
 *   npx medusa exec ./src/scripts/test-order-email.ts [email-destinatar]
 *
 * Diagnostic, ca `check-s3.ts`: verifică lanțul env → provider → șablon fără
 * să fie nevoie de o comandă nouă. Nu e folosit de aplicație.
 */
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"

export default async function testOrderEmail({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notification = container.resolve(Modules.NOTIFICATION)

  const to = args?.[0] || process.env.ADMIN_ORDER_NOTIFICATION_EMAIL
  if (!to) {
    logger.error("Dă un email destinatar ca argument.")
    return
  }

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
      "items.variant_title",
      "items.thumbnail",
      "items.total",
      "shipping_address.*",
    ],
    pagination: { take: 1, order: { created_at: "DESC" } },
  })

  const order = orders?.[0]
  if (!order) {
    logger.error("Nu există nicio comandă în baza de date.")
    return
  }

  logger.info(`Trimit emailurile pentru comanda #${order.display_id} către ${to}`)

  for (const template of ["order-placed-customer", "order-placed-admin"]) {
    const res = await notification.createNotifications({
      to,
      channel: "email",
      template,
      data: {
        order,
        storefront_url: process.env.STOREFRONT_URL,
        admin_url: process.env.MEDUSA_BACKEND_URL,
      },
    })
    logger.info(`${template}: trimis (id ${(res as any)?.id ?? "?"})`)
  }
}
