import {
  GLOBAL_STOCK_TAGS,
  MAX_TARGETED_PRODUCTS,
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
