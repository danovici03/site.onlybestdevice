import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils'
import { getNetopiaClient } from '../../../../modules/netopia/client'

type SessionBody = {
  order_id: string
}

/**
 * Pregătește plata mobilPay pentru o comandă plasată cu „Card prin Netopia":
 * întoarce {payment_url, env_key, data}, iar storefront-ul trimite un form
 * POST cu ele — clientul ajunge pe pagina Netopia să introducă cardul.
 * Confirmarea vine prin IPN pe /hooks/netopia.
 */
export const POST = async (
  req: MedusaRequest<SessionBody>,
  res: MedusaResponse
) => {
  const orderId = (req.body as SessionBody)?.order_id
  if (!orderId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'order_id lipsește')
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      'display_id',
      'email',
      'currency_code',
      'total',
      'metadata',
      'shipping_address.first_name',
      'shipping_address.last_name',
      'shipping_address.phone',
      'shipping_address.address_1',
      'shipping_address.city',
      'shipping_address.country_code',
      'payment_collections.payment_sessions.provider_id',
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Comanda nu există')
  }

  const isNetopia = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .some((ps: any) => ps?.provider_id?.includes('netopia'))
  if (!isNetopia) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Comanda nu are plata cu cardul prin Netopia'
    )
  }

  const storefrontUrl = (
    process.env.STOREFRONT_URL || 'http://localhost:8000'
  ).replace(/\/$/, '')
  const backendUrl = (
    process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000'
  ).replace(/\/$/, '')
  const countryCode =
    order.shipping_address?.country_code?.toLowerCase() || 'ro'

  const client = getNetopiaClient()
  const { envKey, data } = client.encrypt({
    orderId: order.id,
    amount: Number(order.total ?? 0).toFixed(2),
    currency: (order.currency_code ?? 'ron').toUpperCase(),
    details: `Plată comanda #${order.display_id} onlybestdevice.ro`,
    confirmUrl: `${backendUrl}/hooks/netopia`,
    returnUrl: `${storefrontUrl}/${countryCode}/order/${order.id}/confirmed`,
    billing: {
      firstName: order.shipping_address?.first_name ?? '',
      lastName: order.shipping_address?.last_name ?? '',
      email: order.email ?? '',
      phone: order.shipping_address?.phone ?? '',
      address: [
        order.shipping_address?.address_1,
        order.shipping_address?.city,
      ]
        .filter(Boolean)
        .join(', '),
    },
  })

  const orderModule = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders(order.id, {
    metadata: {
      ...((order.metadata ?? {}) as Record<string, unknown>),
      netopia: {
        status: 'pending',
        requested_at: new Date().toISOString(),
      },
    },
  })

  res.json({
    payment_url: client.paymentUrl(),
    env_key: envKey,
    data,
  })
}
