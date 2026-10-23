import {
  canSendPaymentLink,
  deriveOrderStatus,
  effectiveOrderStatus,
  orderStateSnapshot,
} from "../order-status"

const session = (provider: string) => ({
  payment_sessions: [{ provider_id: provider }],
  payments: [],
})

const order = (overrides: Record<string, any> = {}) => ({
  id: "order_1",
  status: "pending",
  canceled_at: null,
  payment_status: "not_paid",
  fulfillment_status: "not_fulfilled",
  metadata: {},
  payment_collections: [session("pp_netopia_netopia")],
  ...overrides,
})

describe("deriveOrderStatus", () => {
  it("anularea bate orice altceva", () => {
    expect(
      deriveOrderStatus(
        order({
          status: "canceled",
          payment_status: "captured",
          fulfillment_status: "delivered",
        })
      )
    ).toBe("canceled")
    expect(deriveOrderStatus(order({ canceled_at: "2026-08-01" }))).toBe(
      "canceled"
    )
  })

  it("marfa plecată înseamnă finalizată", () => {
    for (const fulfillment_status of ["fulfilled", "shipped", "delivered"]) {
      expect(deriveOrderStatus(order({ fulfillment_status }))).toBe("completed")
    }
  })

  it("stările parțiale de livrare nu finalizează", () => {
    for (const fulfillment_status of [
      "not_fulfilled",
      "partially_fulfilled",
      "partially_shipped",
    ]) {
      expect(deriveOrderStatus(order({ fulfillment_status }))).not.toBe(
        "completed"
      )
    }
  })

  it("eroarea Netopia da status de plata esuata cat timp nu s-a incasat", () => {
    const failed = order({ metadata: { netopia: { status: "error" } } })
    expect(deriveOrderStatus(failed)).toBe("payment_failed")
  })

  it("dar nu și după ce banii au intrat", () => {
    const paidAfterRetry = order({
      metadata: { netopia: { status: "error" } },
      payment_status: "captured",
    })
    expect(deriveOrderStatus(paidAfterRetry)).toBe("processing")
  })

  it("viramentul neîncasat e status propriu", () => {
    const transfer = order({
      payment_collections: [session("pp_system_default")],
    })
    expect(deriveOrderStatus(transfer)).toBe("awaiting_bank_transfer")
    expect(
      deriveOrderStatus({ ...transfer, payment_status: "captured" })
    ).toBe("processing")
  })

  // Medusa pune `authorized` la cart.complete, înainte să intre vreun ban —
  // așa arată ORICE comandă abia plasată, nu doar cele din testele de mai sus.
  it("cardul autorizat dar neîncasat e în așteptare, nu în procesare", () => {
    const card = order({ payment_status: "authorized" })
    expect(deriveOrderStatus(card)).toBe("pending")
    expect(
      deriveOrderStatus({
        ...card,
        metadata: { netopia: { status: "error" } },
      })
    ).toBe("payment_failed")
    expect(
      deriveOrderStatus({
        ...card,
        metadata: { netopia: { status: "confirmed" } },
      })
    ).toBe("processing")
    expect(deriveOrderStatus({ ...card, payment_status: "captured" })).toBe(
      "processing"
    )
  })

  it("viramentul autorizat dar neîncasat așteaptă viramentul", () => {
    const transfer = order({
      payment_collections: [session("pp_system_default")],
      payment_status: "authorized",
    })
    expect(deriveOrderStatus(transfer)).toBe("awaiting_bank_transfer")
  })

  it("ratele neaprobate sunt în așteptare, nu în procesare", () => {
    const tbi = order({
      payment_collections: [session("pp_tbi_tbi")],
      payment_status: "authorized",
    })
    expect(deriveOrderStatus(tbi)).toBe("pending")
    expect(deriveOrderStatus({ ...tbi, payment_status: "captured" })).toBe(
      "processing"
    )
  })

  it("rambursul autorizat e in procesare, nu in asteptare", () => {
    const cod = order({
      payment_collections: [session("pp_cod_cod")],
      payment_status: "authorized",
    })
    expect(deriveOrderStatus(cod)).toBe("processing")
  })
})

