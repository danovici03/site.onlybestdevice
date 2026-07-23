import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils'
import { getTbiClient } from '../../../../modules/tbi-pay/client'

type SessionBody = {
  order_id: string
}

/**
 * Creează cererea de credit TBI (Finalize) pentru o comandă plasată cu plata
 * „Rate prin TBI Bank" și întoarce `session_url` — URL-ul TBI unde
 * redirecționăm clientul. Statusul final vine criptat pe /hooks/tbi.
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
      'items.title',
      'items.product_title',
      'items.quantity',
      'items.unit_price',
      'items.variant_sku',
      'items.thumbnail',
      'shipping_address.first_name',
      'shipping_address.last_name',
      'shipping_address.phone',
      'shipping_address.address_1',
      'shipping_address.city',
      'shipping_address.province',
      'billing_address.address_1',
      'billing_address.city',
      'billing_address.province',
      'payment_collections.payment_sessions.provider_id',
      'payment_collections.payment_sessions.data',
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Comanda nu există')
  }

  const session = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .find((ps: any) => ps?.provider_id?.includes('_tbi_'))
  if (!session) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Comanda nu are plata în rate TBI'
    )
  }

  const backendUrl = (
    process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000'
  ).replace(/\/$/, '')
  const callbackToken = process.env.TBI_CALLBACK_TOKEN

  const instalments = String(Number(session.data?.credit_period) || 12)

  const client = getTbiClient()
  const sessionUrl = await client.finalize({
    // TBI cere order_id numeric unic — folosim display_id; mapăm înapoi în
    // callback prin metadata.
    order_id: String(order.display_id),
    back_ref: `${backendUrl}/hooks/tbi${callbackToken ? `?token=${callbackToken}` : ''}`,
    order_total: String(order.total ?? 0),
    customer: {
      fname: order.shipping_address?.first_name ?? '',
      lname: order.shipping_address?.last_name ?? '',
      cnp: '',
      email: order.email ?? '',
      phone: order.shipping_address?.phone ?? '',
      billing_address: order.billing_address?.address_1 ?? '',
      billing_city: order.billing_address?.city ?? '',
      billing_county: order.billing_address?.province ?? '',
      shipping_address: order.shipping_address?.address_1 ?? '',
      shipping_city: order.shipping_address?.city ?? '',
      shipping_county: order.shipping_address?.province ?? '',
      instalments,
      promo: 0,
    },
    items: (order.items ?? []).map((item: any) => ({
      name: item?.product_title || item?.title || 'Produs',
      qty: String(item?.quantity ?? 1),
      price: Number(item?.unit_price ?? 0),
      category: '2',
      sku: item?.variant_sku ?? '',
      ImageLink: item?.thumbnail ?? '',
    })),
  })

  const orderModule = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders(order.id, {
    metadata: {
      ...((order.metadata ?? {}) as Record<string, unknown>),
      tbi: {
        status: 'pending',
        instalments,
        requested_at: new Date().toISOString(),
      },
    },
  })

  res.json({ session_url: sessionUrl })
}
