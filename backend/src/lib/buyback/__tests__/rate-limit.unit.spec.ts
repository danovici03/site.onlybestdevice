import { allowQuote, allowSubmit } from "../rate-limit"

const req = (ip: string) => ({ headers: { "x-client-ip": ip }, ip: "1.1.1.1" }) as any

describe("allowQuote", () => {
  it("cererile respinse pe IP nu consumă plafonul global", () => {
    const now = 1_000_000
    // Un client insistent: 40 permise, apoi mii respinse.
    for (let i = 0; i < 40; i++) expect(allowQuote(req("9.9.9.9"), now)).toBe(true)
    for (let i = 0; i < 5000; i++) expect(allowQuote(req("9.9.9.9"), now)).toBe(false)
    // Restul vizitatorilor nu sunt afectați.
    expect(allowQuote(req("8.8.8.8"), now)).toBe(true)
  })
})

describe("allowSubmit", () => {
  it("evaluările multe nu blochează trimiterea ofertei acceptate", () => {
    const now = 2_000_000
    for (let i = 0; i < 60; i++) allowQuote(req("7.7.7.7"), now)
    expect(allowQuote(req("7.7.7.7"), now)).toBe(false)
    expect(allowSubmit(req("7.7.7.7"), now)).toBe(true)
  })
})
