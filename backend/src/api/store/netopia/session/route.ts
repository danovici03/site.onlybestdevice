import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils'
import {
  createOrderPaymentCollectionWorkflow,
  createPaymentSessionsWorkflow,
} from '@medusajs/core-flows'
import { getNetopiaClient } from '../../../../modules/netopia/client'
import {
  PAID_STATUSES,
  canSendPaymentLink,
  isCodOrder,
  isFinancedOrder,
} from '../../../../lib/orders/order-status'
import {
  countryNumeric,
  getNetopiaV2Client,
  isNetopiaV2Enabled,
  type NetopiaV2Address,
} from '../../../../modules/netopia/client-v2'

/** Providerul de card. Id-ul e `pp_<modul>_<serviciu>`. */
const NETOPIA_PROVIDER_ID =
  process.env.NETOPIA_PAYMENT_PROVIDER_ID || 'pp_netopia_netopia'

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
      'status',
      'canceled_at',
      'payment_status',
      'fulfillment_status',
      'customer_id',
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
      'payment_collections.id',
      'payment_collections.status',
      'payment_collections.payments.provider_id',
      'payment_collections.payment_sessions.provider_id',
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Comanda nu există')
  }

  /**
   * Ruta e publica si se cheama la fiecare deschidere a paginii
   * `/order/:id/pay`, inclusiv din linkul trimis pe email. Deci e singurul loc
   * care poate trimite un client spre pagina bancii — si singurul care poate
   * produce o plata dubla daca nu verifica destul.
   *
   * `metadata.netopia.status === 'confirmed'` NU e suficient: IPN-ul e
   * asincron, iar clientul se poate intoarce cu butonul „inapoi" din pagina de
   * confirmare inainte sa fi ajuns. Pana atunci metadata inca zice „pending",
   * dar banii sunt luati — de aceea ne uitam si la `payment_status`, care e
   * calculat din platile reale, si la anulare.
   */
  const netopiaMeta = ((order.metadata ?? {}) as Record<string, any>).netopia ?? {}
  const alreadyPaid =
    netopiaMeta.status === 'confirmed' ||
    PAID_STATUSES.has(((order as any).payment_status ?? '') as string)

  if (alreadyPaid) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Comanda este deja platita'
    )
  }
  if (order.status === 'canceled' || (order as any).canceled_at) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Comanda este anulata'
    )
  }

  /**
   * Comanda poate fi pe alta metoda de plata: client care a ales viramentul si
   * s-a razgandit, sau operator care i-a trimis link de plata din admin.
   * Conversia se face AICI, nu la trimiterea linkului, tocmai ca sa se intample
   * doar daca clientul chiar apasa butonul — altfel o comanda pe ordin de plata
   * ar inceta sa mai fie „in asteptarea viramentului" din secunda in care
   * operatorul a trimis emailul.
   *
   * `canSendPaymentLink` refuza rambursul (curierul incaseaza, s-ar plati de
   * doua ori) si ratele (dosarul se inchide la partener).
   */
  const isNetopia = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .some((ps: any) => ps?.provider_id?.includes('netopia'))

  if (!isNetopia) {
    if (!canSendPaymentLink(order)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        isCodOrder(order)
          ? 'Comanda se plateste la livrare, catre curier'
          : isFinancedOrder(order)
            ? 'Comanda este in rate, prin partenerul de finantare'
            : 'Comanda nu are plata cu cardul prin Netopia'
      )
    }
    await switchToCardPayment(req, order)
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
  /**
   * Fiecare apel e o incercare NOUA de plata, deci `error_code` de la
   * incercarea precedenta se sterge — altfel cardul din admin ar arata comanda
   * ca esuata desi clientul e chiar acum pe pagina bancii.
   *
   * `attempts` numara incercarile: emailul de plata esuata se trimite o data
   * per incercare, nu o singura data pe viata comenzii.
   *
   * `payment_url` se salveaza doar informativ (v2). NU mai e sursa pentru
   * „reia plata": linkul Netopia e de unica folosinta, iar pe v1 nici nu e un
   * URL vizitabil — cere form POST cu env_key + data. Pagina de handoff cere
   * de fiecare data o sesiune proaspata prin ruta asta.
   */
  const markPending = async (paymentUrl?: string) => {
    /**
     * Recitim metadata imediat inainte de scriere. Intre verificarea de la
     * intrarea in ruta si momentul asta a trecut un apel de retea catre
     * Netopia; daca IPN-ul a confirmat plata in fereastra aia, un update
     * construit pe metadata veche ar suprascrie `confirmed` cu `pending` si ar
     * „invia" o comanda deja incasata — inclusiv stergand flagurile de email
     * scrise intre timp.
     */
    const { data: fresh } = await query.graph({
      entity: 'order',
      fields: ['id', 'metadata'],
      filters: { id: order.id },
    })
    const freshMeta = (fresh?.[0]?.metadata ?? {}) as Record<string, any>
    const freshNetopia = freshMeta.netopia ?? {}

    if (freshNetopia.status === 'confirmed') {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Comanda a fost platita intre timp'
      )
    }

    await orderModule.updateOrders(order.id, {
      metadata: {
        ...freshMeta,
        netopia: {
          ...freshNetopia,
          status: 'pending',
          error_code: null,
          attempts: Number(freshNetopia.attempts ?? 0) + 1,
          requested_at: new Date().toISOString(),
          ...(paymentUrl ? { payment_url: paymentUrl } : {}),
        },
      },
    })
  }

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

    await markPending(result.paymentUrl)

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

/**
 * Muta comanda pe plata cu cardul.
 *
 * `createPaymentSessionsWorkflow` STERGE sesiunile existente ale colectiei si o
 * creeaza pe cea noua — exact semantica de „schimba metoda de plata". Lucram pe
 * colectia existenta in loc sa cream una a doua: doua colectii pentru aceeasi
 * suma ar strica `payment_status`-ul calculat al comenzii.
 *
 * Colectiile deja incheiate sau anulate sunt sarite: o plata inregistrata acolo
 * nu trebuie atinsa.
 */
const switchToCardPayment = async (req: MedusaRequest, order: any) => {
  const reusable = (order.payment_collections ?? []).filter(
    (pc: any) => pc?.status !== 'canceled' && pc?.status !== 'completed'
  )

  let collectionId: string | undefined = reusable[0]?.id

  if (!collectionId) {
    const { result } = await createOrderPaymentCollectionWorkflow(
      req.scope
    ).run({
      input: { order_id: order.id, amount: Number(order.total ?? 0) },
    })
    collectionId = (result as any)?.[0]?.id
  }

  if (!collectionId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Comanda nu are o colectie de plata utilizabila'
    )
  }

  await createPaymentSessionsWorkflow(req.scope).run({
    input: {
      payment_collection_id: collectionId,
      provider_id: NETOPIA_PROVIDER_ID,
      customer_id: order.customer_id ?? undefined,
    },
  })
}
