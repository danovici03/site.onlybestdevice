import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { getTbiClient } from "../modules/tbi-pay/client"
import { isTbiOrder, withTbiOrderLock } from "../lib/tbi/submit-application"

/** Stări în care cererea există (sau poate exista) la TBI și n-a fost aprobată. */
const WITHDRAWABLE = new Set(["pending", "submitting", "submit_uncertain"])

/**
 * Când o comandă finanțată prin TBI e anulată (din admin sau de client),
 * retragem și cererea de credit — altfel rămâne activă la ei și clientul poate
 * primi aprobare pentru o comandă care nu mai există.
 *
 * Rulează sub lacătul de trimitere (`withTbiOrderLock`): o anulare venită cât
 * cererea e încă în drum spre TBI așteaptă să se salveze rezultatul, altfel ar
 * vedea „nicio cerere" și ar pleca fără s-o retragă. La `submit_uncertain`
 * încercăm oricum — dacă cererea nu există, TBI refuză și rămâne logul.
 *
 * TBI acceptă retragerea doar înainte de aprobare. Anularea declanșată chiar
 * de un status „respins" intră tot pe aici: hook-ul scrie statusul înainte de
 * `cancelOrderWorkflow`, tocmai ca verificarea de mai jos să o oprească.
 */
export default async function tbiCancelApplicationHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await withTbiOrderLock(container, event.data.id, () =>
      withdraw(container, event.data.id)
    )
  } catch (e: any) {
    logger.error(`[tbi] order.canceled ${event.data.id}: ${e?.message}`)
  }
}

async function withdraw(container: any, orderId: string) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "metadata",
      "payment_collections.payment_sessions.provider_id",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order || !isTbiOrder(order)) {
    return
  }

  const tbi = (order.metadata as any)?.tbi as Record<string, any> | undefined

  // Fără `tbi` nu s-a creat nicio cerere. `cancel_sent_at` ne apără de
  // anulări repetate.
  if (!tbi || !WITHDRAWABLE.has(tbi.status) || tbi.cancel_sent_at) {
    return
  }

  try {
    // orderId = ce am trimis la Finalize, adică display_id.
    await getTbiClient().cancelByCustomer(String(order.display_id))
    logger.info(`[tbi] Cerere de credit retrasă pentru comanda #${order.display_id}`)
  } catch (e: any) {
    // Comanda e deja anulată la noi; dacă retragerea eșuează, rămâne de
    // rezolvat manual cu TBI — nu are rost să oprim restul fluxului.
    logger.error(
      `[tbi] Retragerea cererii pentru comanda #${order.display_id} a eșuat: ${e?.message}`
    )
    return
  }

  // Doar cheia `tbi`: Medusa face merge pe primul nivel al metadata.
  const orderModule = container.resolve(Modules.ORDER)
  await orderModule.updateOrders(order.id, {
    metadata: {
      tbi: {
        ...tbi,
        status: "cancelled",
        cancel_sent_at: new Date().toISOString(),
      },
    },
  })
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
