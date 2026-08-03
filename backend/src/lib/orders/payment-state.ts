import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * „Comanda asteapta plata pe pagina bancii?"
 *
 * Comenzile cu cardul se creeaza INAINTE de incasare — Netopia are nevoie de
 * un id de comanda ca sa deschida plata. Pana intra banii, comanda exista dar
 * nu e platita, iar restul sistemului (emailuri, ERP) nu trebuie sa se poarte
 * cu ea ca si cum ar fi. Confirmarea vine prin IPN, care scrie
 * `metadata.netopia.status = 'confirmed'` si captureaza plata.
 */

/** Campurile minime necesare pentru verificare, cand interoghezi comanda. */
export const CARD_PAYMENT_FIELDS = [
  "id",
  "metadata",
  "payment_collections.payment_sessions.provider_id",
]

export const awaitsCardPayment = (order: any): boolean => {
  const isNetopia = (order?.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .some((ps: any) => ps?.provider_id?.includes("netopia"))
  if (!isNetopia) return false
  return order?.metadata?.netopia?.status !== "confirmed"
}

/** Varianta care isi aduce singura comanda, cand ai doar id-ul. */
export const orderAwaitsCardPayment = async (
  container: any,
  orderId: string
): Promise<boolean> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: CARD_PAYMENT_FIELDS,
    filters: { id: orderId },
  })
  return awaitsCardPayment(orders?.[0])
}
