import { createHash, randomBytes } from "node:crypto"

import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createPromotionsWorkflow } from "@medusajs/medusa/core-flows"

import type { BUYBACK_ORDER_STATUSES } from "../../modules/buyback/models/buyback-order"
import type { Answers } from "./catalog"
import { buybackService, loadRules } from "./data"
import { formatIban } from "./iban"
import { computeQuote, resolveRule, voucherAmount } from "./pricing"

export type BuybackOrderStatus = (typeof BUYBACK_ORDER_STATUSES)[number]

/**
 * Drumul unei preluări:
 *
 *   submitted ─→ received ─┬→ accepted ─→ paid
 *       │                  ├→ revised ─┬→ accepted ─→ paid
 *       └→ canceled        │           └→ declined ─→ returned
 *                          └→ declined ─→ returned   (iCloud activ, IMEI furat…)
 *
 * `revised` → `revised` e permis: poți corecta oferta revizuită înainte de
 * răspunsul clientului.
 */
export const ADMIN_TRANSITIONS: Record<BuybackOrderStatus, BuybackOrderStatus[]> = {
  submitted: ["received", "canceled"],
  received: ["accepted", "revised", "declined"],
  revised: ["revised", "accepted", "declined"],
  accepted: ["paid"],
  declined: ["returned"],
  paid: [],
  returned: [],
  canceled: [],
}

export const STATUS_LABEL: Record<BuybackOrderStatus, string> = {
  submitted: "Trimisă — așteptăm telefonul",
  received: "Telefon primit — în verificare",
  revised: "Ofertă revizuită — așteaptă răspunsul clientului",
  accepted: "Acceptată — de plătit",
  paid: "Plătită",
  declined: "Refuzată — telefonul se returnează",
  returned: "Telefon returnat clientului",
  canceled: "Anulată",
}

/** Voucherul expiră după atâtea luni de la emitere. */
export const VOUCHER_VALID_MONTHS = 12

export const newAccessToken = () => randomBytes(24).toString("base64url")
export const quoteHash = (token: string) => createHash("sha256").update(token).digest("hex")

/** Ce sumă primește clientul, în metoda aleasă, după ultima ofertă. */
export function currentAmount(o: any): number {
  if (o.payout_method === "voucher") return o.revised_voucher_price ?? o.quoted_voucher_price
  return o.revised_price ?? o.quoted_price
}

/**
 * Oferta revizuită după verificare: aceeași bază ca la ofertă (prețul din
 * momentul ofertei, nu cel de azi), cu răspunsurile tehnicianului. Bonusul de
 * voucher rămâne cel promis clientului.
 */
export async function reviseFromInspection(
  scope: { resolve: (k: string) => any },
  order: any,
  inspection: Answers,
) {
  const rules = await loadRules(scope)
  const device = { id: order.device_id, brand: order.brand }
  const quote = computeQuote({ device, basePrice: order.base_price, answers: inspection, rules })
  const voucherOf = await voucherCalculator(scope, order, rules)
  return {
    quote,
    revised_price: quote.status === "offer" ? quote.price : null,
    revised_voucher_price: quote.status === "offer" ? voucherOf(quote.price) : null,
    voucherOf,
  }
}

/**
 * Voucherul pentru o sumă prin transfer, cu bonusul promis clientului și
 * rotunjirea din reguli. Același calcul pentru oferta revizuită din verificare
 * și pentru suma scrisă manual în admin.
 */
export async function voucherCalculator(
  scope: { resolve: (k: string) => any },
  order: any,
  rules?: Awaited<ReturnType<typeof loadRules>>,
) {
  const all = rules ?? (await loadRules(scope))
  const step = Math.max(1, resolveRule(all, "setting.rounding", { id: order.device_id, brand: order.brand }).value)
  const bonus = Number(order.voucher_bonus_percent)
  return (price: number) => voucherAmount(price, bonus, step)
}

/**
 * Rulează `fn` cu preluarea blocată, ca două cereri simultane (dublu-click pe
 * „Plătită”) să nu emită două vouchere. Fără modulul de locking (teste),
 * cade pe o coadă în memorie.
 */
