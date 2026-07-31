import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Construieste payload-ul normalizat al unei comenzi pentru ERP-ul din Laravel.
 *
 * Medusa descrie starea unei comenzi pe trei axe (order.status, payment_status,
 * fulfillment_status), pe cand ERP-ul lucreaza cu un singur status canonic —
 * acelasi vocabular ca la WooCommerce (pending / processing / completed /
 * cancelled / refunded / failed). Reducerea se face AICI, o singura data, ca
 * regula de business sa nu fie duplicata in doua limbaje.
 */

export type ErpOrderPayload = {
  id: string
  display_id: number | null
  status: ErpCanonicalStatus
  raw_status: {
    order: string | null
    payment: string | null
    fulfillment: string | null
  }
  date_created: string | null
  date_paid: string | null
  payment_method: string | null
  payment_method_title: string | null
  customer_id: string | null
  email: string | null
  currency_code: string | null
  billing: Record<string, unknown>
  shipping: Record<string, unknown>
  line_items: ErpLineItem[]
  totals: {
    subtotal: number
    tax_total: number
    discount_total: number
    shipping_total: number
    total: number
  }
}

export type ErpLineItem = {
  id: string
  variant_id: string | null
  product_id: string | null
  sku: string | null
  name: string
  quantity: number
  unit_price: number
  tax_total: number
  total: number
}

export type ErpCanonicalStatus =
  | "pending"
  | "processing"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed"

const ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "payment_status",
  "fulfillment_status",
  "email",
  "currency_code",
  "created_at",
  "canceled_at",
  "customer_id",
  "subtotal",
  "tax_total",
  "discount_total",
  "shipping_total",
  "total",
  "items.id",
  "items.variant_id",
  "items.product_id",
  "items.variant_sku",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.quantity",
  "items.unit_price",
  "items.tax_total",
  "items.total",
  "billing_address.*",
  "shipping_address.*",
  "payment_collections.payments.id",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
  "payment_collections.payment_sessions.provider_id",
]

/**
 * Statusurile de livrare in care marfa a plecat efectiv din magazin. In Medusa
 * `order.status` ramane "pending" pe tot parcursul (se schimba doar la anulare
 * sau la inchiderea manuala), deci nu poate fi singurul semnal de "s-a finalizat":
 * daca l-am astepta, IMEI-ul rezervat n-ar trece niciodata pe "vandut".
 *
 * Starile partiale sunt excluse intentionat: gestiunea nu are notiunea de comanda
 * pe jumatate livrata, iar "completed" pe o comanda expediata partial ar marca
 * vandute TOATE IMEI-urile ei, inclusiv cele inca in raft.
 */
const SHIPPED_STATUSES = new Set(["fulfilled", "shipped", "delivered"])

/**
 * Reduce cele trei axe de status Medusa la statusul canonic al ERP-ului.
 * Ordinea conteaza: starile terminale (anulat, returnat) au prioritate.
 */
export const toCanonicalStatus = (order: any): ErpCanonicalStatus => {
  const orderStatus = (order?.status ?? "") as string
  const paymentStatus = (order?.payment_status ?? "") as string
  const fulfillmentStatus = (order?.fulfillment_status ?? "") as string

  if (orderStatus === "canceled" || order?.canceled_at) {
    return "cancelled"
  }
  if (paymentStatus === "canceled") {
    return "cancelled"
  }
  // Doar refund-ul integral scoate vanzarea din venituri. Un refund partial
  // (retur pe o singura linie) lasa comanda activa — altfel ERP-ul ar elibera
  // tot stocul comenzii pentru un retur de o bucata.
  if (paymentStatus === "refunded") {
    return "refunded"
  }
  if (paymentStatus === "requires_action") {
    return "failed"
  }

  if (orderStatus === "completed") {
    return "completed"
  }
  // Marfa a plecat → comanda e finalizata pentru gestiune: rezervarile devin
  // vanzari si se genereaza garantiile.
  if (SHIPPED_STATUSES.has(fulfillmentStatus)) {
    return "completed"
  }

  // ATENTIE: incasarea NU inseamna finalizare. La plata cu cardul banii intra in
  // secunda in care clientul apasa "Plateste", cu telefonul inca in raft — daca am
  // returna "completed" aici, IMEI-ul ar fi marcat vandut si garantia ar porni
  // inainte de livrare. Faptul ca s-a incasat calatoreste separat, prin `date_paid`,
  // exact ca la WooCommerce (unde plata cu cardul lasa comanda in "processing").
  if (
    paymentStatus === "captured" ||
    paymentStatus === "partially_captured" ||
    paymentStatus === "authorized" ||
    paymentStatus === "partially_authorized" ||
    paymentStatus === "partially_refunded"
  ) {
    return "processing"
  }

  return "pending"
}

