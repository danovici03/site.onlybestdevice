/**
 * Configurează livrarea pentru România:
 *  - șterge opțiunile demo din seed
 *  - creează: Curier standard (20 lei), Curier express (35 lei), Ridicare personală (0 lei)
 *  - creează o promoție automată „transport gratuit peste 1000 lei"
 *
 * Rulare: cd backend && yarn medusa exec ./src/scripts/configure-shipping-ro.ts
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  createPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"

const FREE_SHIPPING_THRESHOLD = 1000 // lei

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
        "Livrare prin curier (Cargus / Sameday / DPD)",
        "standard",
        "Standard",
        "Livrare prin curier în 1-3 zile lucrătoare.",
        20
      ),
      opt(
        "Livrare express",
        "express",
        "Express",
        "Livrare rapidă prin curier, în 24 de ore în orașele mari.",
        35
      ),
      opt(
        "Ridicare personală",
        "pickup",
        "Ridicare personală",
        "Ridici comanda personal, gratuit, după confirmare.",
        0
      ),
    ],
  })
  logger.info("Create 3 opțiuni de livrare RO.")

  // Promoție automată: transport gratuit peste prag.
  const { data: existingPromos } = await query.graph({
    entity: "promotion",
    fields: ["id", "code"],
    filters: { code: "TRANSPORT-GRATUIT" },
  })
  if (existingPromos.length) {
    logger.info("Promoția de transport gratuit există deja — o sar.")
  } else
  try {
    await createPromotionsWorkflow(container).run({
      input: {
        promotionsData: [
          {
            code: "TRANSPORT-GRATUIT",
            is_automatic: true,
            status: "active",
            type: "standard",
            application_method: {
              type: "percentage",
              target_type: "shipping_methods",
              allocation: "each",
              value: 100,
              currency_code: "ron",
              max_quantity: 1,
            },
            rules: [
              {
                attribute: "items.total",
                operator: "gte",
                values: [String(FREE_SHIPPING_THRESHOLD)],
              },
            ],
          } as any,
        ],
      },
    })
    logger.info(`Promoție automată „transport gratuit peste ${FREE_SHIPPING_THRESHOLD} lei" creată.`)
  } catch (e: any) {
    logger.warn(
      `Nu am putut crea automat promoția de transport gratuit (${e?.message?.slice(0, 140)}). ` +
        `O poți crea manual din Admin → Promotions (free shipping, automatic, regulă cart total ≥ ${FREE_SHIPPING_THRESHOLD}).`
    )
  }

  logger.info("✓ Configurare livrare RO completă.")
}
