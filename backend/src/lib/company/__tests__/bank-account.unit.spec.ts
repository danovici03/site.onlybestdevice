import { bankAccount, hasBankAccount } from "../bank-account"

describe("bankAccount", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.BANK_IBAN
    delete process.env.BANK_NAME
    delete process.env.BANK_HOLDER
  })

  afterAll(() => {
    process.env = env
  })

  it("întoarce null fără IBAN, ca emailul de virament să nu plece gol", () => {
    expect(bankAccount()).toBeNull()
    expect(hasBankAccount()).toBe(false)
  })

  it("tratează IBAN-ul doar din spații ca lipsă", () => {
    process.env.BANK_IBAN = "   "
    expect(bankAccount()).toBeNull()
  })

  it("normalizează IBAN-ul scris cu spații, cum e pe extrasul de cont", () => {
    process.env.BANK_IBAN = " ro54 btrl ronpos 0584073801 "
    expect(bankAccount()?.iban).toBe("RO54BTRLRONPOS0584073801")
  })

  it("pune denumirea societății ca beneficiar implicit", () => {
    process.env.BANK_IBAN = "RO54BTRLRONPOS0584073801"
    expect(bankAccount()).toEqual({
      iban: "RO54BTRLRONPOS0584073801",
      name: "",
      holder: "ONLY BEST DEVICE S.R.L.",
    })
  })

  it("citește env-ul la fiecare apel, nu la import", () => {
    process.env.BANK_IBAN = "RO49AAAA1B31007593840000"
    expect(bankAccount()?.iban).toBe("RO49AAAA1B31007593840000")
    process.env.BANK_IBAN = "RO54BTRLRONPOS0584073801"
    expect(bankAccount()?.iban).toBe("RO54BTRLRONPOS0584073801")
  })
})
