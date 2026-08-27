import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/core-flows"
import { z } from "zod"

import { hasBankAccount } from "../../../../../lib/company/bank-account"
import { ORDER_EMAIL_FIELDS } from "../../../../../lib/orders/order-emails"
import {
  ORDER_STATUS_CODES,
  ORDER_STATUS_FIELDS,
  ORDER_STATUS_LABELS,
  canSendPaymentLink,
  effectiveOrderStatus,
  orderStateSnapshot,
  isCodOrder,
  isFinancedOrder,
  type OrderStatusCode,
} from "../../../../../lib/orders/order-status"

const BodySchema = z.object({
  code: z.enum(ORDER_STATUS_CODES as [OrderStatusCode, ...OrderStatusCode[]]),
  /** Text liber inclus în email („așteptăm stocul, estimare 5 zile"). */
  note: z.string().max(1000).optional(),
  /** Trimite emailul de status către client. Implicit nu. */
  notify: z.boolean().optional(),
})

/** Statusurile care au email propriu, cu instrucțiuni concrete. */
const TEMPLATE_FOR: Partial<Record<OrderStatusCode, string>> = {
  awaiting_bank_transfer: "order-bank-transfer",
}

const FIELDS = Array.from(
  new Set([...ORDER_STATUS_FIELDS, ...ORDER_EMAIL_FIELDS])
)

