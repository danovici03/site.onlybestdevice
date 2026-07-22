import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Creates the "Garanție extinsă" service product shown as a card on every
 * product page, with two variants (+1 an / +2 ani).
 *
 * The prices are just regular variant prices — after this script runs they
 * can be changed anytime from Medusa Admin → Products → Garanție extinsă,
 * without touching code.
 *
 * `metadata.hidden = "true"` keeps it out of the storefront catalog listings
 * (the storefront filters these out); it stays purchasable as a cart line item.
 *
 * Run:
 *   yarn medusa exec ./src/scripts/create-warranty-product.ts
 *   WARRANTY_PRICE_1Y=79 WARRANTY_PRICE_2Y=149 yarn medusa exec ./src/scripts/create-warranty-product.ts
 *
 * Idempotent: skipped entirely if the handle already exists.
 */

const CURRENCY = (process.env.WARRANTY_CURRENCY || "ron").toLowerCase()
const PRICE_1Y = Number(process.env.WARRANTY_PRICE_1Y || 99)
const PRICE_2Y = Number(process.env.WARRANTY_PRICE_2Y || 169)

export const WARRANTY_HANDLE = "garantie-extinsa"

export default async function createWarrantyProduct({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)

  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: WARRANTY_HANDLE },
  })
  if ((existing as any[]).length) {
    logger.info(
      `Product "${WARRANTY_HANDLE}" already exists (${(existing as any[])[0].id}) — nothing to do. ` +
        `Edit prices in Medusa Admin.`
    )
    return
  }

  const channels = await salesChannelService.listSalesChannels()
  if (!channels.length) throw new Error("No sales channels found.")
  const defaultChannel =
    channels.find((c) => c.name === "Default Sales Channel") ?? channels[0]
  const shippingProfiles = await fulfillmentService.listShippingProfiles()
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) throw new Error("No shipping profile found.")

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Garanție extinsă",
          handle: WARRANTY_HANDLE,
          subtitle: "Protecție suplimentară după garanția standard",
          description:
            "Extinde garanția produsului tău cu 1 sau 2 ani peste garanția " +
            "standard. Acoperă defecte de funcționare apărute în utilizare " +
            "normală — piese și manoperă incluse, fără costuri suplimentare.",
          status: ProductStatus.PUBLISHED,
          discountable: true,
          shipping_profile_id: shippingProfile.id,
          sales_channels: [{ id: defaultChannel.id }],
          // Ascuns din listările storefront-ului; rămâne cumpărabil în coș.
          metadata: { hidden: "true" },
          options: [{ title: "Durată", values: ["+1 an", "+2 ani"] }],
          variants: [
            {
              title: "+1 an",
              sku: "garantie-extinsa-1an",
              manage_inventory: false,
              options: { Durată: "+1 an" },
              prices: [{ amount: PRICE_1Y, currency_code: CURRENCY }],
            },
            {
              title: "+2 ani",
              sku: "garantie-extinsa-2ani",
              manage_inventory: false,
              options: { Durată: "+2 ani" },
              prices: [{ amount: PRICE_2Y, currency_code: CURRENCY }],
            },
          ],
        } as any,
      ],
    },
  })

  const product = (result as any[])[0]
  logger.info(
    `✓ Created "${product.title}" (${product.id}) — +1 an: ${PRICE_1Y} ${CURRENCY}, ` +
      `+2 ani: ${PRICE_2Y} ${CURRENCY}. Prices editable in Medusa Admin.`
  )
}
