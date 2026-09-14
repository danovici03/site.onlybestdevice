/**
 * Configurează livrarea pentru România:
 *  - șterge opțiunile demo din seed
 *  - creează: Fan Curier standard, Fan Curier prioritar, Ridicare personală
 *
 * Opțiunile de curier intră cu tariful real (transportul se încasează prin
 * site); ridicarea din magazin rămâne pe 0. Cifrele stau în
 * src/lib/shipping/tariffs.ts.
 *
 * Rulare: cd backend && yarn medusa exec ./src/scripts/configure-shipping-ro.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

import { PRIORITY_TARIFF, STANDARD_TARIFF } from "../lib/shipping/tariffs"

const COURIER_NOTE = "Taxa de transport este inclusă în totalul comenzii."

export default async function configureShippingRo({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillment = container.resolve(Modules.FULFILLMENT)

  // Service zone + shipping profile + region
  const { data: zones } = await query.graph({
    entity: "service_zone",
    fields: ["id", "name", "fulfillment_set.type"],
  })
  const zone = zones.find((z: any) => z.fulfillment_set?.type === "shipping") || zones[0]
  if (!zone) throw new Error("Nicio service zone. Rulează seed-ul întâi.")

  const profiles = await fulfillment.listShippingProfiles({ type: "default" })
  const shippingProfile = profiles[0]
  if (!shippingProfile) throw new Error("Niciun shipping profile.")

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
  })
  const region = regions[0]

  // Șterge opțiunile existente (demo).
  const existing = await fulfillment.listShippingOptions({})
  if (existing.length) {
    await fulfillment.deleteShippingOptions(existing.map((o: any) => o.id))
    logger.info(`Șterse ${existing.length} opțiuni de livrare demo.`)
  }

  const baseRules = [
    { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
    { attribute: "is_return", value: "false", operator: "eq" as const },
  ]
  const opt = (
    name: string,
    code: string,
    label: string,
    description: string,
    amount: number
  ) => ({
    name,
    price_type: "flat" as const,
    provider_id: "manual_manual",
    service_zone_id: zone.id,
    shipping_profile_id: shippingProfile.id,
    type: { label, description, code },
    prices: [
      { currency_code: "ron", amount },
      ...(region ? [{ region_id: region.id, amount }] : []),
    ],
    rules: baseRules,
  })

  await createShippingOptionsWorkflow(container).run({
    input: [
      opt(
        "Livrare prin Fan Curier",
        "standard",
        "Standard",
        `Livrare în 1–3 zile lucrătoare. ${COURIER_NOTE}`,
        STANDARD_TARIFF
      ),
      opt(
        "Livrare prioritară prin Fan Curier",
        "priority",
        "Prioritară",
        "Comanda ta e procesată și expediată cu prioritate, înaintea " +
          `celorlalte. ${COURIER_NOTE}`,
        PRIORITY_TARIFF
      ),
      opt(
        "Ridicare personală de la locația magazinului",
        "pickup",
        "Ridicare din magazin",
        "Termen de procesare 1–2 zile lucrătoare. Te anunțăm pe email când " +
          "comanda este disponibilă în magazin.",
        0
      ),
    ],
  })
  logger.info("Create 3 opțiuni de livrare RO.")

  logger.info("✓ Configurare livrare RO completă.")
}
