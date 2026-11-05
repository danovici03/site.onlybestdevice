import { formatIban, isValidIban } from "../iban"

describe("isValidIban", () => {
  it("acceptă IBAN-uri valide, cu sau fără spații", () => {
    expect(isValidIban("RO49AAAA1B31007593840000")).toBe(true)
    expect(isValidIban("ro49 aaaa 1b31 0075 9384 0000")).toBe(true)
    expect(isValidIban("DE89370400440532013000")).toBe(true)
  })
  it("respinge cifra de control greșită și lungimea greșită", () => {
    expect(isValidIban("RO48AAAA1B31007593840000")).toBe(false)
    expect(isValidIban("RO49AAAA1B3100759384000")).toBe(false)
    expect(isValidIban("")).toBe(false)
  })
  it("formatează pe grupe de 4", () => {
    expect(formatIban("ro49aaaa1b31007593840000")).toBe("RO49 AAAA 1B31 0075 9384 0000")
  })
})
