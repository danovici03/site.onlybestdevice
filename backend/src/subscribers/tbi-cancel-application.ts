import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { getTbiClient } from "../modules/tbi-pay/client"

/**
 * Când o comandă finanțată prin TBI e anulată (din admin sau de client),
 * retragem și cererea de credit — altfel rămâne activă la ei și clientul poate
 * primi aprobare pentru o comandă care nu mai există.
 *
 * TBI acceptă retragerea doar înainte de aprobare, deci ieșim dacă statusul nu
 * mai e `pending`. Anularea declanșată chiar de un status „respins” intră tot
 * pe aici: hook-ul scrie statusul înainte de `cancelOrderWorkflow`, tocmai ca
 * verificarea de mai jos să o oprească.
 */
export default async function tbiCancelApplicationHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
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
    filters: { id: event.data.id },
  })

  const order = orders?.[0]
  if (!order) {
    return
  }

  const isTbi = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .some((ps: any) => ps?.provider_id?.includes("_tbi_"))
  if (!isTbi) {
    return
  }

  const meta = (order.metadata ?? {}) as Record<string, any>
  const tbi = meta.tbi as Record<string, any> | undefined

  // Fără `tbi` nu s-a creat nicio cerere (sesiunea a eșuat), deci n-avem ce
  // retrage. `cancel_sent_at` ne apără de anulări repetate.
  if (!tbi || tbi.status !== "pending" || tbi.cancel_sent_at) {
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

  const orderModule = container.resolve(Modules.ORDER)
  await orderModule.updateOrders(order.id, {
    metadata: {
      ...meta,
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
