import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"

const BodySchema = z.object({
  /** Mesaj opțional adăugat de operator în email (ex. „te așteptăm până vineri"). */
  note: z.string().max(1000).optional(),
  /** Trimite din nou chiar dacă notificarea a fost deja trimisă. */
  force: z.boolean().optional(),
})

/**
 * Anunță clientul că o comandă cu ridicare personală este disponibilă în magazin.
 *
 * POST /admin/orders/:id/notify-pickup-ready
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderService = req.scope.resolve(Modules.ORDER)
  const notification = req.scope.resolve(Modules.NOTIFICATION)

  const parsed = BodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message })
  }
  const { note, force } = parsed.data

  const orderId = req.params.id

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
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
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) {
    return res.status(404).json({ message: `Comanda ${orderId} nu există.` })
  }
  if (!order.email) {
    return res
      .status(400)
      .json({ message: "Comanda nu are adresă de email a clientului." })
  }

  const alreadySentAt = (order.metadata as Record<string, any> | null)
    ?.pickup_ready_notified_at
  if (alreadySentAt && !force) {
    return res.status(409).json({
      message: `Clientul a fost deja anunțat la ${alreadySentAt}. Trimite cu force=true pentru a repeta.`,
      pickup_ready_notified_at: alreadySentAt,
    })
  }

  try {
    await notification.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-ready-for-pickup",
      data: {
        order,
        note,
        storefront_url: process.env.STOREFRONT_URL,
      },
    })
  } catch (e: any) {
    const msg = String(e?.message ?? e)
    // Providerul de email e înregistrat doar când RESEND_API_KEY există.
    if (/notification provider/i.test(msg)) {
      logger.warn(`pickup-ready: provider de email lipsă — ${msg}`)
      return res.status(503).json({
        message:
          "Emailurile nu sunt configurate pe acest server (lipsește RESEND_API_KEY).",
      })
    }
    logger.error(`pickup-ready: trimitere eșuată pentru ${order.id} — ${msg}`)
    return res
      .status(502)
      .json({ message: `Emailul nu a putut fi trimis: ${msg}` })
  }

  const sentAt = new Date().toISOString()
  await orderService.updateOrders(order.id, {
    metadata: {
      ...((order.metadata as Record<string, any>) ?? {}),
      pickup_ready_notified_at: sentAt,
    },
  })

  logger.info(
    `pickup-ready: notificare trimisă pentru comanda #${order.display_id} → ${order.email}`,
  )

  return res.json({ ok: true, pickup_ready_notified_at: sentAt })
}
