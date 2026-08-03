import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils'
import { getNetopiaClient } from '../../../../modules/netopia/client'
import {
  countryNumeric,
  getNetopiaV2Client,
  isNetopiaV2Enabled,
  type NetopiaV2Address,
} from '../../../../modules/netopia/client-v2'

type SessionBody = {
  order_id: string
}

/**
 * Pregătește plata Netopia pentru o comandă plasată cu „Card prin Netopia".
 *
 * Cu API-ul v2 (NETOPIA_API_KEY setat) întoarce `{redirect_url}` — pagina lor
 * nouă de plată, cu Apple Pay / Google Pay / Click to Pay. Fără cheie, cade
 * pe v1 și întoarce `{payment_url, env_key, data}` pentru form POST-ul clasic.
 * Confirmarea vine în ambele cazuri prin IPN pe /hooks/netopia.
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
      'items.quantity',
      'items.unit_price',
      'items.variant_sku',
      'shipping_address.first_name',
      'shipping_address.last_name',
      'shipping_address.phone',
      'shipping_address.address_1',
      'shipping_address.city',
      'shipping_address.province',
      'shipping_address.postal_code',
      'shipping_address.country_code',
      'billing_address.first_name',
      'billing_address.last_name',
      'billing_address.phone',
      'billing_address.address_1',
      'billing_address.city',
      'billing_address.province',
      'billing_address.postal_code',
      'billing_address.country_code',
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

  const confirmUrl = `${backendUrl}/hooks/netopia`
  const returnUrl = `${storefrontUrl}/${countryCode}/order/${order.id}/confirmed`
  const details = `Plată comanda #${order.display_id} onlybestdevice.ro`
  const amount = Number(order.total ?? 0)
  const currency = (order.currency_code ?? 'ron').toUpperCase()

  const orderModule = req.scope.resolve(Modules.ORDER)
  const markPending = () =>
    orderModule.updateOrders(order.id, {
      metadata: {
        ...((order.metadata ?? {}) as Record<string, unknown>),
        netopia: {
          status: 'pending',
          requested_at: new Date().toISOString(),
        },
      },
    })

  if (isNetopiaV2Enabled()) {
    const ship: any = order.shipping_address ?? {}
    const bill: any = order.billing_address ?? ship

    // Netopia cere toate câmpurile de adresă; ce nu avem trimitem gol, nu
    // undefined — validatorul lor respinge cererea altfel.
    const address = (a: any): NetopiaV2Address => ({
      email: order.email ?? '',
      phone: a?.phone ?? ship?.phone ?? '',
      firstName: a?.first_name ?? '',
      lastName: a?.last_name ?? '',
      city: a?.city ?? '',
      country: countryNumeric(a?.country_code),
      countryName: (a?.country_code ?? 'ro').toUpperCase(),
      state: a?.province ?? a?.city ?? '',
      postalCode: a?.postal_code ?? '',
      details: a?.address_1 ?? '',
    })

    const products = (order.items ?? [])
      .filter((i: any) => Number(i?.unit_price ?? 0) > 0)
      .map((i: any) => ({
        name: String(
          Number(i.quantity) > 1 ? `${i.title} x${i.quantity}` : i.title
        ).slice(0, 100),
        code: String(i.variant_sku || i.title || 'produs').slice(0, 50),
        category: 'general',
        price: Number(i.unit_price),
        vat: 19,
      }))

    const result = await getNetopiaV2Client().startCardPayment({
      orderId: order.id,
      amount,
      currency,
      description: details,
      notifyUrl: confirmUrl,
      redirectUrl: returnUrl,
      cancelUrl: `${storefrontUrl}/${countryCode}/checkout`,
      billing: address(bill),
      shipping: address(ship),
      products,
    })

    await markPending()

    return res.json({ redirect_url: result.paymentUrl })
  }

  const client = getNetopiaClient()
  const { envKey, data } = client.encrypt({
    orderId: order.id,
    amount: amount.toFixed(2),
    currency,
    details,
    confirmUrl,
    returnUrl,
    billing: {
      firstName: order.shipping_address?.first_name ?? '',
      lastName: order.shipping_address?.last_name ?? '',
      email: order.email ?? '',
      phone: order.shipping_address?.phone ?? '',
      address: [order.shipping_address?.address_1, order.shipping_address?.city]
        .filter(Boolean)
        .join(', '),
    },
  })

  await markPending()

  res.json({
    payment_url: client.paymentUrl(),
    env_key: envKey,
    data,
  })
}
