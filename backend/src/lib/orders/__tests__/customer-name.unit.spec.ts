import { guestCustomerName, orderCustomerName } from "../customer-name"

const guest = {
  email: "ana@example.com",
  first_name: null,
  last_name: null,
  has_account: false,
}
const billing = { first_name: "Ana", last_name: "Pop" }
const shipping = { first_name: "Ion", last_name: "Pop" }

describe("orderCustomerName — coloana „Client”", () => {
  it("client fără cont: numele din adresa de facturare, nu emailul", () => {
    expect(
      orderCustomerName({
        customer: guest,
        billing_address: billing,
        shipping_address: shipping,
      })
    ).toBe("Ana Pop")
  })

  it("fără nume la facturare cade pe livrare", () => {
    expect(
      orderCustomerName({
        customer: guest,
        billing_address: { first_name: " ", last_name: null },
        shipping_address: shipping,
      })
    ).toBe("Ion Pop")
  })

  it("client fără cont: adresa comenzii bate numele din fișă", () => {
    expect(
      orderCustomerName({
        customer: { ...guest, first_name: "Maria", last_name: "Ionescu" },
        billing_address: billing,
      })
    ).toBe("Ana Pop")
  })

  it("client cu cont: numele din cont, ca în coloana nativă", () => {
    expect(
      orderCustomerName({
        customer: {
          ...guest,
          has_account: true,
          first_name: "Titus",
          last_name: "C",
        },
        billing_address: billing,
      })
    ).toBe("Titus C")
  })

  it("fără niciun nume rămâne emailul", () => {
    expect(orderCustomerName({ customer: guest })).toBe("ana@example.com")
    expect(orderCustomerName({ email: "x@y.ro" })).toBe("x@y.ro")
    expect(orderCustomerName({})).toBeNull()
  })
})

describe("guestCustomerName — completarea fișei", () => {
  it("ia numele din adresă pentru clientul fără cont", () => {
    expect(
      guestCustomerName({ customer: guest, shipping_address: shipping })
    ).toEqual({ first_name: "Ion", last_name: "Pop" })
  })

  it("nu atinge clientul cu cont", () => {
    expect(
      guestCustomerName({
        customer: { ...guest, has_account: true },
        billing_address: billing,
      })
    ).toBeNull()
  })

  it("ultima comandă câștigă: suprascrie numele vechi", () => {
    expect(
      guestCustomerName({
        customer: { ...guest, first_name: "Ana", last_name: "Pp" },
        billing_address: billing,
      })
    ).toEqual({ first_name: "Ana", last_name: "Pop" })
  })

  it("nu scrie dacă fișa are deja exact numele ăsta", () => {
    expect(
      guestCustomerName({
        customer: { ...guest, first_name: "Ana", last_name: "Pop " },
        billing_address: billing,
      })
    ).toBeNull()
  })

  it("nu scrie nimic dacă adresele n-au nume", () => {
    expect(guestCustomerName({ customer: guest })).toBeNull()
    expect(guestCustomerName({ billing_address: billing })).toBeNull()
  })
})
