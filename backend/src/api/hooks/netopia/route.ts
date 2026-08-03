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
import {
  getNetopiaV2Client,
  isNetopiaV2Enabled,
  statusToAction,
} from '../../../modules/netopia/client-v2'
import {
  ORDER_EMAIL_FIELDS,
  sendPaymentFailedEmail,
} from '../../../lib/orders/order-emails'

/**
 * IPN-ul Netopia, în ambele dialecte:
 *
 *  v2 — POST JSON + header `Verification-token` (JWT semnat de ei). Verificăm
 *       semnătura și hash-ul body-ului RAW, apoi luăm `payment.status`.
 *  v1 — POST form-urlencoded cu env_key + data criptate. Rămâne activ pentru
 *       comenzile începute înainte de migrare, care încă trimit IPN-uri vechi.
 *
 * Acțiuni (aceleași în ambele cazuri, ca metadata comenzilor să fie unitară):
 *   - confirmed → banii încasați → capturăm plata
 *   - canceled  → anulăm comanda
 *   - restul (paid_pending, error, fraud, credit) → doar consemnăm
 *
 * Răspunsul diferă: v1 vrea XML `<crc>`, v2 vrea JSON `{errorType, errorCode,
 * errorMessage}`. Orice altceva îi face să retrimită IPN-ul.
 */

const xml = (res: MedusaResponse, body: string, status = 200) =>
  res.status(status).type('application/xml').send(body)

const ERROR_TYPE_NONE = 0
const ERROR_TYPE_PERMANENT = 2

type IpnFacts = {
  orderId: string
  action: string
  errorCode: string | null
  processedAmount: string | null
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const verificationToken = req.headers['verification-token'] as
    | string
    | undefined

  /* ---------------------------------------------------------------- */
  /* v2 — JSON semnat                                                  */
  /* ---------------------------------------------------------------- */
  if (verificationToken) {
    if (!isNetopiaV2Enabled()) {
      logger.error('[netopia] IPN v2 primit, dar NETOPIA_API_KEY nu e setat')
      return res.status(400).json({
        errorType: ERROR_TYPE_PERMANENT,
        errorCode: 1,
        errorMessage: 'API v2 neconfigurat',
      })
    }

    const rawBody: Buffer | undefined = (req as any).rawBody
    if (!rawBody) {
      // Fără body-ul brut nu putem verifica hash-ul din JWT — vezi
      // preserveRawBody în src/api/middlewares.ts.
      logger.error('[netopia] IPN v2 fără rawBody — bodyParser neconfigurat')
      return res.status(500).json({
        errorType: ERROR_TYPE_PERMANENT,
        errorCode: 1,
        errorMessage: 'rawBody indisponibil',
      })
    }

    let ipn
    try {
      ipn = getNetopiaV2Client().verifyIpn(verificationToken, rawBody)
    } catch (e: any) {
      logger.error(`[netopia] IPN v2 neverificabil: ${e?.message}`)
      return res.status(400).json({
        errorType: ERROR_TYPE_PERMANENT,
        errorCode: 1,
        errorMessage: 'verificare eșuată',
      })
    }

    const orderId = ipn.order?.orderID
    const status = Number(ipn.payment?.status ?? 0)
    if (!orderId || !status) {
      return res.status(400).json({
        errorType: ERROR_TYPE_PERMANENT,
        errorCode: 1,
        errorMessage: 'payload incomplet',
      })
    }

    logger.info(
      `[netopia] IPN v2: order=${orderId} status=${status} ntpID=${ipn.payment?.ntpID}`
    )

    const outcome = await applyIpn(req, logger, {
      orderId,
      action: statusToAction(status),
      errorCode: ipn.payment?.code ?? null,
      processedAmount:
        ipn.payment?.amount != null ? String(ipn.payment.amount) : null,
    })

    if (!outcome.ok) {
      return res.status(outcome.status).json({
        errorType: ERROR_TYPE_PERMANENT,
        errorCode: 1,
        errorMessage: outcome.message,
      })
    }

    return res.json({
      errorType: ERROR_TYPE_NONE,
      errorCode: 0,
      errorMessage: '',
    })
  }

  /* ---------------------------------------------------------------- */
  /* v1 — env_key + data criptate                                      */
  /* ---------------------------------------------------------------- */
  const body = (req.body ?? {}) as Record<string, string>
  const envKey = body.env_key
  const data = body.data
  if (!envKey || !data) {
    return xml(res, ipnResponse(false, 'env_key/data lipsesc'), 400)
  }

  let parsed
  try {
    const xmlStr = getNetopiaClient().decryptIpn(
      envKey,
      data,
      body.cipher,
      body.iv
    )
    parsed = parseIpnXml(xmlStr)
  } catch (e: any) {
    logger.error(`[netopia] IPN nedecriptabil: ${e?.message}`)
    return xml(res, ipnResponse(false, 'decriptare eșuată'), 400)
  }

  logger.info(
    `[netopia] IPN: order=${parsed.orderId} action=${parsed.action} error=${parsed.errorCode}`
  )

  if (!parsed.orderId || !parsed.action) {
    return xml(res, ipnResponse(false, 'XML incomplet'), 400)
  }

  const failed = parsed.errorCode != null && parsed.errorCode !== '0'
  const outcome = await applyIpn(req, logger, {
    orderId: parsed.orderId,
    action: failed ? 'error' : parsed.action,
    errorCode: parsed.errorCode,
    processedAmount: parsed.processedAmount,
  })

  if (!outcome.ok) {
    return xml(res, ipnResponse(false, outcome.message), outcome.status)
  }
  return xml(res, ipnResponse(true))
}

