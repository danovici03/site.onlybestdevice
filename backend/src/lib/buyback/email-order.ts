import { needsIdentity } from "./identity"

/**
 * Doar câmpurile pe care le folosesc șabloanele. `data` se salvează în tabelul
 * de notificări al Medusei și pleacă la provider (Resend), deci CNP-ul, actul
 * de identitate, adresa de domiciliu și IBAN-ul complet nu au ce căuta aici —
 * din IBAN trimitem doar ultimele 4 cifre, cât apare în email.
 */
export const EMAIL_FIELDS = [
  "id",
  "display_id",
  "status",
  "access_token",
  "device_name",
  "storage",
  "color",
  "payout_method",
  "quoted_price",
  "quoted_voucher_price",
  "revised_price",
  "revised_voucher_price",
  "final_amount",
  "voucher_code",
  "awb",
  "first_name",
  "last_name",
  "email",
  "phone",
  "delivery_method",
  "address",
  "customer_note",
  "customer_message",
] as const

export const toEmailOrder = (order: any) => {
  const out: Record<string, unknown> = {}
  for (const key of EMAIL_FIELDS) out[key] = order[key] ?? null
  out.iban_last4 = order.iban ? String(order.iban).slice(-4) : null
  // Doar faptul că lipsesc datele pentru act, nu datele în sine.
  out.identity_required = needsIdentity(order)
  return out
}
