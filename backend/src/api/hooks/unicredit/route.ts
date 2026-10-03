import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import {
  cancelOrderWorkflow,
  capturePaymentWorkflow,
} from '@medusajs/core-flows'
import {
  ContainerRegistrationKeys,
  Modules,
} from '@medusajs/framework/utils'

/**
 * Callback-ul de statusuri de la UniCredit ePOS:
 *
 *   POST /hooks/unicredit?token=<UNICREDIT_CALLBACK_TOKEN>
 *   {
 *     "order_id": "order_01...",         // = `external_id` trimis de noi la /offers
 *     "status": "Started"                // statusul curent al cererii
 *   }
 *
 * Formatul standard ePOS (https://epos.unicredit.ro/docs/guides/status-update/)
 * trimite id-ul nostru ca `order_id`, nu ca `external_id` — primele callback-uri
 * reale (sept. 2026) au picat cu 400 din cauza asta. Acceptăm ambele nume, ca
 * să nu depindem de o eventuală personalizare a corpului de la UCFin.
 * `application_id`, `amount` și `timestamp` nu sunt în formatul standard; îi
 * păstrăm dacă vin.
 *
 * ePOS trimite TOT ciclul de viață al cererii, nu doar stările finale — panoul
 * UCFin arată „Started" cât timp clientul n-a terminat creditarea. De aceea
 * acceptăm orice status: îl consemnăm în `order.metadata.unicredit` și
 * răspundem 200, ca UCFin să nu marcheze notificarea drept eșuată și să
 * renunțe la retry-uri (inclusiv la cel cu statusul final, care ne aduce
 * banii). Acționăm doar pe stările terminale:
 *
 *   - Disbursed                        → capturăm plata, se livrează
 *   - Rejected / Cancelled / Expired   → anulăm comanda
 *   - orice altceva                    → doar se consemnează
 *
 * Corpul brut se loghează la fiecare apel: lista completă de statusuri ePOS nu
 * e publică, așa că logurile sunt sursa noastră pentru ce trimite UCFin.
 */

/** Statusuri care închid dosarul cu bani încasați. */
const CAPTURE_STATUSES = new Set(['disbursed'])

/** Statusuri care închid dosarul fără finanțare. */
const CANCEL_STATUSES = new Set(['rejected', 'cancelled', 'canceled', 'expired'])

type CallbackBody = {
  order_id?: string
  external_id?: string
  status?: string
  application_id?: string
  amount?: number
  timestamp?: string
}

export const POST = async (
  req: MedusaRequest<CallbackBody>,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const expected = process.env.UNICREDIT_CALLBACK_TOKEN
  if (expected) {
    const got =
      (req.query.token as string) || req.headers['x-callback-token']
    if (got !== expected) {
      logger.warn('[unicredit] Callback cu token invalid — ignorat')
      return res.status(401).json({ received: false })
    }
  }

  const body = (req.body ?? {}) as CallbackBody

  // Corpul brut, ca să vedem exact ce câmpuri și ce statusuri trimite UCFin.
  logger.info(`[unicredit] Callback brut: ${JSON.stringify(body)}`)

  const orderId = (body.order_id ?? body.external_id)?.trim()
  const status = (body.status ?? '').trim().toLowerCase()

  if (!orderId) {
    return res
      .status(400)
      .json({ received: false, error: 'order_id lipsește' })
  }
  if (!status) {
    return res.status(400).json({ received: false, error: 'status lipsește' })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      'status',
      'metadata',
      'payment_collections.payments.id',
      'payment_collections.payments.provider_id',
      'payment_collections.payments.captured_at',
      'payment_collections.payment_sessions.provider_id',
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) {
    logger.warn(`[unicredit] Callback pentru comandă inexistentă: ${orderId}`)
    return res.status(404).json({ received: false, error: 'order not found' })
  }

  const isUnicredit = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .some((ps: any) => ps?.provider_id?.includes('unicredit'))
  if (!isUnicredit) {
    return res
      .status(400)
      .json({ received: false, error: 'order is not financed via UniCredit' })
  }

  // Idempotență: același status primit de două ori nu re-execută nimic.
  const meta = (order.metadata ?? {}) as Record<string, any>
  if (meta.unicredit?.status === status) {
    return res.json({ received: true, duplicate: true })
  }

  const isFinal = CAPTURE_STATUSES.has(status) || CANCEL_STATUSES.has(status)

  if (CAPTURE_STATUSES.has(status)) {
    // Doar plata UniCredit — o comandă poate avea și alte plăți pe ea.
    const payment = (order.payment_collections ?? [])
      .flatMap((pc: any) => pc?.payments ?? [])
      .find((p: any) => p?.id && p?.provider_id?.includes('unicredit'))
    if (payment && !payment.captured_at) {
      await capturePaymentWorkflow(req.scope).run({
        input: { payment_id: payment.id },
      })
    }
  } else if (CANCEL_STATUSES.has(status)) {
    // Nu se livrează. Dacă anularea nu mai e posibilă (ex. comanda deja
    // procesată manual), doar consemnăm statusul.
    try {
      await cancelOrderWorkflow(req.scope).run({
        input: { order_id: order.id },
      })
    } catch (e: any) {
      logger.warn(
        `[unicredit] Comanda ${order.id} nu a putut fi anulată automat: ${e?.message}`
      )
    }
  } else {
    logger.info(
      `[unicredit] Status intermediar „${body.status}" pentru ${order.id} — doar consemnat`
    )
  }

  const orderModule = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders(order.id, {
    metadata: {
      ...meta,
      unicredit: {
        ...(meta.unicredit ?? {}),
        status,
        // Statusul exact, cu majusculele UCFin, pentru suport.
        status_raw: body.status,
        application_id: body.application_id ?? meta.unicredit?.application_id,
        amount: body.amount ?? meta.unicredit?.amount,
        status_received_at: new Date().toISOString(),
      },
    },
  })

  res.json({ received: true, final: isFinal })
}
