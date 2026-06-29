import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { ApiKey } from "../../.medusa/types/query-entry-points"

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies-ro",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[]
    store_id: string
  }) => {
    const normalizedInput = transform({ input }, (data) => ({
      selector: { id: data.input.store_id },
      update: {
        supported_currencies: data.input.supported_currencies.map((c) => ({
          currency_code: c.currency_code,
          is_default: c.is_default ?? false,
        })),
      },
    }))
    const stores = updateStoresStep(normalizedInput)
    return new WorkflowResponse(stores)
  }
)

// Categoriile preluate de pe onlybestdevice.ro.
const CATEGORIES = [
  "Telefoane mobile",
  "Tablete",
  "Încărcătoare & accesorii",
  "Smartwatch & Wearables",
  "Console, Jocuri",
  "Laptop",
  "Desktop PC & Periferice",
  "TV, Audio-Video și Foto",
  "Huse telefoane",
  "Folii de protecție",
  "Diverse",
]

export default async function seedOnlybestdevice({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const storeModuleService = container.resolve(Modules.STORE)

  const countries = ["ro"]

  logger.info("Seeding store data (RO)...")
  const [store] = await storeModuleService.listStores()
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })

  if (!defaultSalesChannel.length) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
    })
    defaultSalesChannel = result
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [{ currency_code: "ron", is_default: true }],
    },
  })

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_sales_channel_id: defaultSalesChannel[0].id },
    },
  })

  logger.info("Seeding region (România)...")
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "România",
          currency_code: "ron",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  })
  const region = regionResult[0]

  logger.info("Seeding tax region (RO)...")
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  })

  logger.info("Seeding stock location (București)...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Depozit București",
          address: { city: "București", country_code: "RO", address_1: "" },
        },
      ],
    },
  })
  const stockLocation = stockLocationResult[0]

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_location_id: stockLocation.id },
    },
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })

  logger.info("Seeding fulfillment data...")
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
    })
    shippingProfile = result[0]
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Livrare România",
    type: "shipping",
    service_zones: [
      {
        name: "România",
        geo_zones: [{ country_code: "ro", type: "country" }],
      },
    ],
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  })

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Livrare standard (curier)",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Livrare prin curier în 1-3 zile lucrătoare.",
          code: "standard",
        },
        prices: [{ currency_code: "ron", amount: 20 }, { region_id: region.id, amount: 20 }],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "Livrare gratuită",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Gratuită",
          description: "Livrare gratuită pentru comenzi mari.",
          code: "free",
        },
        prices: [{ currency_code: "ron", amount: 0 }, { region_id: region.id, amount: 0 }],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  })

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [defaultSalesChannel[0].id] },
  })

  logger.info("Seeding publishable API key...")
  let publishableApiKey: ApiKey | null = null
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id", "token"],
    filters: { type: "publishable" },
  })
  publishableApiKey = data?.[0]

  if (!publishableApiKey) {
    const {
      result: [created],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [{ title: "Webshop", type: "publishable", created_by: "" }],
      },
    })
    publishableApiKey = created as ApiKey
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: publishableApiKey.id, add: [defaultSalesChannel[0].id] },
  })
  logger.info(`Publishable API key: ${(publishableApiKey as any).token ?? publishableApiKey.id}`)

  logger.info("Seeding categories (onlybestdevice)...")
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: CATEGORIES.map((name) => ({ name, is_active: true })),
    },
  })
  const catId = (name: string) =>
    categoryResult.find((c) => c.name === name)!.id

  logger.info("Seeding sample products (RON)...")
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Smartphone Aurora 5G 256GB",
          handle: "smartphone-aurora-5g-256gb",
          category_ids: [catId("Telefoane mobile")],
          description:
            "Telefon nou, sigilat, cu garanție 24 de luni. Ecran AMOLED 6.7\", 5G, cameră triplă.",
          weight: 250,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=1200",
            },
          ],
          options: [{ title: "Culoare", values: ["Negru", "Albastru"] }],
          variants: [
            {
              title: "Negru",
              sku: "AURORA-256-BLK",
              options: { Culoare: "Negru" },
              prices: [{ amount: 2999, currency_code: "ron" }],
            },
            {
              title: "Albastru",
              sku: "AURORA-256-BLU",
              options: { Culoare: "Albastru" },
              prices: [{ amount: 2999, currency_code: "ron" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Laptop UltraBook 14 i7 16GB",
          handle: "laptop-ultrabook-14-i7-16gb",
          category_ids: [catId("Laptop")],
          description:
            "Laptop ultraportabil, procesor i7, 16GB RAM, SSD 512GB. Garanție 24 de luni.",
          weight: 1400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80&w=1200",
            },
          ],
          options: [{ title: "Capacitate", values: ["512GB"] }],
          variants: [
            {
              title: "512GB",
              sku: "ULTRABOOK-14-512",
              options: { Capacitate: "512GB" },
              prices: [{ amount: 4499, currency_code: "ron" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Smartwatch Active 2",
          handle: "smartwatch-active-2",
          category_ids: [catId("Smartwatch & Wearables")],
          description:
            "Ceas inteligent cu GPS, monitorizare puls și SpO2. Autonomie 7 zile.",
          weight: 60,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1200",
            },
          ],
          options: [{ title: "Culoare", values: ["Negru"] }],
          variants: [
            {
              title: "Negru",
              sku: "ACTIVE2-BLK",
              options: { Culoare: "Negru" },
              prices: [{ amount: 599, currency_code: "ron" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  })

  logger.info("Seeding inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  })
  const inventoryLevels: CreateInventoryLevelInput[] = inventoryItems.map(
    (item) => ({
      location_id: stockLocation.id,
      stocked_quantity: 100,
      inventory_item_id: item.id,
    })
  )
  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels: inventoryLevels },
  })

  logger.info("✓ Seed onlybestdevice complet.")
}