/**
 * Starea de status a comenzii, gata de afișat în cardul din admin.
 *
 *   GET /admin/orders/:id/status
 *
 * Widget-ul o cere de aici în loc să calculeze singur: regula de derivare ar
 * ajunge altfel duplicată în bundle-ul de admin și ar începe să difere de cea
 * din backend la prima modificare.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: FIELDS,
    filters: { id: req.params.id },
  })

  const order = orders?.[0]
  if (!order) {
    return res.status(404).json({ message: "Comanda nu există." })
  }

  const status = effectiveOrderStatus(order)
  const metadata = (order.metadata ?? {}) as Record<string, any>

  const linkBlockedReason = canSendPaymentLink(order)
    ? null
    : isCodOrder(order)
      ? "Comandă cu plata la livrare — se încasează de curier."
      : isFinancedOrder(order)
        ? "Comandă în rate — plata se face prin partener."
        : "Comanda nu mai așteaptă o plată."

  return res.json({
    status,
    derived: {
      code: status.derived,
      label: ORDER_STATUS_LABELS[status.derived],
    },
    medusa: {
      // Calculate la citire, deci absente din tipul `Order` al lui query.graph.
      payment_status: (order as any).payment_status ?? null,
      fulfillment_status: (order as any).fulfillment_status ?? null,
    },
    can_send_payment_link: canSendPaymentLink(order),
    payment_link_blocked_reason: linkBlockedReason,
    payment_link: metadata.payment_link ?? null,
    history: Array.isArray(metadata.order_status_history)
      ? metadata.order_status_history.slice(-5).reverse()
      : [],
    options: ORDER_STATUS_CODES.map((code) => ({
      code,
      label: ORDER_STATUS_LABELS[code],
    })),
  })
}

/**
 * Pune statusul comercial al unei comenzi.
 *
 *   POST /admin/orders/:id/status
 *   { "code": "pending", "note": "așteptăm stocul", "notify": true }
 *
 * „Anulată" nu e o etichetă, ci o acțiune: rulează `cancelOrderWorkflow`, care
 * eliberează rezervările de stoc și anulează plățile. Fără asta, stocul unei
 * comenzi „anulate" din admin ar rămâne blocat la nesfârșit. Emailul de anulare
 * pleacă singur, din subscriberul `order.canceled` — de aceea `notify` e
 * ignorat acolo, ca să nu primească clientul două.
 *
 * Restul statusurilor sunt etichete peste starea reală, ținute în
 * `metadata.order_status`. Expiră singure când starea derivată se schimbă (vezi
 * `lib/orders/order-status.ts`).
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
  const { code, note, notify } = parsed.data

  /**
   * Emailul de virament e degeaba fără IBAN, iar clientul n-are cum să-și dea
   * seama că lipsește ceva — vede doar un email care nu-i spune unde să
   * plătească. Mai bine oprim operatorul aici, cu un mesaj pe care îl poate
   * acționa, decât să plece emailul.
   */
  if (code === "awaiting_bank_transfer" && notify && !hasBankAccount()) {
    return res.status(400).json({
      message:
        "Contul bancar nu e configurat (BANK_IBAN), deci emailul de virament nu poate fi trimis. " +
        "Setează statusul fără notificare sau completează BANK_IBAN în env.",
    })
  }

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

  const current = effectiveOrderStatus(order)

  if (code === "canceled") {
    if (current.derived === "canceled") {
      return res.status(409).json({ message: "Comanda e deja anulată." })
    }
    try {
      await cancelOrderWorkflow(req.scope).run({
        input: { order_id: order.id },
      })
    } catch (e: any) {
      logger.error(`[status] Anularea comenzii ${order.id} a eșuat: ${e?.message}`)
      return res.status(400).json({
        message: e?.message || "Comanda nu a putut fi anulată.",
      })
    }
    logger.info(`[status] Comanda ${order.id} a fost anulată din admin.`)
    return res.json({
      status: {
        code: "canceled",
        label: ORDER_STATUS_LABELS.canceled,
        note: null,
        manual: false,
        derived: "canceled",
      },
      /**
       * Emailul de anulare pleacă din subscriberul `order.canceled`, care are
       * propriile motive să nu trimită (client fără email, Resend picat).
       * Ruta asta n-are cum să știe rezultatul, deci nu îl pretinde — altfel
       * adminul ar afișa „email trimis" pentru un email care n-a plecat.
       */
      notified: false,
    })
  }

  const metadata = (order.metadata ?? {}) as Record<string, any>
  const entry = {
    code,
    note: note ?? null,
    at: new Date().toISOString(),
    by: (req as any).auth_context?.actor_id ?? null,
    snapshot: orderStateSnapshot(order),
  }

  const history = Array.isArray(metadata.order_status_history)
    ? metadata.order_status_history
    : []

  await orderModule.updateOrders(order.id, {
    metadata: {
      ...metadata,
      order_status: entry,
      // Ultimele 20 de schimbări; mai mult n-ar face decât să umfle metadata.
      order_status_history: [...history, entry].slice(-20),
    },
  })

  let notified = false
  if (notify && order.email) {
    /**
     * Emailul de virament conține și butonul „plătește cu cardul". Linkul e
     * același `/order/:id/pay`: pagina mută comanda pe card abia dacă îl apasă
     * clientul, deci până atunci comanda rămâne pe ordin de plată.
     */
    const storefrontUrl = (
      process.env.STOREFRONT_URL || "http://localhost:8000"
    ).replace(/\/$/, "")
    const payUrl = canSendPaymentLink(order)
      ? `${storefrontUrl}/${process.env.STOREFRONT_LOCALE || "ro"}/order/${order.id}/pay`
      : null

    try {
      await notification.createNotifications({
        to: order.email,
        channel: "email",
        template: TEMPLATE_FOR[code] ?? "order-status-changed",
        data: {
          order,
          status_label: ORDER_STATUS_LABELS[code],
          note: note ?? null,
          pay_url: payUrl,
          storefront_url: process.env.STOREFRONT_URL,
        },
      })
      notified = true
    } catch (e: any) {
      logger.warn(
        `[status] Nu am putut trimite emailul de status pentru ${order.id}: ${e?.message}`
      )
    }
  }

  logger.info(
    `[status] Comanda ${order.id} → ${ORDER_STATUS_LABELS[code]}${notified ? " (email trimis)" : ""}.`
  )

  return res.json({
    status: {
      code,
      label: ORDER_STATUS_LABELS[code],
      note: note ?? null,
      manual: true,
      derived: current.derived,
    },
    notified,
  })
}
