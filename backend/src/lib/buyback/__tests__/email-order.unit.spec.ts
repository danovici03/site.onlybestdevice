import { TEMPLATES } from "../../../modules/resend/templates"
import { toEmailOrder } from "../email-order"

const full = {
  id: "bbo_1",
  display_id: 7,
  status: "accepted",
  access_token: "tok",
  device_name: "Apple iPhone 13",
  storage: "128GB",
  payout_method: "bank",
  quoted_price: 1500,
  revised_price: 1200,
  final_amount: 1200,
  first_name: "Ana",
  last_name: "Pop",
  email: "ana@example.com",
  phone: "0700000000",
  delivery_method: "store",
  iban: "RO49AAAA1B31007593840000",
  cnp: "1960523123456",
  id_document: "XB 123456",
  home_address: "Str. Secretă 1",
}

describe("toEmailOrder", () => {
  it("nu duce în notificare CNP, act, domiciliu sau IBAN complet", () => {
    const data = JSON.stringify(toEmailOrder(full))
    for (const secret of [full.cnp, full.id_document, full.home_address, full.iban]) {
      expect(data).not.toContain(secret)
    }
    expect(toEmailOrder(full).iban_last4).toBe("0000")
  })
})

describe("buyback-status-customer", () => {
  const render = (order: any, by?: string) =>
    (TEMPLATES as any)["buyback-status-customer"]({ order: toEmailOrder(order), by })

  it("răspunsul clientului nu sună a decizie a magazinului", () => {
    expect(render(full, "customer").subject).toContain("Ai acceptat oferta nouă")
    expect(render({ ...full, status: "declined" }, "customer").subject).toContain("Ai refuzat oferta nouă")
  })

  it("decizia magazinului își păstrează textul", () => {
    expect(render(full, "admin").subject).toContain("Preluarea a fost aprobată")
  })

  it("plata prin transfer arată ultimele 4 cifre din IBAN", () => {
    expect(render({ ...full, status: "paid" }, "admin").html).toContain("0000")
  })
})
