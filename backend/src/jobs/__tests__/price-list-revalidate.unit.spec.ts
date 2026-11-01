import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { DEFERRED_PRODUCT_TAGS } from "../../lib/storefront-revalidate"

const revalidateStorefront = jest.fn()
const revalidateStorefrontLater = jest.fn()

jest.mock("../../lib/storefront-revalidate", () => ({
  ...jest.requireActual("../../lib/storefront-revalidate"),
  revalidateStorefront: (...args: unknown[]) => revalidateStorefront(...args),
  revalidateStorefrontLater: (...args: unknown[]) =>
    revalidateStorefrontLater(...args),
}))

const row = (overrides = {}) => ({
  product_id: "prod_1",
  handle: "tableta-tcl",
  variant_id: "var_1",
  price_list_id: "plist_1",
  currency_code: "ron",
  amount: 899,
  ...overrides,
})

const logger = { info: jest.fn(), warn: jest.fn() }

/** Instantaneul e stare de modul, deci fiecare test încarcă jobul din nou. */
const setup = () => {
  let rows: unknown[] = []
  const raw = jest.fn(async (_sql: string) => ({ rows }))
  const container: any = {
    resolve: (key: string) =>
      ({
        [ContainerRegistrationKeys.LOGGER]: logger,
        [ContainerRegistrationKeys.QUERY]: {
          graph: async () => ({ data: [] }),
        },
        [ContainerRegistrationKeys.PG_CONNECTION]: { raw },
      })[key],
  }
  let job: (c: unknown) => Promise<void>
  jest.isolateModules(() => {
    job = require("../price-list-revalidate").default
  })
  return {
    raw,
    run: (next: unknown[]) => {
      rows = next
      return job(container)
    },
  }
}

const sentTags = () =>
  revalidateStorefront.mock.calls.map(([, , tags]) => [...tags].sort())

describe("priceListRevalidate", () => {
  beforeEach(() => {
    revalidateStorefront.mockReset().mockResolvedValue(true)
    revalidateStorefrontLater.mockReset()
  })

  it("prima rulare doar reface instantaneul", async () => {
    await setup().run([row()])
    expect(revalidateStorefront).not.toHaveBeenCalled()
  })

  it("citește doar listele în desfășurare", async () => {
    const { raw, run } = setup()
    await run([])
    const sql = raw.mock.calls[0][0]
    expect(sql).toContain("pl.starts_at <= NOW()")
    expect(sql).toContain("pl.ends_at >= NOW()")
  })

  it("golește produsul schimbat și pune meniul în coada amânată", async () => {
    const { run } = setup()
    await run([row()])
    await run([row({ amount: 849 })])

    expect(sentTags()).toEqual([
      ["product-lists", "product-prod_1", "product-tableta-tcl"],
    ])
    expect(revalidateStorefrontLater).toHaveBeenCalledTimes(1)
    expect(revalidateStorefrontLater.mock.calls[0][2]).toEqual(
      DEFERRED_PRODUCT_TAGS
    )
  })

  it("nu trimite nimic dacă prețurile sunt aceleași", async () => {
    const { run } = setup()
    await run([row()])
    await run([row()])
    expect(revalidateStorefront).not.toHaveBeenCalled()
    expect(revalidateStorefrontLater).not.toHaveBeenCalled()
  })

  it("reîncearcă la rularea următoare dacă storefront-ul a refuzat", async () => {
    const { run } = setup()
    await run([row()])

    revalidateStorefront.mockResolvedValueOnce(false)
    await run([row({ amount: 849 })])
    expect(revalidateStorefrontLater).not.toHaveBeenCalled()

    await run([row({ amount: 849 })])
    expect(revalidateStorefront).toHaveBeenCalledTimes(2)
    expect(revalidateStorefrontLater).toHaveBeenCalledTimes(1)
  })

  it("după redenumire, scoaterea din listă golește handle-ul nou", async () => {
    const { run } = setup()
    await run([row({ handle: "vechi" })])
    await run([row({ handle: "nou" })])
    expect(revalidateStorefront).not.toHaveBeenCalled()

    await run([])
    expect(sentTags()).toEqual([
      ["product-lists", "product-nou", "product-prod_1"],
    ])
  })
})
