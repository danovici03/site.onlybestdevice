import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import {
  cancelOrderWorkflow,
  capturePaymentWorkflow,
} from '@medusajs/core-flows'
import {
  ContainerRegistrationKeys,
  Modules,
} from '@medusajs/framework/utils'
import {
  getNetopiaClient,
  ipnResponse,
  parseIpnXml,
} from '../../../modules/netopia/client'

/**
 * IPN-ul Netopia mobilPay: POST form-urlencoded cu env_key + data (criptate),
 * opțional cipher + iv la AES. Decriptăm cu cheia noastră privată și
 * procesăm statusul:
 *   - confirmed  + error 0 → banii încasați → capturăm plata
 *   - canceled             → anulăm comanda
 *   - confirmed_pending / paid_pending / paid → în așteptare, doar consemnăm
 *   - credit               → rambursare făcută din admin Netopia — consemnăm
 *
 * Răspundem mereu cu XML-ul <crc> pe care mobilPay îl așteaptă; orice alt
 * răspuns îi face să retrimită IPN-ul.
 */

const xml = (res: MedusaResponse, body: string, status = 200) =>
  res.status(status).type('application/xml').send(body)

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const body = (req.body ?? {}) as Record<string, string>
  const envKey = body.env_key
  const data = body.data
  if (!envKey || !data) {
    return xml(res, ipnResponse(false, 'env_key/data lipsesc'), 400)
  }

  let ipn
  try {
    const xmlStr = getNetopiaClient().decryptIpn(
      envKey,
      data,
      body.cipher,
      body.iv
    )
    ipn = parseIpnXml(xmlStr)
  } catch (e: any) {
    logger.error(`[netopia] IPN nedecriptabil: ${e?.message}`)
    return xml(res, ipnResponse(false, 'decriptare eșuată'), 400)
  }

  logger.info(
    `[netopia] IPN: order=${ipn.orderId} action=${ipn.action} error=${ipn.errorCode}`
  )

  if (!ipn.orderId || !ipn.action) {
    return xml(res, ipnResponse(false, 'XML incomplet'), 400)
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
    filters: { id: ipn.orderId },
  })

  const order = orders?.[0]
  if (!order) {
    logger.warn(`[netopia] IPN pentru comandă inexistentă: ${ipn.orderId}`)
    return xml(res, ipnResponse(false, 'comandă inexistentă'), 404)
  }

  const isNetopia = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .some((ps: any) => ps?.provider_id?.includes('netopia'))
  if (!isNetopia) {
    return xml(res, ipnResponse(false, 'comanda nu e Netopia'), 400)
  }

  const meta = (order.metadata ?? {}) as Record<string, any>
  const failed = ipn.errorCode != null && ipn.errorCode !== '0'
  const action = failed ? 'error' : ipn.action

  // Idempotență: repetarea aceluiași status final nu re-execută nimic.
  if (meta.netopia?.status === action && action !== 'paid_pending') {
    return xml(res, ipnResponse(true))
  }

  if (action === 'confirmed') {
    const payment = (order.payment_collections ?? [])
      .flatMap((pc: any) => pc?.payments ?? [])
      .find((p: any) => p?.id)
    if (payment && !payment.captured_at) {
      await capturePaymentWorkflow(req.scope).run({
        input: { payment_id: payment.id },
      })
    }
  } else if (action === 'canceled') {
    try {
      await cancelOrderWorkflow(req.scope).run({
        input: { order_id: order.id },
      })
    } catch (e: any) {
      logger.warn(
        `[netopia] Comanda ${order.id} nu a putut fi anulată automat: ${e?.message}`
      )
    }
  }
  // confirmed_pending / paid_pending / paid / credit / error → doar metadata

  const orderModule = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders(order.id, {
    metadata: {
      ...meta,
      netopia: {
        ...(meta.netopia ?? {}),
        status: action,
        error_code: ipn.errorCode,
        processed_amount: ipn.processedAmount ?? meta.netopia?.processed_amount,
        status_received_at: new Date().toISOString(),
      },
    },
  })

  return xml(res, ipnResponse(true))
}
