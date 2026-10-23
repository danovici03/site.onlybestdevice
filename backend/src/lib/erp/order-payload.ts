import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { WARRANTY_HANDLE } from "../warranty-prices"
import {
  SHIPPED_STATUSES,
  effectiveOrderStatus,
  isPaymentCommitted,
} from "../orders/order-status"

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
  status_label: string
  status_note: string | null
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
  /**
   * Linia e garanția extinsă (produsul de serviciu `garantie-extinsa`), nu
   * marfă: gestiunea n-are ce stoc să scadă pentru ea, ci prelungește garanția
   * unităților din linia acoperită.
   */
  is_extended_warranty: boolean
  /** Lunile adăugate peste garanția standard: 12 („+1 an") sau 24 („+2 ani"). */
  warranty_extra_months: number | null
  /**
   * Toate liniile acoperite, cu câte bucăți din fiecare. Un produs poate sta pe
   * mai multe linii (aceeași garanție pe negru și pe alb) — câmpurile singulare
   * de mai jos arată doar prima și rămân pentru compatibilitate.
   */
  warranty_covers: { line_id: string; variant_id: string | null; quantity: number }[]
  /** Prima linie acoperită. */
  warranty_for_line_id: string | null
  warranty_for_product_id: string | null
  warranty_for_variant_id: string | null
  warranty_for_title: string | null
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
  "metadata",
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
  // `items.*`, NU câmpuri explicite: în Medusa 2 cantitatea nu e coloană a
  // liniei de comandă, ci stă în `order_item`, iar `query.graph` o mapează pe
  // `item.quantity` doar la `items.*`. Cu `items.quantity` cerut explicit venea
  // `undefined` → 0, totalurile se calculau pe cantitate 0 (comanda de 4.336
  // lei pleca cu total 38 = doar transportul), iar gestiunea nu scădea stocul.
  // `*` aduce și `product_handle` + `metadata` (garanția extinsă) și `variant_sku`.
  "items.*",
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
  //
  // Cardul si viramentul neincasate raman insa "pending": Medusa le marcheaza
  // `authorized` din clipa plasarii, inainte sa intre vreun ban, deci
  // `authorized` singur nu dovedeste nimic (vezi `isPaymentCommitted`).
  // Pentru stoc e totuna — gestiunea rezerva la fel pe pending si processing
  // si elibereaza doar pe cancelled / failed / refunded.
  if (isPaymentCommitted(order)) {
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

const isWarrantyItem = (item: any) => item?.product_handle === WARRANTY_HANDLE

/**
 * „+1 an" → 12, „+2 ani" → 24. Citim numărul din titlul variantei, cu SKU-ul
 * (`garantie-extinsa-2ani`) ca plasă, ca gestiunea să primească luni, nu text.
 */
const warrantyExtraMonths = (item: any): number | null => {
  const source = `${item?.variant_title ?? ""} ${item?.variant_sku ?? ""}`
  const years = source.match(/(\d+)\s*an/i)?.[1]
  return years ? Number(years) * 12 : null
}

/** Câmpurile de garanție extinsă ale unei linii; nule pe liniile de marfă. */
const warrantyFields = (item: any, items: any[]) => {
  if (!isWarrantyItem(item)) {
    return {
      is_extended_warranty: false,
      warranty_extra_months: null,
      warranty_covers: [],
      warranty_for_line_id: null,
      warranty_for_product_id: null,
      warranty_for_variant_id: null,
      warranty_for_title: null,
    }
  }
  const targetProductId =
    typeof item.metadata?.warranty_for === "string"
      ? item.metadata.warranty_for
      : null
  const coveredLines = targetProductId
    ? items.filter((i) => !isWarrantyItem(i) && i.product_id === targetProductId)
    : []
  const covered = coveredLines[0]

  // Garanția se vinde pe bucată: împărțim cantitatea ei pe liniile produsului,
  // în ordinea lor, fără să acoperim mai mult decât s-a plătit.
  let remaining = num(item.quantity)
  const warranty_covers = coveredLines
    .map((line) => {
      const quantity = Math.min(num(line.quantity), remaining)
      remaining -= quantity
      return { line_id: line.id, variant_id: line.variant_id ?? null, quantity }
    })
    .filter((c) => c.quantity > 0)

  return {
    is_extended_warranty: true,
    warranty_extra_months: warrantyExtraMonths(item),
    warranty_covers,
    warranty_for_line_id: covered?.id ?? null,
    warranty_for_product_id: targetProductId,
    warranty_for_variant_id: covered?.variant_id ?? null,
    warranty_for_title:
      typeof item.metadata?.warranty_for_title === "string"
        ? item.metadata.warranty_for_title
        : (covered?.product_title ?? null),
  }
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
    ...warrantyFields(item, order?.items ?? []),
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
  // Eticheta pe care o vede operatorul in admin si clientul in contul lui.
  // Nu inlocuieste `status` (gestiunea decide pe ala), dar da contextul pe
  // care statusul canonic nu-l poate exprima: „asteptam stoc", „link trimis".
  status_label: effectiveOrderStatus(order).label,
  status_note: effectiveOrderStatus(order).note,
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
