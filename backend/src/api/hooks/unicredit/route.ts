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
 * Callback-ul de statusuri de la UniCredit ePOS (structura propusă de noi,
 * comunicată UCFin — vezi docs/unicredit/callback.md):
 *
 *   POST /hooks/unicredit?token=<UNICREDIT_CALLBACK_TOKEN>
 *   {
 *     "external_id": "order_01...",      // id-ul trimis de noi la /offers
 *     "status": "Disbursed",             // Disbursed | Rejected | Cancelled
 *     "application_id": "...",           // opțional, referința UCFin
 *     "amount": 4999.99,                 // opțional, suma finanțată
 *     "timestamp": "2026-07-23T10:00:00Z"
 *   }
 *
 *   - Disbursed  → coșul a fost finanțat → capturăm plata, se livrează
 *   - Rejected   → credit respins → anulăm comanda
 *   - Cancelled  → cerere anulată → anulăm comanda
 *
 * Răspuns: 200 {"received": true}. Orice alt cod → UCFin poate retrimite.
 */

type CallbackBody = {
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
  const orderId = body.external_id
  const status = (body.status ?? '').toLowerCase()

  logger.info(
    `[unicredit] Callback: order=${orderId} status=${body.status} application=${body.application_id ?? '-'}`
  )

  if (!orderId || !['disbursed', 'rejected', 'cancelled'].includes(status)) {
    return res
      .status(400)
      .json({ received: false, error: 'external_id sau status invalid' })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      'status',
      'metadata',
      'payment_collections.payments.id',
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

  if (status === 'disbursed') {
    const payment = (order.payment_collections ?? [])
      .flatMap((pc: any) => pc?.payments ?? [])
      .find((p: any) => p?.id)
    if (payment && !payment.captured_at) {
      await capturePaymentWorkflow(req.scope).run({
        input: { payment_id: payment.id },
      })
    }
  } else {
    // Rejected / Cancelled → nu se livrează. Dacă anularea nu mai e posibilă
    // (ex. comanda deja procesată manual), doar consemnăm statusul.
    try {
      await cancelOrderWorkflow(req.scope).run({
        input: { order_id: order.id },
      })
    } catch (e: any) {
      logger.warn(
        `[unicredit] Comanda ${order.id} nu a putut fi anulată automat: ${e?.message}`
      )
    }
  }

  const orderModule = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders(order.id, {
    metadata: {
      ...meta,
      unicredit: {
        ...(meta.unicredit ?? {}),
        status,
        application_id: body.application_id ?? meta.unicredit?.application_id,
        amount: body.amount ?? meta.unicredit?.amount,
        status_received_at: new Date().toISOString(),
      },
    },
  })

  res.json({ received: true })
}
