import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils'
import { EposProduct, getEposClient } from '../../../../modules/unicredit-epos/client'

type SessionBody = {
  order_id: string
}

/**
 * Creează cererea de credit în UniCredit ePOS pentru o comandă plasată cu
 * metoda de plată „Rate prin UniCredit" și întoarce `session_url`, unde
 * storefront-ul redirecționează clientul ca să parcurgă creditarea la
 * distanță. Statusul final (Disbursed/Rejected/Cancelled) vine ulterior pe
 * /hooks/unicredit.
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
      'shipping_total',
      'metadata',
      'items.title',
      'items.product_title',
      'items.quantity',
      'items.unit_price',
      'shipping_address.first_name',
      'shipping_address.last_name',
      'shipping_address.phone',
      'shipping_address.country_code',
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
    .find((ps: any) => ps?.provider_id?.includes('unicredit'))
  if (!session) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Comanda nu are plata în rate UniCredit'
    )
  }

  // Perioada aleasă în checkout; fallback pe cel mai lung termen (rata minimă).
  const creditPeriod = Number(session.data?.credit_period) || undefined

  const products: EposProduct[] = (order.items ?? []).map((item: any) => ({
    name: item?.product_title || item?.title || 'Produs',
    price: Number(item?.unit_price ?? 0),
    quantity: Number(item?.quantity ?? 1),
  }))
  // Transportul intră în valoarea finanțată, ca totalul cerut la UCFin să fie
  // exact totalul comenzii.
  const shippingTotal = Number(order.shipping_total ?? 0)
  if (shippingTotal > 0) {
    products.push({ name: 'Transport', price: shippingTotal, quantity: 1 })
  }

  const storefrontUrl = (
    process.env.STOREFRONT_URL || 'http://localhost:8000'
  ).replace(/\/$/, '')
  const backendUrl = (
    process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000'
  ).replace(/\/$/, '')
  const countryCode =
    order.shipping_address?.country_code?.toLowerCase() || 'ro'
  const callbackToken = process.env.UNICREDIT_CALLBACK_TOKEN

  const client = getEposClient()
  const offers = await client.getOffers({
    products,
    gdpr: true, // bifat obligatoriu în checkout înainte de plasarea comenzii
    external_id: order.id,
    credit_period: creditPeriod,
    email_address: order.email ?? undefined,
    phone_number: order.shipping_address?.phone ?? undefined,
    first_name: order.shipping_address?.first_name ?? undefined,
    last_name: order.shipping_address?.last_name ?? undefined,
    redirect_url: `${storefrontUrl}/${countryCode}/order/${order.id}/confirmed`,
    callback_url: `${backendUrl}/hooks/unicredit${callbackToken ? `?token=${callbackToken}` : ''}`,
  })

  if (!offers?.offers?.length || !offers.sessionID) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      'ePOS nu a întors nicio ofertă de creditare pentru această comandă'
    )
  }

  // Oferta pe perioada aleasă de client; altfel prima ofertă întoarsă.
  const offer =
    offers.offers.find((o) => o.credit_period_months === creditPeriod) ??
    offers.offers[0]

  const { sessionUrl } = await client.selectOffer({
    sessionID: offers.sessionID,
    offer_id: offer.id,
    email_address: order.email!,
  })

  // Reținem sesiunea pe comandă pentru suport/debug și reconciliere callback.
  const orderModule = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders(order.id, {
    metadata: {
      ...((order.metadata ?? {}) as Record<string, unknown>),
      unicredit: {
        status: 'pending',
        session_id: offers.sessionID,
        offer_id: offer.id,
        offer_name: offer.name,
        credit_period: offer.credit_period_months,
        installment: offer.installment,
        dae: offer.dae,
        requested_at: new Date().toISOString(),
      },
    },
  })

  res.json({ session_url: sessionUrl })
}
