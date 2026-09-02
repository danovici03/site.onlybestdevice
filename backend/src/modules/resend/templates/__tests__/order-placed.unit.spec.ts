import { TEMPLATES } from "../index"

const render = (name: string, data: Record<string, any>) =>
  (TEMPLATES as any)[name](data).html as string

const baseOrder = {
  id: "order_01TEST",
  display_id: 1234,
  email: "client@example.com",
  currency_code: "ron",
  total: 4599,
  metadata: {},
  items: [
    {
      id: "li_1",
      product_title: "iPhone 15",
      variant_title: "128GB Negru",
      quantity: 1,
      total: 4599,
      currency_code: "ron",
    },
  ],
  shipping_methods: [{ name: "Livrare prin Fan Curier", amount: 0 }],
  shipping_address: {
    first_name: "Ion",
    last_name: "Popescu",
    address_1: "Str. Mihai Viteazu nr. 12",
    city: "Cluj-Napoca",
    province: "Cluj",
    postal_code: "400001",
    country_code: "ro",
    phone: "0722123456",
  },
}

const pickupOrder = {
  ...baseOrder,
  shipping_methods: [
    { name: "Ridicare personală de la locația magazinului", amount: 0 },
  ],
}

describe("emailurile de comandă plasată", () => {
  it("dă operatorului adresa completă, ca s-o poată pune pe AWB", () => {
    const html = render("order-placed-admin", { order: baseOrder })

    expect(html).toContain("Str. Mihai Viteazu nr. 12")
    expect(html).toContain("400001 Cluj-Napoca, jud. Cluj")
    expect(html).toContain("România")
    expect(html).toContain("0722123456")
    expect(html).toContain("Metodă de livrare:")
    expect(html).toContain("Livrare prin Fan Curier")
  })

  it("confirmă clientului adresa la care livrăm", () => {
    const html = render("order-placed-customer", { order: baseOrder })

    expect(html).toContain("Str. Mihai Viteazu nr. 12")
    expect(html).toContain("Dacă adresa nu e corectă")
  })

  // Bugul reparat: fără `shipping_methods` în query, orice comandă părea
  // livrare prin curier și primea nota cu taxa plătită curierului.
  it("nu vorbește despre curier la ridicarea din magazin", () => {
    const html = render("order-placed-customer", { order: pickupOrder })

    expect(html).not.toContain("Taxa de transport")
    expect(html).toContain("Ridicare din magazin")
    expect(html).toContain("te așteaptă în magazin")
    // Adresa de livrare n-are ce căuta acolo — doar contactul.
    expect(html).not.toContain("Str. Mihai Viteazu")
  })

  // Județul e util pe AWB, dar la București ar dubla numele orașului.
  it("nu repetă județul când e identic cu orașul", () => {
    const html = render("order-placed-admin", {
      order: {
        ...baseOrder,
        shipping_address: {
          ...baseOrder.shipping_address,
          city: "București",
          province: "București",
          postal_code: "010101",
        },
      },
    })

    expect(html).toContain("010101 București")
    expect(html).not.toContain("jud. București")
  })
})
