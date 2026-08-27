import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"

import { ORDER_EMAIL_FIELDS } from "../../../../../lib/orders/order-emails"
import {
  ORDER_STATUS_FIELDS,
  canSendPaymentLink,
  isCodOrder,
  isFinancedOrder,
} from "../../../../../lib/orders/order-status"

const BodySchema = z.object({
  /** Text liber inclus în email. */
  note: z.string().max(1000).optional(),
})

/** Providerul de card. Id-ul e `pp_<modul>_<serviciu>`. */
const NETOPIA_PROVIDER_ID =
  process.env.NETOPIA_PAYMENT_PROVIDER_ID || "pp_netopia_netopia"

const FIELDS = Array.from(
  new Set([
    ...ORDER_STATUS_FIELDS,
    ...ORDER_EMAIL_FIELDS,
    "total",
  ])
)

/**
 * Trimite clientului un link de plată cu cardul pentru o comandă neîncasată.
 *
 *   POST /admin/orders/:id/payment-link
 *
 * Acoperă trei situații cu un singur buton: plata cu cardul a eșuat, clientul a
 * ales viramentul dar preferă cardul, sau plata pur și simplu n-a fost dusă
 * până la capăt.
 *
 * Linkul duce la `/order/:id/pay`, care deschide o sesiune Netopia PROASPĂTĂ la
 * fiecare afișare — deci nu expiră și poate fi retrimis oricând. Tot pagina
 * aceea mută comanda pe plata cu cardul, dacă era pe altă metodă, și o face
 * abia când clientul apasă efectiv: o comandă pe ordin de plată trebuie să
 * rămână „în așteptarea viramentului" până când clientul alege altfel, nu din
 * secunda în care operatorul a apăsat „trimite".
 *
 * Rambursul e refuzat intenționat: are deja o plată autorizată pe care curierul
 * o încasează la livrare, iar un link de card ar putea produce o a doua plată.
 * Ratele la fel — dosarul de finanțare se închide la partener.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderModule = req.scope.resolve(Modules.ORDER)
  const notification = req.scope.resolve(Modules.NOTIFICATION)

  const parsed = BodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message })
  }
  const { note } = parsed.data

  const orderId = req.params.id
  const { data: orders } = await query.graph({
    entity: "order",
    fields: FIELDS,
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
  if (!canSendPaymentLink(order)) {
    const reason = isCodOrder(order)
      ? "Comanda e cu plata la livrare — se încasează de curier, nu online."
      : isFinancedOrder(order)
        ? "Comanda e în rate; plata se face prin partenerul de finanțare."
        : "Comanda nu mai așteaptă o plată."
    return res.status(400).json({ message: reason })
  }

  const storefrontUrl = (
    process.env.STOREFRONT_URL || "http://localhost:8000"
  ).replace(/\/$/, "")
  const locale = process.env.STOREFRONT_LOCALE || "ro"
  const payUrl = `${storefrontUrl}/${locale}/order/${order.id}/pay`

  try {
    await notification.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-payment-link",
      data: {
        order,
        pay_url: payUrl,
        note: note ?? null,
        storefront_url: process.env.STOREFRONT_URL,
      },
    })
  } catch (e: any) {
    logger.error(
      `[payment-link] Emailul pentru ${order.id} nu a plecat: ${e?.message}`
    )
    return res
      .status(502)
      .json({ message: e?.message || "Emailul nu a putut fi trimis." })
  }

  const metadata = (order.metadata ?? {}) as Record<string, any>
  const sentAt = new Date().toISOString()
  await orderModule.updateOrders(order.id, {
    metadata: {
      ...metadata,
      payment_link: {
        sent_at: sentAt,
        count: Number(metadata.payment_link?.count ?? 0) + 1,
      },
    },
  })

  logger.info(`[payment-link] Link de plată trimis pentru ${order.id}.`)

  return res.json({ sent_at: sentAt, pay_url: payUrl, to: order.email })
}
