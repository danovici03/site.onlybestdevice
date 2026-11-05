import { TEMPLATES } from "../../../modules/resend/templates"
import { toEmailOrder } from "../email-order"
import { AwbSchema, IdentitySchema, needsIdentity } from "../identity"
import { publicOrder } from "../orders"

const base = {
  id: "bbo_1",
  display_id: 9,
  access_token: "tok",
  device_name: "Apple iPhone 13",
  storage: "128GB",
  payout_method: "bank",
  quoted_price: 1500,
  quoted_voucher_price: 1650,
  final_amount: 1500,
  first_name: "Ana",
  last_name: "Pop",
  email: "ana@example.com",
  phone: "0700000000",
  delivery_method: "courier",
  address: { street: "Str. Lungă 1", city: "Cluj-Napoca", county: "Cluj" },
}

describe("datele pentru borderou", () => {
  it("se cer doar când oferta e acceptată și lipsesc", () => {
    expect(needsIdentity({ status: "accepted", cnp: null })).toBe(true)
    expect(needsIdentity({ status: "accepted", cnp: "1960523123456" })).toBe(false)
    for (const status of ["submitted", "received", "revised", "declined", "paid"]) {
      expect(needsIdentity({ status, cnp: null })).toBe(false)
    }
  })

  it("validează și normalizează CNP-ul și actul", () => {
    const ok = IdentitySchema.safeParse({ cnp: "1800101 420010", id_document: "rx  123456", home_address: "Str. Mică 2, Cluj" })
    expect(ok.success && ok.data).toEqual({ cnp: "1800101420010", id_document: "RX 123456", home_address: "Str. Mică 2, Cluj" })
    expect(IdentitySchema.safeParse({ cnp: "1800101420011", id_document: "RX 123456", home_address: "Str. Mică 2" }).success).toBe(false)
    expect(IdentitySchema.safeParse({ cnp: "1800101420010", id_document: "123456", home_address: "Str. Mică 2" }).success).toBe(false)
  })

  it("AWB-ul se curăță de spații și refuză caractere ciudate", () => {
    expect(AwbSchema.parse(" 2 1234 5678 901 ")).toBe("212345678901")
    expect(AwbSchema.safeParse("<script>").success).toBe(false)
    expect(AwbSchema.safeParse("123").success).toBe(false)
  })

  it("pagina publică spune dacă lipsesc datele, fără să le arate", () => {
    const pub = publicOrder({ ...base, status: "accepted", cnp: null })
    expect(pub.identity_required).toBe(true)
    expect(pub.courier?.recipient).toBeTruthy()
    const done = publicOrder({ ...base, status: "accepted", cnp: "1800101420010" }) as any
    expect(done.identity_required).toBe(false)
    expect(JSON.stringify(done)).not.toContain("1800101420010")
  })

  it("emailul de acceptare cere datele pe pagina preluării", () => {
    const order = toEmailOrder({ ...base, status: "accepted", cnp: null }) as any
    const { html } = (TEMPLATES as any)["buyback-status-customer"]({ order, storefront_url: "https://x.ro" })
    expect(html).toContain("CNP")
    expect(html).toContain("Completează datele")
    const withId = toEmailOrder({ ...base, status: "accepted", cnp: "1800101420010" }) as any
    expect((TEMPLATES as any)["buyback-status-customer"]({ order: withId, storefront_url: "https://x.ro" }).html).not.toContain("CNP")
  })

  it("emailul de trimitere are pașii Fan Courier cu plata la destinatar", () => {
    const order = toEmailOrder({ ...base, status: "submitted" }) as any
    const { html } = (TEMPLATES as any)["buyback-submitted-customer"]({ order, storefront_url: "https://x.ro" })
    expect(html).toContain("Fan Courier")
    expect(html).toContain("Destinatar")
    expect(html).not.toContain("Te contactăm")
  })
})
