import { describeOrderPayment, describePaymentProvider } from "../payment-method"

describe("describePaymentProvider — eticheta din lista de comenzi", () => {
  it.each([
    ["pp_netopia_netopia", "Card Netopia"],
    ["pp_cod_cod", "Ramburs"],
    ["pp_tbi_tbi", "TBI"],
    ["pp_unicredit_unicredit", "UniCredit"],
    ["pp_system_default", "Transfer"],
  ])("%s → %s", (providerId, tag) => {
    expect(describePaymentProvider(providerId)?.tag).toBe(tag)
  })

  it("un provider nemapat își arată id-ul", () => {
    expect(describePaymentProvider("pp_paypal_paypal")?.tag).toBe(
      "pp_paypal_paypal"
    )
  })

  it("linkul de plată: sesiunea pe Netopia bate plata rămasă pe system", () => {
    const order = {
      payment_collections: [
        {
          payment_sessions: [{ provider_id: "pp_netopia_netopia" }],
          payments: [{ provider_id: "pp_system_default" }],
        },
      ],
    }
    expect(describeOrderPayment(order)?.tag).toBe("Card Netopia")
  })
})
