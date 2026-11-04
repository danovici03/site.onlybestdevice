import { model } from "@medusajs/framework/utils"

export const RETURN_REQUEST_STATUSES = [
  "requested",
  "received",
  "refunded",
  "denied",
] as const
export type ReturnRequestStatus = (typeof RETURN_REQUEST_STATUSES)[number]

/**
 * O cerere de retur trimisă de client de pe site (din cont sau din formularul
 * pentru vizitatori). E doar cererea: returul propriu-zis (stoc, rambursare)
 * se face în continuare din comanda din admin.
 *
 * `items` e o fotografie a liniilor la momentul cererii (titlu, variantă,
 * poză), ca lista din admin să nu depindă de comandă și să rămână lizibilă
 * chiar dacă produsul se schimbă sau se șterge între timp.
 */
const ReturnRequest = model
  .define("return_request", {
    id: model.id({ prefix: "rreq" }).primaryKey(),
    order_id: model.text(),
    display_id: model.number().nullable(),
    customer_id: model.text().nullable(),
    email: model.text().searchable(),
    customer_name: model.text().searchable().nullable(),
    phone: model.text().nullable(),
    // `account` = din contul clientului, `guest` = formularul public.
    source: model.enum(["account", "guest"]).default("account"),
    status: model.enum([...RETURN_REQUEST_STATUSES]).default("requested"),
    items: model.json(),
    note: model.text().nullable(),
    admin_note: model.text().nullable(),
    requested_at: model.dateTime(),
    status_changed_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["order_id"], where: "deleted_at IS NULL" },
    { on: ["customer_id"], where: "deleted_at IS NULL" },
    { on: ["status"], where: "deleted_at IS NULL" },
  ])

export default ReturnRequest
