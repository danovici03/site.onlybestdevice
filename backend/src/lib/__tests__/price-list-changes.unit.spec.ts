import {
  buildPriceSnapshot,
  changedProducts,
  priceChangeTags,
  type PriceListRow,
} from "../price-list-changes"
import { MAX_TARGETED_PRODUCTS } from "../storefront-revalidate"

const row = (overrides: Partial<PriceListRow> = {}): PriceListRow => ({
  product_id: "prod_1",
  handle: "tableta-tcl",
  variant_id: "var_1",
  price_list_id: "plist_1",
  currency_code: "ron",
  amount: 899,
  ...overrides,
})

const diff = (before: PriceListRow[], after: PriceListRow[]) =>
  changedProducts(buildPriceSnapshot(before), buildPriceSnapshot(after))

describe("changedProducts", () => {
  it("nu raportează nimic dacă prețurile sunt aceleași", () => {
    expect(diff([row()], [row()])).toEqual([])
  })

  it("ignoră ordinea rândurilor și forma numerică", () => {
    const a = row({ variant_id: "var_1" })
    const b = row({ variant_id: "var_2", amount: 999 })
    expect(diff([a, b], [{ ...b, amount: "999.00" }, a])).toEqual([])
  })

  it("prinde un preț schimbat", () => {
    expect(diff([row()], [row({ amount: 849 })])).toEqual([
      { id: "prod_1", handle: "tableta-tcl" },
    ])
  })

  it("prinde un produs adăugat în listă", () => {
    expect(diff([], [row()])).toEqual([{ id: "prod_1", handle: "tableta-tcl" }])
  })

  it("prinde un produs scos din listă, deși rândul de preț a dispărut", () => {
    expect(diff([row()], [])).toEqual([{ id: "prod_1", handle: "tableta-tcl" }])
  })

  it("prinde o variantă scoasă dintr-un produs rămas în listă", () => {
    const a = row({ variant_id: "var_1" })
    const b = row({ variant_id: "var_2" })
    expect(diff([a, b], [a])).toEqual([{ id: "prod_1", handle: "tableta-tcl" }])
  })

  it("nu atinge produsele neschimbate", () => {
    const other = row({ product_id: "prod_2", handle: "alt-produs" })
    expect(diff([row(), other], [row({ amount: 1 }), other])).toEqual([
      { id: "prod_1", handle: "tableta-tcl" },
    ])
  })
})

describe("priceChangeTags", () => {
  it("revalidează țintit, fără golirea globală `products`", () => {
    expect(priceChangeTags([{ id: "prod_1", handle: "tcl" }]).sort()).toEqual([
      "product-lists",
      "product-prod_1",
      "product-tcl",
    ])
  })

  it("peste prag trece pe tagurile globale", () => {
    const many = Array.from({ length: MAX_TARGETED_PRODUCTS + 1 }, (_, i) => ({
      id: `prod_${i}`,
      handle: `h-${i}`,
    }))
    expect(priceChangeTags(many).sort()).toEqual([
      "best-sellers",
      "product-lists",
      "products",
    ])
  })
})
