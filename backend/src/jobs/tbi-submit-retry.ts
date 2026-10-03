import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  isTbiOrder,
  submitTbiApplication,
} from "../lib/tbi/submit-application"

/** Comenzile mai noi de atât le lasă în pace: checkout-ul/subscriber-ul lucrează încă pe ele. */
const MIN_AGE_MS = 2 * 60_000
/** Cât de departe în urmă reîncercăm eșecurile consemnate. */
const FAILED_WINDOW_MS = 24 * 60 * 60_000

/**
 * Reîncearcă cererile TBI care sigur n-au ajuns la TBI (conexiune refuzată,
 * TBI indisponibil). Câte o încercare pe comandă la fiecare rulare, până la
 * plafonul din `submitTbiApplication`; alertele pe email le trimite tot ea (la
 * eșec, la abandon și la recuperare, cu linkul pentru client).
 *
 * Luăm doar comenzile marcate `submit_failed` + `retriable`. Cele fără nicio
 * urmă în `metadata.tbi` NU: printre ele sunt comenzi de dinainte de fluxul
 * ăsta, la care vechea rută n-a lăsat nimic la eșec — o cerere de credit
 * pornită de noi ore mai târziu, fără client, ar face mai mult rău. Iar
 * `submit_uncertain` se verifică de mână în platforma TBI.
 */
export default async function tbiSubmitRetry(container: MedusaContainer) {
  if (!process.env.TBI_STORE_ID) return

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const now = Date.now()

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "status",
      "canceled_at",
      "created_at",
      "metadata",
      "payment_collections.payment_sessions.provider_id",
    ],
    filters: {
      created_at: { $gte: new Date(now - FAILED_WINDOW_MS).toISOString() },
    } as any,
  })

  const due = (orders ?? []).filter((order: any) => {
    if (!isTbiOrder(order)) return false
    if (order.status === "canceled" || order.canceled_at) return false
    const age = now - new Date(order.created_at).getTime()
    if (age < MIN_AGE_MS) return false
    const tbi = order.metadata?.tbi
    return tbi?.status === "submit_failed" && tbi.retriable && !tbi.gave_up_at
  })

  for (const order of due) {
    try {
      const result = await submitTbiApplication(container, order.id, {
        source: "job",
        attempts: 1,
      })
      logger.info(`[tbi] Reîncercare comanda #${order.display_id}: ${result.status}`)
    } catch (e: any) {
      logger.error(`[tbi] Reîncercarea pentru comanda #${order.display_id} a eșuat: ${e?.message}`)
    }
  }
}

export const config = {
  name: "tbi-submit-retry",
  schedule: "*/10 * * * *",
}
