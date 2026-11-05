import { signQuote, verifyQuote } from "../quote-token"

const base = {
  price_id: "bbprc_1",
  device_id: "bbdev_1",
  storage: "256GB",
  color: "Black",
  answers: {
    network: "unlocked" as const,
    liquid: false,
    screen: "perfect" as const,
    case: "perfect" as const,
    display_defects: [],
    phone_defects: [],
  },
  base_price: 3150,
  price: 3150,
  voucher_price: 3460,
  voucher_bonus_percent: 10,
}

describe("quote token", () => {
  it("se verifică și întoarce oferta", () => {
    const { token } = signQuote(base)
    expect(verifyQuote(token)).toMatchObject({ price: 3150, storage: "256GB" })
  })

  it("respinge un preț modificat de client", () => {
    const { token } = signQuote(base)
    const [data, sig] = token.split(".")
    const p = JSON.parse(Buffer.from(data, "base64url").toString())
    p.price = 9999
    const forged = `${Buffer.from(JSON.stringify(p)).toString("base64url")}.${sig}`
    expect(verifyQuote(forged)).toBeNull()
  })

  it("expiră după 7 zile", () => {
    const now = Date.now()
    const { token } = signQuote(base, now)
    expect(verifyQuote(token, now + 6 * 86400_000)).not.toBeNull()
    expect(verifyQuote(token, now + 8 * 86400_000)).toBeNull()
  })

  it("gunoiul nu aruncă", () => {
    expect(verifyQuote("")).toBeNull()
    expect(verifyQuote("abc.def")).toBeNull()
  })
})