/**
 * Partea comună: găsește comanda, aplică acțiunea și scrie metadata. Nu
 * răspunde clientului — formatul răspunsului diferă între v1 și v2.
 */
async function applyIpn(
  req: MedusaRequest,
  logger: any,
  facts: IpnFacts
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
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
    filters: { id: facts.orderId },
  })

  const order = orders?.[0]
  if (!order) {
    logger.warn(`[netopia] IPN pentru comandă inexistentă: ${facts.orderId}`)
    return { ok: false, status: 404, message: 'comandă inexistentă' }
  }

  const isNetopia = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .some((ps: any) => ps?.provider_id?.includes('netopia'))
  if (!isNetopia) {
    return { ok: false, status: 400, message: 'comanda nu e Netopia' }
  }

  const meta = (order.metadata ?? {}) as Record<string, any>
  const action = facts.action

  // Idempotență: repetarea aceluiași status final nu re-execută nimic.
  if (meta.netopia?.status === action && action !== 'paid_pending') {
    return { ok: true }
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
  // paid_pending / credit / fraud / error → doar metadata și, la error, email

  const orderModule = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders(order.id, {
    metadata: {
      ...meta,
      netopia: {
        ...(meta.netopia ?? {}),
        status: action,
        error_code: facts.errorCode,
        processed_amount:
          facts.processedAmount ?? meta.netopia?.processed_amount,
        status_received_at: new Date().toISOString(),
      },
    },
  })

  /**
   * Emailul de plată eșuată se trimite DUPĂ scrierea metadatei: el își pune
   * propriul flag în `metadata.emails`, iar update-ul de mai sus lucrează cu
   * metadata citită la începutul funcției și l-ar suprascrie.
   * Comanda rămâne în picioare — clientul reia plata din linkul primit.
   */
  if (action === 'error') {
    const { data: full } = await query.graph({
      entity: 'order',
      fields: ORDER_EMAIL_FIELDS,
      filters: { id: order.id },
    })
    if (full?.[0]) {
      try {
        await sendPaymentFailedEmail(req.scope, full[0], facts.errorCode)
      } catch (e: any) {
        logger.warn(
          `[netopia] Nu am putut trimite emailul de plată eșuată pentru ${order.id}: ${e?.message}`
        )
      }
    }
  }

  return { ok: true }
}
