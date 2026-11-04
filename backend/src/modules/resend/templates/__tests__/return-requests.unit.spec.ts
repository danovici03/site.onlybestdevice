import { renderTemplate } from "../index"

const order = { id: "order_1", display_id: 42, email: "ana@ex.ro", customer_id: null, items: [], shipping_address: { first_name: "Ana" } }
const request = {
  id: "rreq_1",
  source: "guest",
  status: "requested",
  email: "ana@ex.ro",
  customer_name: "Ana Pop",
  phone: "0722000000",
  requested_at: "2026-11-04T10:00:00Z",
  items: [{ item_id: "i1", quantity: 1, title: "iPhone 17 <b>", reason: "Produs defect" }],
  note: "Nu pornește",
}

describe("emailuri retur", () => {
  it("admin: nume, telefon, sursă și titlul din cerere (escapat)", () => {
    const { html, subject } = renderTemplate("return-requested-admin", { order, request, admin_url: "https://api.x" })!
    expect(subject).toContain("#42")
    expect(html).toContain("Ana Pop")
    expect(html).toContain("0722000000")
    expect(html).toContain("fără cont")
    expect(html).toContain("iPhone 17 &lt;b&gt;")
    expect(html).toContain("https://api.x/app/return-requests")
  })

  it("client vizitator: linkul duce la /retur, nu în cont", () => {
    const { html } = renderTemplate("return-requested-customer", { order, request, storefront_url: "https://s.ro" })!
    expect(html).toContain("https://s.ro/ro/retur")
    expect(html).not.toContain("/account/")
  })

  it("client cu cont: linkul duce la retururile din cont", () => {
    const { html } = renderTemplate("return-requested-customer", {
      order: { ...order, customer_id: "cus_1" },
      request: { ...request, source: "account" },
      storefront_url: "https://s.ro",
    })!
    expect(html).toContain("https://s.ro/ro/account/returns")
  })

  it("schimbare status: eticheta și mesajul magazinului", () => {
    const { html, subject } = renderTemplate("return-status-changed-customer", {
      order,
      request: { ...request, status: "denied", display_id: 42 },
      message: "Produsul a fost activat",
      storefront_url: "https://s.ro",
    })!
    expect(subject).toContain("Refuzată")
    expect(html).toContain("Produsul a fost activat")
  })
})
