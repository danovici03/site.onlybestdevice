import { model } from "@medusajs/framework/utils"

/**
 * O preluare: clientul a acceptat oferta online și ne trimite telefonul.
 *
 * Totul e fotografiat la trimitere (model, răspunsuri, prețuri), ca preluarea
 * să rămână lizibilă chiar dacă modelul sau prețurile se schimbă între timp.
 * `access_token` deschide pagina publică a preluării (status, ofertă
 * revizuită) — clientul n-are nevoie de cont.
 *
 * Statusurile și tranzițiile: `lib/buyback/orders.ts`.
 */
export const BUYBACK_ORDER_STATUSES = [
  "submitted",
  "received",
  "revised",
  "accepted",
  "paid",
  "declined",
  "returned",
  "canceled",
] as const

const BuybackOrder = model
  .define("buyback_order", {
    id: model.id({ prefix: "bbord" }).primaryKey(),
    display_id: model.autoincrement(),
    status: model.enum([...BUYBACK_ORDER_STATUSES]).default("submitted"),
    access_token: model.text().unique(),
    quote_hash: model.text().unique(),

    device_id: model.text(),
    device_name: model.text().searchable(),
    brand: model.text(),
    storage: model.text(),
    color: model.text().nullable(),
    answers: model.json(),
    inspection: model.json().nullable(),

    base_price: model.number(),
    quoted_price: model.number(),
    quoted_voucher_price: model.number(),
    voucher_bonus_percent: model.float().default(0),
    quote_expires_at: model.dateTime(),
    payout_method: model.enum(["bank", "voucher"]),
    revised_price: model.number().nullable(),
    revised_voucher_price: model.number().nullable(),
    /** Suma de plătit în metoda aleasă, fixată la acceptare. */
    final_amount: model.number().nullable(),

    first_name: model.text().searchable(),
    last_name: model.text().searchable(),
    email: model.text().searchable(),
    phone: model.text(),
    delivery_method: model.enum(["courier", "store"]),
    address: model.json().nullable(),
    iban: model.text().nullable(),
    iban_holder: model.text().nullable(),
    customer_note: model.text().nullable(),
    /**
     * Pentru borderoul de achiziție (cumpărare de la persoană fizică). Nu apar
     * în emailuri și nici pe pagina publică a preluării. Goale la preluările
     * dinaintea câmpurilor.
     */
    cnp: model.text().nullable(),
    id_document: model.text().nullable(),
    home_address: model.text().nullable(),

    admin_note: model.text().nullable(),
    /** Explicația pentru client la oferta revizuită sau la refuz. */
    customer_message: model.text().nullable(),
    awb: model.text().nullable(),
    voucher_code: model.text().nullable(),
    voucher_promotion_id: model.text().nullable(),

    submitted_at: model.dateTime(),
    status_changed_at: model.dateTime().nullable(),
    paid_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["status"], where: "deleted_at IS NULL" },
    { on: ["email"], where: "deleted_at IS NULL" },
  ])

export default BuybackOrder
