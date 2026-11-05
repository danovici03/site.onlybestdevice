import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

import { SH_ADDONS, SH_SERVICES_HANDLE } from "../lib/second-hand"

/**
 * Creează produsul de serviciu „Servicii Second Hand", cu două variante:
 * „Baterie nouă 100%" și „Folie de sticlă montată". Apar ca opțiuni pe pagina
 * produselor bifate „Second Hand" și intră în coș legate de telefon, ca
 * garanția extinsă.
 *
 * Prețurile de aici sunt cele implicite; se schimbă din Admin → Produse →
 * Servicii Second Hand, iar fiecare produs SH își poate pune suma proprie în
 * cardul „Second Hand".
 *
 * Run:
 *   yarn medusa exec ./src/scripts/create-second-hand-services.ts
 *   SH_BATTERY_PRICE=150 SH_FOLIE_PRICE=60 yarn medusa exec ./src/scripts/create-second-hand-services.ts
 *
 * Idempotent: nu face nimic dacă handle-ul există deja.
 */

const CURRENCY = (process.env.SH_CURRENCY || "ron").toLowerCase()
const BATTERY_PRICE = Number(process.env.SH_BATTERY_PRICE || 130)
const FOLIE_PRICE = Number(process.env.SH_FOLIE_PRICE || 50)

export default async function createSecondHandServices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)

  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { handle: SH_SERVICES_HANDLE },
  })
  if ((existing as any[]).length) {
    logger.info(
      `Product "${SH_SERVICES_HANDLE}" already exists (${(existing as any[])[0].id}) — nothing to do.`
    )
    return
  }

  const channels = await salesChannelService.listSalesChannels()
  if (!channels.length) throw new Error("No sales channels found.")
  const defaultChannel =
    channels.find((c) => c.name === "Default Sales Channel") ?? channels[0]
  const [shippingProfile] = await fulfillmentService.listShippingProfiles()
  if (!shippingProfile) throw new Error("No shipping profile found.")

  const BATTERY = "Baterie nouă 100%"
  const FOLIE = "Folie de sticlă montată"

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Servicii Second Hand",
          handle: SH_SERVICES_HANDLE,
          subtitle: "Opțiuni pentru produsele second hand",
          description:
            "Servicii efectuate de echipa noastră înainte de livrarea " +
            "produsului second hand: înlocuirea bateriei cu una nouă și " +
            "montarea unei folii de protecție din sticlă.",
          status: ProductStatus.PUBLISHED,
          discountable: true,
          shipping_profile_id: shippingProfile.id,
          sales_channels: [{ id: defaultChannel.id }],
          metadata: { hidden: "true" },
          options: [{ title: "Serviciu", values: [BATTERY, FOLIE] }],
          variants: [
            {
              title: BATTERY,
              sku: SH_ADDONS.battery.sku,
              manage_inventory: false,
              options: { Serviciu: BATTERY },
              prices: [{ amount: BATTERY_PRICE, currency_code: CURRENCY }],
            },
            {
              title: FOLIE,
              sku: SH_ADDONS.screen_protector.sku,
              manage_inventory: false,
              options: { Serviciu: FOLIE },
              prices: [{ amount: FOLIE_PRICE, currency_code: CURRENCY }],
            },
          ],
        } as any,
      ],
    },
  })

  const product = (result as any[])[0]
  logger.info(
    `✓ Created "${product.title}" (${product.id}) — baterie: ${BATTERY_PRICE} ${CURRENCY}, ` +
      `folie: ${FOLIE_PRICE} ${CURRENCY}. Prices editable in Medusa Admin.`
  )
}
