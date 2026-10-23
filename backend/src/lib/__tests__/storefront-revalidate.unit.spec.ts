import {
  DEFERRED_PRODUCT_TAGS,
  GLOBAL_STOCK_TAGS,
  MAX_TARGETED_PRODUCTS,
  productRevalidationTags,
  resetDeferredRevalidation,
  revalidateStorefrontLater,
  stockRevalidationTags,
} from "../storefront-revalidate"

/**
 * Revalidarea la stoc trebuie să rămână țintită: tagul global `products` la
 * fiecare vânzare din magazin regenera tot site-ul pe Vercel (facturat).
 */

describe("stockRevalidationTags", () => {
  it("nimic schimbat → nicio revalidare", () => {
    expect(stockRevalidationTags([])).toEqual([])
  })

  it("cantitate schimbată fără trecere în/din stoc → doar produsul și coșurile", () => {
    const tags = stockRevalidationTags([
      { id: "prod_01", handle: "iphone-15", availability_changed: false },
    ])

    expect(tags.sort()).toEqual(["carts", "product-iphone-15", "product-prod_01"])
    expect(tags).not.toContain("products")
    expect(tags).not.toContain("product-lists")
  })

  it("produs epuizat sau revenit în stoc → și listările", () => {
    const tags = stockRevalidationTags([
      { id: "prod_01", handle: "iphone-15", availability_changed: false },
      { id: "prod_02", handle: "iphone-16", availability_changed: true },
    ])

    expect(tags).toContain("product-lists")
    expect(tags).toContain("product-iphone-16")
    expect(tags).not.toContain("products")
  })

  it("resincronizare în masă → tagul global, nu sute de taguri", () => {
    const many = Array.from({ length: MAX_TARGETED_PRODUCTS + 1 }, (_, i) => ({
      id: `prod_${i}`,
      handle: `p-${i}`,
      availability_changed: false,
    }))

    expect(stockRevalidationTags(many)).toEqual(GLOBAL_STOCK_TAGS)
  })
})

/**
 * O salvare de produs nu are voie să invalideze tot site-ul: `categories` și
 * `products` stau pe fiecare pagină, iar fiecare pagină invalidată și vizitată
 * e o regenerare facturată pe Vercel.
 */
describe("productRevalidationTags", () => {
  it("produs salvat → pagina lui, listările și coșurile, fără tagurile globale", () => {
    const tags = productRevalidationTags(
      [{ id: "prod_01", handle: "iphone-15" }],
      { carts: true }
    )

    expect(tags.sort()).toEqual([
      "carts",
      "product-iphone-15",
      "product-lists",
      "product-prod_01",
    ])
    expect(tags).not.toContain("products")
    expect(tags).not.toContain("categories")
  })

  it("produs creat → fără coșuri", () => {
    expect(
      productRevalidationTags([{ id: "prod_01", handle: "x" }], { carts: false })
    ).not.toContain("carts")
  })

  it("niciun produs → nicio revalidare", () => {
    expect(productRevalidationTags([], { carts: true })).toEqual([])
  })

  it("tagurile amânate nu includ `categories`", () => {
    expect(DEFERRED_PRODUCT_TAGS).not.toContain("categories")
  })
})

describe("revalidateStorefrontLater", () => {
  const logger = { info: jest.fn(), warn: jest.fn() } as any
  const fetchMock = jest.fn()
  const env = { ...process.env }
  const realFetch = global.fetch

  beforeEach(() => {
    jest.useFakeTimers()
    process.env.STOREFRONT_REVALIDATE_URL = "https://site.test/api/revalidate"
    process.env.REVALIDATE_SECRET = "s"
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, headers: new Headers() })
    global.fetch = fetchMock as any
  })

  afterEach(() => {
    resetDeferredRevalidation()
    jest.useRealTimers()
    process.env = { ...env }
    global.fetch = realFetch
  })

  it("strânge evenimentele unei ferestre într-o singură cerere", async () => {
    for (let i = 0; i < 17; i++) {
      revalidateStorefrontLater(logger, "product.updated", ["products", "best-sellers"], 1000)
    }
    revalidateStorefrontLater(logger, "product.created", ["products"], 1000)
    expect(fetchMock).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(1000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tags.sort()).toEqual([
      "best-sellers",
      "products",
    ])
  })

  it("fereastra e fixă: evenimentele noi nu amână trimiterea", async () => {
    revalidateStorefrontLater(logger, "product.updated", ["products"], 1000)
    await jest.advanceTimersByTimeAsync(600)
    revalidateStorefrontLater(logger, "product.updated", ["products"], 1000)
    await jest.advanceTimersByTimeAsync(400)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("trimiterea eșuată se reîncearcă în fereastra următoare", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      headers: new Headers(),
      text: async () => "",
    })
    revalidateStorefrontLater(logger, "product.updated", ["products"], 1000)
    await jest.advanceTimersByTimeAsync(1000)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await jest.advanceTimersByTimeAsync(1000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).tags).toEqual(["products"])
  })

  it("după trimitere, următorul eveniment deschide o fereastră nouă", async () => {
    revalidateStorefrontLater(logger, "product.updated", ["products"], 1000)
    await jest.advanceTimersByTimeAsync(1000)
    revalidateStorefrontLater(logger, "product.updated", ["products"], 1000)
    await jest.advanceTimersByTimeAsync(1000)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
