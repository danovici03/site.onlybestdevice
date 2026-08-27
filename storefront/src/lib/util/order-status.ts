/**
 * Eticheta comercială pusă de operator din admin (`metadata.order_status`).
 *
 * Nu recalculăm aici statusul derivat — regula de derivare trăiește într-un
 * singur loc, în backend (`src/lib/orders/order-status.ts`). Singurul lucru pe
 * care storefrontul trebuie să-l știe e dacă eticheta mai e valabilă, iar asta
 * se verifică comparând cele trei axe Medusa cu cele fotografiate la punerea
 * ei. Fără verificare, un „În așteptare" pus pentru lipsă de stoc ar rămâne
 * afișat clientului și după ce comanda a fost livrată.
 */

export type CommercialStatusCode =
  | "processing"
  | "pending"
  | "payment_failed"
  | "awaiting_bank_transfer"
  | "canceled"
  | "completed"

type OrderLike = {
  status?: string | null
  payment_status?: string | null
  fulfillment_status?: string | null
  metadata?: Record<string, any> | null
}

export type ManualStatus = {
  code: CommercialStatusCode
  note: string | null
}

const CODES = new Set<string>([
  "processing",
  "pending",
  "payment_failed",
  "awaiting_bank_transfer",
  "canceled",
  "completed",
])

export const readManualOrderStatus = (
  order: OrderLike | null | undefined
): ManualStatus | null => {
  const raw = order?.metadata?.order_status
  if (!raw?.code || !CODES.has(raw.code)) return null

  const snap = raw.snapshot
  if (
    !snap ||
    snap.order !== (order?.status ?? null) ||
    snap.payment !== (order?.payment_status ?? null) ||
    snap.fulfillment !== (order?.fulfillment_status ?? null)
  ) {
    // Comanda s-a mișcat de când s-a pus eticheta — a expirat.
    return null
  }

  return { code: raw.code as CommercialStatusCode, note: raw.note ?? null }
}