/**
 * Momentul incasarii: cel mai vechi `captured_at` dintre platile necaancelate.
 * Null cat timp comanda nu e incasata (ex. ramburs pana la livrare).
 */
const resolveDatePaid = (order: any): string | null => {
  const captured = (order?.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payments ?? [])
    .filter((p: any) => p?.captured_at && !p?.canceled_at)
    .map((p: any) => new Date(p.captured_at).toISOString())
    .sort()

  return captured[0] ?? null
}

/**
 * Providerul de plata (`pp_cod_cod`, `pp_netopia_netopia`, ...). Luam intai de pe
 * plata efectiva; daca nu exista inca o plata, de pe sesiunea selectata.
 */
const resolvePaymentProvider = (order: any): string | null => {
  const fromPayment = (order?.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payments ?? [])
    .find((p: any) => p?.provider_id)?.provider_id

  if (fromPayment) return fromPayment

  const fromSession = (order?.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .find((s: any) => s?.provider_id)?.provider_id

  return fromSession ?? null
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

const addressToObject = (addr: any): Record<string, unknown> => {
  if (!addr) return {}
  const { id, created_at, updated_at, deleted_at, customer_id, ...rest } = addr
  return rest
}

export const buildLineItems = (order: any): ErpLineItem[] =>
  (order?.items ?? []).map((item: any) => ({
    id: item.id,
    variant_id: item.variant_id ?? null,
    product_id: item.product_id ?? null,
    sku: item.variant_sku ?? null,
    // Titlul complet, ca in emailuri: "iPhone 15 / 128GB Negru".
    name:
      item.variant_title && item.variant_title !== item.product_title
        ? `${item.product_title ?? item.title} / ${item.variant_title}`
        : (item.product_title ?? item.title ?? ""),
    quantity: num(item.quantity),
    unit_price: num(item.unit_price),
    tax_total: num(item.tax_total),
    total: num(item.total),
  }))

export const toErpPayload = (order: any): ErpOrderPayload => ({
  id: order.id,
  display_id: order.display_id ?? null,
  status: toCanonicalStatus(order),
  raw_status: {
    order: order.status ?? null,
    payment: order.payment_status ?? null,
    fulfillment: order.fulfillment_status ?? null,
  },
  date_created: order.created_at ? new Date(order.created_at).toISOString() : null,
  date_paid: resolveDatePaid(order),
  payment_method: resolvePaymentProvider(order),
  payment_method_title: resolvePaymentProvider(order),
  customer_id: order.customer_id ?? null,
  email: order.email ?? null,
  currency_code: order.currency_code ?? null,
  billing: addressToObject(order.billing_address),
  shipping: addressToObject(order.shipping_address),
  line_items: buildLineItems(order),
  totals: {
    subtotal: num(order.subtotal),
    tax_total: num(order.tax_total),
    discount_total: num(order.discount_total),
    shipping_total: num(order.shipping_total),
    total: num(order.total),
  },
})

/**
 * Ia comanda din baza si o normalizeaza. Returneaza null daca nu exista.
 */
export const fetchErpOrderPayload = async (
  container: any,
  orderId: string,
): Promise<ErpOrderPayload | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) return null

  return toErpPayload(order)
}

/**
 * Id-ul comenzii legate de o plata. Evenimentele `payment.*` trimit doar id-ul
 * platii, iar legatura order ↔ payment_collection e un link module, nu o relatie
 * interna — de aceea trecem prin tabela de link (la fel ca `capturePaymentWorkflow`).
 */
export const orderIdForPayment = async (
  container: any,
  paymentId: string,
): Promise<string | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["id", "payment_collection_id"],
    filters: { id: paymentId },
  })

  const collectionId = payments?.[0]?.payment_collection_id
  if (!collectionId) return null

  const { data: links } = await query.graph({
    entity: "order_payment_collection",
    // `order.id` e traversarea prin link (ca in capturePaymentWorkflow), `order_id`
    // e cheia bruta din tabela de link — cerem ambele, ca rezolvarea sa nu depinda
    // de care dintre ele e expusa de versiunea curenta a modulului.
    fields: ["order_id", "order.id"],
    filters: { payment_collection_id: collectionId },
  })

  const linkRow: any = links?.[0]

  return linkRow?.order_id ?? linkRow?.order?.id ?? null
}
