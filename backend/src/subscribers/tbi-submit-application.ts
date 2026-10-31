import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { submitTbiApplication } from "../lib/tbi/submit-application"

/**
 * Trimite cererea de credit la TBI pentru comenzile plătite în rate TBI.
 *
 * Storefront-ul cere și el linkul prin `/store/tbi/session` imediat după
 * plasare, dar dacă pică între timp (rețea, deploy, tab închis) cererea ar
 * rămâne netrimisă. Subscriber-ul e garanția; dublurile le oprește lacătul din
 * `submitTbiApplication`. Eșecurile trecătoare le reia job-ul
 * `tbi-submit-retry`.
 */
export default async function tbiSubmitApplicationHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await submitTbiApplication(container, event.data.id, { source: "subscriber" })
  } catch (e: any) {
    // Lacăt expirat sau eroare de bază de date; job-ul reîncearcă.
    logger.error(`[tbi] order.placed ${event.data.id}: ${e?.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
