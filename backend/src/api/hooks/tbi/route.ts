import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import {
  cancelOrderWorkflow,
  capturePaymentWorkflow,
} from '@medusajs/core-flows'
import {
  ContainerRegistrationKeys,
  Modules,
} from '@medusajs/framework/utils'
import { getTbiClient } from '../../../modules/tbi-pay/client'

/**
 * Callback-ul de statusuri TBI (ReturnToProvider). TBI trimite un POST cu
 * `order_data` = JSON criptat cu cheia publică a comerciantului:
 *
 *   { "order_id": "145003523", "status_id": "0|1|2", "motiv": "..." }
 *
 *   - 1 → aprobat  → capturăm plata, comanda se livrează
 *   - 0 → respins/anulat → anulăm comanda (motiv: „Respins Biroul de
 *         Credit" / „Criterii eligibilitate" / gol la anulare)
 *   - 2 → pending  → consemnăm statusul intermediar, nu facem nimic
 *
 * `order_id` e display_id-ul comenzii (trimis de noi la Finalize).
 */

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const expected = process.env.TBI_CALLBACK_TOKEN
  if (expected) {
    const got = (req.query.token as string) || req.headers['x-callback-token']
    if (got !== expected) {
      logger.warn('[tbi] Callback cu token invalid — ignorat')
      return res.status(401).json({ received: false })
    }
  }

  // order_data poate veni ca form-urlencoded sau JSON.
  const raw =
    (req.body as any)?.order_data ?? (req.body as any)?.orderData ?? null
  if (!raw || typeof raw !== 'string') {
    return res.status(400).json({ received: false, error: 'order_data lipsește' })
  }

  let payload: { order_id?: string; status_id?: string; motiv?: string }
  try {
    payload = JSON.parse(getTbiClient().decrypt(raw))
  } catch (e: any) {
    logger.error(`[tbi] Callback nedecriptabil: ${e?.message}`)
    return res.status(400).json({ received: false, error: 'decrypt failed' })
  }

  const displayId = Number(payload.order_id)
  const statusId = String(payload.status_id ?? '')
  logger.info(
    `[tbi] Callback: order=${displayId} status_id=${statusId} motiv=${payload.motiv ?? '-'}`
  )

  if (!displayId || !['0', '1', '2'].includes(statusId)) {
    return res
      .status(400)
      .json({ received: false, error: 'order_id sau status_id invalid' })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      'display_id',
      'status',
      'metadata',
      'payment_collections.payments.id',
      'payment_collections.payments.captured_at',
      'payment_collections.payment_sessions.provider_id',
    ],
    // Tipurile query.graph declară display_id ca string, dar valoarea reală
    // e numerică.
    filters: { display_id: displayId as unknown as string },
  })

  const order = orders?.[0]
  if (!order) {
    logger.warn(`[tbi] Callback pentru comandă inexistentă: #${displayId}`)
    return res.status(404).json({ received: false, error: 'order not found' })
  }

  const isTbi = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .some((ps: any) => ps?.provider_id?.includes('_tbi_'))
  if (!isTbi) {
    return res
      .status(400)
      .json({ received: false, error: 'order is not financed via TBI' })
  }

  const statusName =
    statusId === '1' ? 'approved' : statusId === '2' ? 'pending' : 'rejected'

  // Idempotență: același status final primit de două ori nu re-execută nimic.
  const meta = (order.metadata ?? {}) as Record<string, any>
  if (meta.tbi?.status === statusName && statusName !== 'pending') {
    return res.json({ received: true, duplicate: true })
  }

  if (statusName === 'approved') {
    const payment = (order.payment_collections ?? [])
      .flatMap((pc: any) => pc?.payments ?? [])
      .find((p: any) => p?.id)
    if (payment && !payment.captured_at) {
      await capturePaymentWorkflow(req.scope).run({
        input: { payment_id: payment.id },
      })
    }
  } else if (statusName === 'rejected') {
    try {
      await cancelOrderWorkflow(req.scope).run({
        input: { order_id: order.id },
      })
    } catch (e: any) {
      logger.warn(
        `[tbi] Comanda ${order.id} nu a putut fi anulată automat: ${e?.message}`
      )
    }
  }

  const orderModule = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders(order.id, {
    metadata: {
      ...meta,
      tbi: {
        ...(meta.tbi ?? {}),
        status: statusName,
        motiv: payload.motiv ?? meta.tbi?.motiv,
        status_received_at: new Date().toISOString(),
      },
    },
  })

  res.json({ received: true })
}