describe("eticheta manuală", () => {
  const withManual = (base: any, code: string) => ({
    ...base,
    metadata: {
      ...base.metadata,
      order_status: {
        code,
        note: "așteptăm stocul",
        at: "2026-08-27T10:00:00.000Z",
        by: "user_1",
        snapshot: orderStateSnapshot(base),
      },
    },
  })

  it("bate statusul derivat cât timp comanda nu s-a mișcat", () => {
    const o = withManual(order({ payment_status: "captured" }), "pending")
    const status = effectiveOrderStatus(o)
    expect(status.code).toBe("pending")
    expect(status.manual).toBe(true)
    expect(status.note).toBe("așteptăm stocul")
    // Derivarea rămâne vizibilă, ca adminul să arate ambele.
    expect(status.derived).toBe("processing")
  })

  it("expiră când comanda avansează", () => {
    const base = order({ payment_status: "captured" })
    const shipped = {
      ...withManual(base, "pending"),
      fulfillment_status: "shipped",
    }
    const status = effectiveOrderStatus(shipped)
    expect(status.code).toBe("completed")
    expect(status.manual).toBe(false)
    expect(status.note).toBeNull()
  })

  it("un cod necunoscut e ignorat", () => {
    const o = {
      ...order(),
      metadata: { order_status: { code: "inventat", snapshot: {} } },
    }
    expect(effectiveOrderStatus(o).manual).toBe(false)
  })
})

describe("canSendPaymentLink", () => {
  it("da pentru card eșuat și pentru virament neîncasat", () => {
    expect(
      canSendPaymentLink(order({ metadata: { netopia: { status: "error" } } }))
    ).toBe(true)
    expect(
      canSendPaymentLink(
        order({ payment_collections: [session("pp_system_default")] })
      )
    ).toBe(true)
  })

  it("nu pentru ramburs — curierul încasează, ar fi plată dublă", () => {
    expect(
      canSendPaymentLink(order({ payment_collections: [session("pp_cod_cod")] }))
    ).toBe(false)
  })

  it("nu pentru rate — dosarul se închide la partener", () => {
    for (const p of ["pp_tbi_tbi", "pp_unicredit_unicredit"]) {
      expect(
        canSendPaymentLink(order({ payment_collections: [session(p)] }))
      ).toBe(false)
    }
  })

  it("da pentru comanda abia plasată — `authorized` nu înseamnă bani luați", () => {
    // Providerii răspund `authorized` la cart.complete, înainte de bancă.
    expect(canSendPaymentLink(order({ payment_status: "authorized" }))).toBe(
      true
    )
    expect(
      canSendPaymentLink(
        order({
          payment_status: "authorized",
          metadata: { netopia: { status: "error" } },
        })
      )
    ).toBe(true)
  })

  it("nu după confirmarea IPN, chiar dacă plata nu e încă capturată", () => {
    expect(
      canSendPaymentLink(
        order({
          payment_status: "authorized",
          metadata: { netopia: { status: "confirmed" } },
        })
      )
    ).toBe(false)
  })

  it("nu cât timp plata e în curs la Netopia — ar fi plată dublă", () => {
    for (const status of ["paid_pending", "fraud", "credit"]) {
      expect(
        canSendPaymentLink(
          order({ payment_status: "authorized", metadata: { netopia: { status } } })
        )
      ).toBe(false)
    }
  })

  it("nu pentru comenzi rambursate integral", () => {
    expect(canSendPaymentLink(order({ payment_status: "refunded" }))).toBe(false)
  })

  it("nu pentru comenzi încasate, anulate sau livrate", () => {
    expect(canSendPaymentLink(order({ payment_status: "captured" }))).toBe(false)
    expect(canSendPaymentLink(order({ status: "canceled" }))).toBe(false)
    expect(canSendPaymentLink(order({ fulfillment_status: "shipped" }))).toBe(
      false
    )
  })
})
