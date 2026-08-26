import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { syncPhoneGroupsForProducts } from "../lib/phone-group"

/**
 * Leagă automat telefoanele de același model la fiecare salvare de produs.
 *
 * Înainte, legătura se făcea doar rulând manual
 * `medusa exec ./src/scripts/link-phone-variants.ts` — adică niciodată, în
 * practică: un produs venit din gestiune (draft) sau o culoare nouă adăugată în
 * Admin rămâneau orfane până când intra un dev pe server. Acum:
 *
 *   - ERP-ul creează produsul  → `product.created` → grupul se recalculează
 *   - operatorul îl publică    → `product.updated` → intră în selectorul fraților
 *   - redenumire / recategorisire / depublicare → grupul vechi se curăță singur
 *
 * Recalculăm **doar grupul atins**, nu tot catalogul (vezi
 * `syncPhoneGroupsForProducts`). Revalidarea storefront-ului vine gratis:
 * `revalidate-storefront.ts` ascultă aceleași evenimente.
 *
 * Bucla se stinge singură: scriem doar când metadata chiar se schimbă, deci
 * `product.updated`-ul provocat de noi găsește totul la zi și nu mai scrie.
 * De asta contează ordinea stabilă din `applyPhoneGroups` — fără ea, două
 * listări identice ar alterna la infinit.
 *
 * Oprire de urgență: `PHONE_GROUP_AUTOLINK=0` în `.env`.
 */
export default async function phoneGroupLink({
  event,
  container,
}: SubscriberArgs<{ id?: string; ids?: string[] }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (/^(0|false|no)$/i.test(process.env.PHONE_GROUP_AUTOLINK ?? "")) return

  const data = event.data as { id?: string; ids?: string[] } | undefined
  const ids = data?.ids?.length ? data.ids : data?.id ? [data.id] : []
  if (!ids.length) return

  try {
    const report = await syncPhoneGroupsForProducts(container, ids)

    if (report.updated) {
      logger.info(
        `[phone-group] ${event.name}: ${report.updated} produse relegate ` +
          `(grupuri: ${report.groups.join(", ") || "—"})`
      )
    }
  } catch (e) {
    // Nu lăsăm o eroare de grupare să rupă salvarea produsului.
    logger.warn(`[phone-group] ${event.name} eșuat: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