const localLocks = new Map<string, Promise<unknown>>()
export async function withOrderLock<T>(
  scope: { resolve: (k: string) => any },
  orderId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = `buyback-order:${orderId}`
  let locking: any = null
  try {
    locking = scope.resolve(Modules.LOCKING)
  } catch {}
  if (locking) return locking.execute(key, fn, { timeout: 30 })
  const prev = localLocks.get(key) ?? Promise.resolve()
  const run = prev.catch(() => {}).then(fn)
  localLocks.set(key, run)
  try {
    return await run
  } finally {
    if (localLocks.get(key) === run) localLocks.delete(key)
  }
}

/** Șterge un voucher emis, dacă salvarea preluării a eșuat după emitere. */
export async function revokeVoucher(scope: { resolve: (k: string) => any }, promotionId: string) {
  try {
    await scope.resolve(Modules.PROMOTION).deletePromotions([promotionId])
  } catch (e: any) {
    scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`buyback: voucherul ${promotionId} a rămas activ după o salvare eșuată: ${e.message}`)
  }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const voucherCode = () => {
  const bytes = randomBytes(8)
  return `PRELUARE-${[...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("")}`
}

/**
 * Voucherul clientului: cod promoțional Medusa cu reducere fixă pe comandă,
 * folosibil o singură dată, valabil 12 luni (prin campania proprie).
 */
export async function issueVoucher(scope: { resolve: (k: string) => any }, order: any) {
  const amount = Number(order.final_amount)
  if (!(amount > 0)) throw new Error("Preluarea nu are sumă finală")
  const code = voucherCode()
  const now = new Date()
  const ends = new Date(now)
  ends.setMonth(ends.getMonth() + VOUCHER_VALID_MONTHS)

  const { result } = await createPromotionsWorkflow(scope as any).run({
    input: {
      promotionsData: [
        {
          code,
          type: "standard",
          status: "active",
          is_automatic: false,
          limit: 1,
          application_method: {
            type: "fixed",
            target_type: "order",
            allocation: "across",
            value: amount,
            currency_code: "ron",
          },
          campaign: {
            name: `Voucher preluare #${order.display_id} — ${order.first_name} ${order.last_name}`,
            campaign_identifier: code,
            starts_at: now,
            ends_at: ends,
          },
        } as any,
      ],
    },
  })
  return { code, promotion_id: (result as any[])[0]?.id as string, expires_at: ends.toISOString() }
}

export async function emitBuybackEvent(
  scope: { resolve: (k: string) => any },
  name: "buyback.submitted" | "buyback.status_changed",
  /** `by: "customer"` = răspunsul clientului la oferta revizuită (anunțăm și magazinul). */
  data: { id: string; by?: "admin" | "customer" },
) {
  const eventBus = scope.resolve(Modules.EVENT_BUS)
  try {
    await eventBus.emit({ name, data })
  } catch (e: any) {
    scope.resolve(ContainerRegistrationKeys.LOGGER).warn(`buyback: ${name} nu s-a emis: ${e.message}`)
  }
}

/** Ce vede clientul pe pagina preluării. Fără IBAN complet, fără note interne. */
export function publicOrder(o: any) {
  return {
    display_id: o.display_id,
    status: o.status,
    device_name: o.device_name,
    storage: o.storage,
    color: o.color,
    payout_method: o.payout_method,
    quoted_price: o.quoted_price,
    quoted_voucher_price: o.quoted_voucher_price,
    voucher_bonus_percent: o.voucher_bonus_percent,
    revised_price: o.revised_price,
    revised_voucher_price: o.revised_voucher_price,
    final_amount: o.final_amount,
    amount: currentAmount(o),
    customer_message: o.customer_message,
    delivery_method: o.delivery_method,
    awb: o.awb,
    voucher_code: o.status === "paid" ? o.voucher_code : null,
    iban_last4: o.iban ? formatIban(o.iban).slice(-4) : null,
    first_name: o.first_name,
    submitted_at: o.submitted_at,
    status_changed_at: o.status_changed_at,
  }
}

export { buybackService }
