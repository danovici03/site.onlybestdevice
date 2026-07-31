import { toCanonicalStatus, toErpPayload } from "../order-payload"

/**
 * Reducerea celor trei axe de status ale Medusei la statusul canonic al gestiunii.
 * Regula sta doar aici, deci tot aici trebuie aparata.
 */
describe("toCanonicalStatus", () => {
  const order = (o: Record<string, unknown>) => ({
    status: "pending",
    payment_status: "not_paid",
    fulfillment_status: "not_fulfilled",
    ...o,
  })

  it("comanda proaspata e pending", () => {
    expect(toCanonicalStatus(order({}))).toBe("pending")
  })

  it("anularea bate orice altceva", () => {
    expect(
      toCanonicalStatus(
        order({ status: "canceled", payment_status: "captured", fulfillment_status: "delivered" }),
      ),
    ).toBe("cancelled")
    expect(toCanonicalStatus(order({ canceled_at: "2026-07-30T10:00:00Z" }))).toBe("cancelled")
    expect(toCanonicalStatus(order({ payment_status: "canceled" }))).toBe("cancelled")
  })

  it("doar refund-ul integral scoate vanzarea din venituri", () => {
    expect(toCanonicalStatus(order({ payment_status: "refunded" }))).toBe("refunded")
    // Un retur pe o singura linie nu are voie sa elibereze tot stocul comenzii.
    expect(toCanonicalStatus(order({ payment_status: "partially_refunded" }))).toBe("processing")
  })

  it("incasarea NU inseamna livrare — marfa e inca in raft", () => {
    expect(toCanonicalStatus(order({ payment_status: "captured" }))).toBe("processing")
    expect(toCanonicalStatus(order({ payment_status: "authorized" }))).toBe("processing")
    expect(toCanonicalStatus(order({ payment_status: "partially_captured" }))).toBe("processing")
  })

  it("expedierea finalizeaza comanda", () => {
    for (const fulfillment_status of ["fulfilled", "shipped", "delivered"]) {
      expect(toCanonicalStatus(order({ fulfillment_status }))).toBe("completed")
    }
  })

  it("expedierea partiala NU finalizeaza comanda", () => {
    for (const fulfillment_status of [
      "partially_fulfilled",
      "partially_shipped",
      "partially_delivered",
    ]) {
      expect(toCanonicalStatus(order({ fulfillment_status }))).toBe("pending")
    }
  })

  it("inchiderea manuala a comenzii finalizeaza", () => {
    expect(toCanonicalStatus(order({ status: "completed" }))).toBe("completed")
  })

  it("requires_action e tratat ca esec", () => {
    expect(toCanonicalStatus(order({ payment_status: "requires_action" }))).toBe("failed")
  })
})

describe("toErpPayload", () => {
  const base = {
    id: "order_01H",
    display_id: 1042,
    status: "pending",
    payment_status: "captured",
    fulfillment_status: "not_fulfilled",
    email: "client@example.com",
    currency_code: "ron",
    created_at: "2026-07-30T09:00:00.000Z",
    customer_id: "cus_01H",
    subtotal: 3999,
    tax_total: 0,
    discount_total: 0,
    shipping_total: 25,
    total: 4024,
    billing_address: { id: "addr_1", first_name: "Ion", last_name: "Popescu", phone: "0722000111" },
    shipping_address: null,
    items: [
      {
        id: "item_1",
        variant_id: "variant_01H",
        product_id: "prod_01H",
        variant_sku: "IPH15-128",
        product_title: "iPhone 15",
        variant_title: "128GB Negru",
        quantity: 1,
        unit_price: 3999,
        tax_total: 0,
        total: 3999,
      },
    ],
    payment_collections: [
      {
        payments: [
          { id: "pay_1", provider_id: "pp_netopia_netopia", captured_at: "2026-07-30T09:01:00.000Z" },
        ],
        payment_sessions: [{ provider_id: "pp_netopia_netopia" }],
      },
    ],
  }

  it("normalizeaza comanda pentru gestiune", () => {
    const p = toErpPayload(base)

    expect(p.id).toBe("order_01H")
    expect(p.display_id).toBe(1042)
    expect(p.status).toBe("processing")
    expect(p.raw_status).toEqual({
      order: "pending",
      payment: "captured",
      fulfillment: "not_fulfilled",
    })
    expect(p.date_paid).toBe("2026-07-30T09:01:00.000Z")
    expect(p.payment_method).toBe("pp_netopia_netopia")
    expect(p.line_items).toHaveLength(1)
    expect(p.line_items[0]).toMatchObject({
      variant_id: "variant_01H",
      sku: "IPH15-128",
      name: "iPhone 15 / 128GB Negru",
      quantity: 1,
      // Medusa v2 tine sume zecimale, nu bani — 3999 = 3999 RON, nu 39,99.
      unit_price: 3999,
    })
    // `id` nu are ce cauta in adresa trimisa gestiunii
    expect(p.billing).not.toHaveProperty("id")
    expect(p.billing).toMatchObject({ first_name: "Ion", phone: "0722000111" })
    expect(p.shipping).toEqual({})
  })

  it("fara plata incasata, date_paid e null", () => {
    const p = toErpPayload({
      ...base,
      payment_status: "authorized",
      payment_collections: [
        { payments: [{ id: "pay_1", provider_id: "pp_cod_cod", captured_at: null }], payment_sessions: [] },
      ],
    })

    expect(p.date_paid).toBeNull()
    expect(p.payment_method).toBe("pp_cod_cod")
  })

  it("nu foloseste titlul variantei cand e identic cu al produsului", () => {
    const p = toErpPayload({
      ...base,
      items: [{ ...base.items[0], variant_title: "iPhone 15", product_title: "iPhone 15" }],
    })

    expect(p.line_items[0].name).toBe("iPhone 15")
  })
})
