import { upsertProducts } from "../products"

/**
 * Ce se intampla cu un SKU care exista deja in Medusa: se leaga, i se
 * reimprospateaza fisa tehnica si i se corecteaza pretul. Aici aparam partea de
 * pret — restul lantului (workflow-uri, price set-uri) e testat de Medusa.
 */

const readProductPrices = jest.fn()
const writeProductPrices = jest.fn()
const applyStock = jest.fn()

jest.mock("../../pricing", () => ({
  readProductPrices: (...args: unknown[]) => readProductPrices(...args),
  writeProductPrices: (...args: unknown[]) => writeProductPrices(...args),
}))

jest.mock("../../currency", () => ({
  resolveCurrencyCode: async () => "ron",
}))

jest.mock("../stock", () => ({
  applyStock: (...args: unknown[]) => applyStock(...args),
}))

jest.mock("@medusajs/medusa/core-flows", () => ({
  createProductsWorkflow: () => ({ run: jest.fn() }),
  updateProductsWorkflow: () => ({ run: jest.fn(async () => ({})) }),
}))

const VARIANT = {
  id: "variant_01",
  sku: "IPH15-128-BLK",
  product_id: "prod_01",
  product: { handle: "iphone-15", metadata: {} },
}

/** Container minimal: doar `query.graph`, singurul lucru pe care il rezolvam. */
const containerWith = (variants: unknown[]) => ({
  resolve: () => ({
    graph: async ({ entity }: { entity: string }) =>
      entity === "product_variant" ? { data: variants } : { data: [] },
  }),
})

const item = (price: number | null) => ({
  sku: VARIANT.sku,
  title: "iPhone 15 128GB Negru",
  ...(price != null ? { price } : {}),
})

const priced = (price: number | null, salePrice: number | null = null) => ({
  currency_code: "ron",
  variants: [{ id: VARIANT.id, title: "", sku: VARIANT.sku, price, sale_price: salePrice }],
})

beforeEach(() => {
  jest.clearAllMocks()
  writeProductPrices.mockResolvedValue(priced(0))
  applyStock.mockResolvedValue({ errors: [] })
})

describe("upsertProducts — pretul unui SKU existent", () => {
  it("scrie noul pret", async () => {
    readProductPrices.mockResolvedValue(priced(3999))

    const result = await upsertProducts(containerWith([VARIANT]), [item(3499)])

    expect(writeProductPrices).toHaveBeenCalledWith(expect.anything(), "prod_01", [
      { id: "variant_01", price: 3499 },
    ] as never)
    expect(result.prices_updated).toBe(1)
    expect(result.errors).toEqual([])
  })

  it("nu rescrie acelasi pret", async () => {
    // ERP-ul poate trimite `price` la fiecare push; un workflow pe o varianta
    // nemodificata ar fi zgomot curat si o revalidare de storefront degeaba.
    readProductPrices.mockResolvedValue(priced(3999))

    const result = await upsertProducts(containerWith([VARIANT]), [item(3999)])

    expect(writeProductPrices).not.toHaveBeenCalled()
    expect(result.prices_updated).toBe(0)
  })

  it("pune pret pe o varianta care inca nu are", async () => {
    readProductPrices.mockResolvedValue(priced(null))

    await upsertProducts(containerWith([VARIANT]), [item(3499)])

    expect(writeProductPrices).toHaveBeenCalled()
  })

  it("scoate promotia ramasa peste noul pret de baza", async () => {
    // 2500 promotional peste o baza coborata la 2000 ar afisa o "reducere" in sus.
    readProductPrices.mockResolvedValue(priced(3999, 2500))

    const result = await upsertProducts(containerWith([VARIANT]), [item(2000)])

    expect(writeProductPrices).toHaveBeenCalledWith(expect.anything(), "prod_01", [
      { id: "variant_01", price: 2000, sale_price: null },
    ] as never)
    expect(result.sale_prices_removed).toBe(1)
  })

  it("pastreaza promotia care ramane sub noul pret", async () => {
    readProductPrices.mockResolvedValue(priced(3999, 2500))

    const result = await upsertProducts(containerWith([VARIANT]), [item(3000)])

    expect(writeProductPrices).toHaveBeenCalledWith(expect.anything(), "prod_01", [
      { id: "variant_01", price: 3000 },
    ] as never)
    expect(result.sale_prices_removed).toBe(0)
  })

  it("o pozitie fara pret nu atinge preturile", async () => {
    // Push-ul de fisa tehnica sau de stoc nu trimite `price`.
    const result = await upsertProducts(containerWith([VARIANT]), [item(null)])

    expect(readProductPrices).not.toHaveBeenCalled()
    expect(writeProductPrices).not.toHaveBeenCalled()
    expect(result.linked).toBe(1)
  })

  it("un pret zero sau negativ e ignorat, nu scris", async () => {
    const result = await upsertProducts(containerWith([VARIANT]), [item(0)])

    expect(writeProductPrices).not.toHaveBeenCalled()
    expect(result.errors).toEqual([])
  })

  it("un pret picat nu strica restul apelului", async () => {
    readProductPrices.mockResolvedValue(priced(3999))
    writeProductPrices.mockRejectedValue(new Error("price set lipsa"))

    const result = await upsertProducts(containerWith([VARIANT]), [
      { ...item(3499), quantity: 3 },
    ])

    expect(result.errors).toEqual([
      { sku: VARIANT.sku, message: "pret neactualizat: price set lipsa" },
    ])
    // Legatura si stocul raman facute: ERP-ul are nevoie de ele chiar daca
    // pretul n-a trecut.
    expect(result.linked).toBe(1)
    expect(applyStock).toHaveBeenCalled()
  })
})
