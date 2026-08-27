/**
 * Statusul comercial al unei comenzi — cel pe care îl vede operatorul în admin
 * și clientul în contul lui.
 *
 * Medusa nu are așa ceva. Are trei axe separate (`order.status`,
 * `payment_status`, `fulfillment_status`), din care primele două sunt calculate
 * la citire, deci nici măcar nu pot fi scrise. Aici le reducem la o singură
 * etichetă, în vocabularul cu care lucrează magazinul.
 *
 * Statusul are două straturi:
 *
 *   1. cel DERIVAT din starea reală a comenzii — sursa de adevăr implicită;
 *   2. o etichetă MANUALĂ pusă de operator, pentru situațiile pe care Medusa
 *      nu are cum să le știe (așteptăm stocul de la furnizor, i-am trimis link
 *      de plată).
 *
 * Eticheta manuală expiră singură: reține cele trei axe Medusa așa cum arătau
 * în momentul punerii și e ignorată de îndată ce vreuna se schimbă. Fără regula
 * asta, un „În așteptare" pus pentru lipsă de stoc rămânea lipit pe comandă și
 * după ce pleca coletul.
 *
 * Cheia de expirare e intenționat starea BRUTĂ, nu statusul derivat: așa poate
 * fi verificată oriunde ajunge comanda (inclusiv în storefront) printr-o simplă
 * comparație de trei șiruri, fără ca regula de derivare să fie reimplementată
 * într-un al doilea loc de unde ar începe să difere.
 */

export type OrderStatusCode =
  | "processing"
  | "pending"
  | "payment_failed"
  | "awaiting_bank_transfer"
  | "canceled"
  | "completed"

export const ORDER_STATUS_LABELS: Record<OrderStatusCode, string> = {
  processing: "În procesare",
  pending: "În așteptare",
  payment_failed: "Eșuată",
  awaiting_bank_transfer: "Plată în așteptare — virament bancar",
  canceled: "Anulată",
  completed: "Finalizată",
}

/** Ordinea din dropdown-ul adminului. */
export const ORDER_STATUS_CODES = Object.keys(
  ORDER_STATUS_LABELS
) as OrderStatusCode[]

/**
 * Statusurile de livrare în care marfa a plecat efectiv din magazin.
 *
 * `fulfilled` (împachetat, încă în magazin) intră aici intenționat: în Medusa
 * `order.status` rămâne „pending" pe toată viața comenzii, deci dacă am aștepta
 * doar închiderea manuală, o comandă livrată n-ar ajunge niciodată „Finalizată".
 * Aceeași regulă decide și ce trimitem în gestiune — vezi `lib/erp/order-payload.ts`,
 * care importă constanta de aici tocmai ca cele două să nu poată diverge.
 */
export const SHIPPED_STATUSES = new Set(["fulfilled", "shipped", "delivered"])

/** Câmpurile minime din care se poate calcula statusul. */
export const ORDER_STATUS_FIELDS = [
  "id",
  "status",
  "canceled_at",
  "payment_status",
  "fulfillment_status",
  "metadata",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
  "payment_collections.payment_sessions.provider_id",
]

/** Statusurile de plată în care banii sunt deja angajați (autorizați sau luați). */
export const PAID_STATUSES = new Set([
  "captured",
  "partially_captured",
  "authorized",
  "partially_authorized",
  "partially_refunded",
])

/** Toți providerii cu care s-a atins comanda: plăți efective + sesiuni. */
export const orderPaymentProviders = (order: any): string[] => {
  const collections = order?.payment_collections ?? []
  return [
    ...collections.flatMap((pc: any) =>
      (pc?.payments ?? []).map((p: any) => p?.provider_id)
    ),
    ...collections.flatMap((pc: any) =>
      (pc?.payment_sessions ?? []).map((s: any) => s?.provider_id)
    ),
  ].filter(Boolean)
}

const hasProvider = (order: any, fragment: string) =>
  orderPaymentProviders(order).some((id: string) => id.includes(fragment))

/** Ramburs — nu se convertește în plată cu cardul, rămâne la curier. */
export const isCodOrder = (order: any) => hasProvider(order, "cod")

