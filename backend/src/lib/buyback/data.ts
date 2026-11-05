import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { BUYBACK_MODULE } from "../../modules/buyback"
import { revalidateStorefront } from "../storefront-revalidate"
import type BuybackModuleService from "../../modules/buyback/service"
import type { Rule } from "./catalog"
import { storageGb } from "./schema"

export const buybackService = (scope: { resolve: (k: string) => any }) =>
  scope.resolve(BUYBACK_MODULE) as BuybackModuleService

export async function loadRules(scope: { resolve: (k: string) => any }): Promise<Rule[]> {
  const rows = await buybackService(scope).listBuybackRules({}, { take: 5000 })
  return rows.map((r: any) => ({
    key: r.key,
    scope: r.scope,
    scope_value: r.scope_value ?? "",
    kind: r.kind,
    value: Number(r.value) || 0,
  }))
}

export const sortPrices = <T extends { storage: string }>(prices: T[]) =>
  [...prices].sort((a, b) => storageGb(a.storage) - storageGb(b.storage))

/**
 * Prețul nostru de vânzare (cel mai mic preț normal în RON) pe
 * `phone_group` + stocare, din produsele publicate. Doar ca reper în admin:
 * cât cumperi vs cât vinzi un telefon nou de același model.
 *
 * Citește tot catalogul (~650 produse) — e o pagină de admin deschisă rar,
 * nu merită index separat.
 */
export async function loadSalePrices(
  scope: { resolve: (k: string) => any },
  groups: Set<string>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!groups.size) return out
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "metadata",
      "variants.id",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.prices.price_list_id",
    ],
    filters: { status: "published" },
  })
  for (const p of data as any[]) {
    const group = p.metadata?.phone_group
    const storage = p.metadata?.storage
    if (!group || !storage || !groups.has(group)) continue
    for (const v of p.variants ?? []) {
      for (const pr of v.prices ?? []) {
        if (pr.currency_code !== "ron" || pr.price_list_id) continue
        const amount = Number(pr.amount)
        if (!(amount > 0)) continue
        const k = `${group}|${storage}`
        const cur = out.get(k)
        if (cur === undefined || amount < cur) out.set(k, amount)
      }
    }
  }
  return out
}

/**
 * Lista de modele de pe site e în cache (tagul `buyback`). O golim după orice
 * schimbare de preț sau de model din admin. Regulile nu intră aici: oferta se
 * calculează la fiecare cerere, necache-uită.
 */
export function revalidateBuyback(scope: { resolve: (k: string) => any }, eventName: string) {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
  void revalidateStorefront(logger, eventName, ["buyback"])
}
