import { applyStock } from "../stock"

/**
 * `changed` decide ce revalidează storefront-ul după un push de stoc: doar
 * produsele chiar schimbate, iar listările doar la trecerea în/din stoc.
 */

const updateLevels = jest.fn(async () => ({}))

jest.mock("@medusajs/medusa/core-flows", () => ({
  createInventoryItemsWorkflow: () => ({ run: jest.fn(async () => ({ result: [] })) }),
  createInventoryLevelsWorkflow: () => ({ run: jest.fn(async () => ({})) }),
  updateInventoryLevelsWorkflow: () => ({ run: updateLevels }),
  updateProductVariantsWorkflow: () => ({ run: jest.fn(async () => ({})) }),
}))

const LOCATION = "sloc_01"

const variant = (
  id: string,
  productId: string,
  stocked: number,
  reserved = 0,
  extra: Record<string, unknown> = {},
) => ({
  id,
  sku: `SKU-${id}`,
  product_id: productId,
  manage_inventory: true,
  allow_backorder: false,
  inventory_items: [
    {
      inventory: {
        id: `iitem_${id}`,
        location_levels: [
          {
            id: `ilev_${id}`,
            location_id: LOCATION,
            stocked_quantity: stocked,
            reserved_quantity: reserved,
          },
        ],
      },
    },
  ],
  ...extra,
})

const containerWith = (variants: unknown[]) => ({
  resolve: () => ({
    graph: async ({ entity }: { entity: string }) =>
      entity === "product_variant"
        ? { data: variants }
        : entity === "sales_channel_location"
          ? { data: [{ sales_channel_id: "sc_01" }] }
          : { data: [] },
    create: jest.fn(),
  }),
})

beforeAll(() => {
  process.env.ERP_STOCK_LOCATION_ID = LOCATION
})

afterAll(() => {
  delete process.env.ERP_STOCK_LOCATION_ID
})

beforeEach(() => jest.clearAllMocks())

describe("applyStock → changed", () => {
  it("cantitate neschimbată → niciun produs de revalidat", async () => {
    const result = await applyStock(containerWith([variant("v1", "prod_1", 3)]), [
      { variant_id: "v1", quantity: 3 },
    ])

    expect(result.changed).toEqual([])
    expect(updateLevels).not.toHaveBeenCalled()
  })

  it("3 → 2 bucăți: produsul se schimbă, dar rămâne în stoc", async () => {
    const result = await applyStock(containerWith([variant("v1", "prod_1", 3)]), [
      { variant_id: "v1", quantity: 2 },
    ])

    expect(result.changed).toEqual([{ product_id: "prod_1", availability_changed: false }])
  })

  it("ultima bucată vândută → iese din stoc", async () => {
    const result = await applyStock(containerWith([variant("v1", "prod_1", 1)]), [
      { variant_id: "v1", quantity: 0 },
    ])

    expect(result.changed).toEqual([{ product_id: "prod_1", availability_changed: true }])
  })

  it("rezervările contează: stocked 2 cu 2 rezervate era deja epuizat", async () => {
    const result = await applyStock(containerWith([variant("v1", "prod_1", 2, 2)]), [
      { variant_id: "v1", quantity: 1 },
    ])

    expect(result.changed).toEqual([{ product_id: "prod_1", availability_changed: true }])
  })

  it("backorder: mereu disponibil, deci fără trecere", async () => {
    const result = await applyStock(
      containerWith([variant("v1", "prod_1", 1, 0, { allow_backorder: true })]),
      [{ variant_id: "v1", quantity: 0 }],
    )

    expect(result.changed).toEqual([{ product_id: "prod_1", availability_changed: false }])
  })

  it("gestiunea de stoc pornită acum cu 0 bucăți → iese din stoc", async () => {
    const result = await applyStock(
      containerWith([variant("v1", "prod_1", 0, 0, { manage_inventory: false })]),
      [{ variant_id: "v1", quantity: 0 }],
    )

    expect(result.changed).toEqual([{ product_id: "prod_1", availability_changed: true }])
  })

  it("două variante ale aceluiași produs → un singur produs", async () => {
    const result = await applyStock(
      containerWith([variant("v1", "prod_1", 3), variant("v2", "prod_1", 1)]),
      [
        { variant_id: "v1", quantity: 2 },
        { variant_id: "v2", quantity: 0 },
      ],
    )

    expect(result.changed).toEqual([{ product_id: "prod_1", availability_changed: true }])
  })
})