/** Ordin de plată / virament bancar. */
export const isBankTransferOrder = (order: any) =>
  hasProvider(order, "system_default")

/** Rate prin partener (TBI, UniCredit) — dosarul se închide la ei, nu la noi. */
export const isFinancedOrder = (order: any) =>
  hasProvider(order, "tbi") || hasProvider(order, "unicredit")

export const isCardOrder = (order: any) => hasProvider(order, "netopia")

/**
 * Statusul dedus din starea reală a comenzii. Ordinea contează: stările
 * terminale au prioritate.
 */
export const deriveOrderStatus = (order: any): OrderStatusCode => {
  const paymentStatus = (order?.payment_status ?? "") as string
  const fulfillmentStatus = (order?.fulfillment_status ?? "") as string
  const isPaid = PAID_STATUSES.has(paymentStatus)

  if (order?.status === "canceled" || order?.canceled_at) {
    return "canceled"
  }
  if (order?.status === "completed" || SHIPPED_STATUSES.has(fulfillmentStatus)) {
    return "completed"
  }

  // Netopia a raportat eroare prin IPN și de atunci nu a intrat nimic.
  if (!isPaid && (order?.metadata as any)?.netopia?.status === "error") {
    return "payment_failed"
  }

  if (!isPaid && isBankTransferOrder(order)) {
    return "awaiting_bank_transfer"
  }
  if (isPaid) {
    return "processing"
  }
  return "pending"
}

/** Cele trei axe Medusa, fotografiate la punerea etichetei. */
export type OrderStateSnapshot = {
  order: string | null
  payment: string | null
  fulfillment: string | null
}

export const orderStateSnapshot = (order: any): OrderStateSnapshot => ({
  order: order?.status ?? null,
  payment: order?.payment_status ?? null,
  fulfillment: order?.fulfillment_status ?? null,
})

export const sameOrderState = (
  a: OrderStateSnapshot | null | undefined,
  b: OrderStateSnapshot
): boolean =>
  !!a &&
  a.order === b.order &&
  a.payment === b.payment &&
  a.fulfillment === b.fulfillment

export type ManualOrderStatus = {
  code: OrderStatusCode
  note?: string | null
  at: string
  by?: string | null
  /** Starea comenzii când s-a pus eticheta — cheia expirării. */
  snapshot: OrderStateSnapshot
}

export type EffectiveOrderStatus = {
  code: OrderStatusCode
  label: string
  note: string | null
  /** True dacă eticheta e pusă de om, nu dedusă. */
  manual: boolean
  derived: OrderStatusCode
}

export const readManualStatus = (order: any): ManualOrderStatus | null => {
  const raw = (order?.metadata as any)?.order_status
  if (!raw?.code || !(raw.code in ORDER_STATUS_LABELS)) return null
  return raw as ManualOrderStatus
}

export const effectiveOrderStatus = (order: any): EffectiveOrderStatus => {
  const derived = deriveOrderStatus(order)
  const manual = readManualStatus(order)

  // Eticheta manuală ține doar cât timp realitatea nu s-a mișcat sub ea.
  if (manual && sameOrderState(manual.snapshot, orderStateSnapshot(order))) {
    return {
      code: manual.code,
      label: ORDER_STATUS_LABELS[manual.code],
      note: manual.note ?? null,
      manual: true,
      derived,
    }
  }

  return {
    code: derived,
    label: ORDER_STATUS_LABELS[derived],
    note: null,
    manual: false,
    derived,
  }
}

/**
 * Poate primi un link de plată cu cardul?
 *
 * Rambursul e exclus deliberat: are deja o plată autorizată pe `pp_cod_cod`, pe
 * care curierul o încasează la livrare. Dacă am da și link de card, clientul ar
 * putea plăti de două ori. Ratele sunt excluse pentru că dosarul de finanțare
 * se închide la partener, nu la noi.
 */
export const canSendPaymentLink = (order: any): boolean => {
  const status = deriveOrderStatus(order)
  if (status === "canceled" || status === "completed") return false
  if (PAID_STATUSES.has((order?.payment_status ?? "") as string)) return false
  if (isCodOrder(order) || isFinancedOrder(order)) return false
  return true
}
