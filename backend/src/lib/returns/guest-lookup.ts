import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest } from "@medusajs/framework/http"

import { assertOrderReturnable, loadOrderForReturn } from "./return-requests"

// Plasă contra ghicirii comenzilor (număr + email). NU pe IP: cererile vin din
// server actions ale storefront-ului, deci IP-ul e mereu al Vercel, iar
// X-Forwarded-For îl poate falsifica oricine sună backend-ul direct.
//
// Numărăm doar căutările EȘUATE, pe fiecare email și pe fiecare număr de
// comandă: cine încearcă numere la rând pentru un email se blochează pe email,
// cine încearcă emailuri pe o comandă se blochează pe comandă. Clienții care
// își scriu corect datele nu ating niciodată limita. În memorie, deci pe
// instanță — suficient pentru un singur container de backend.
const WINDOW_MS = 30 * 60_000
const MAX_FAILURES = 10
const failures = new Map<string, number[]>()

const recent = (key: string, now: number) =>
  (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS)

const assertNotBlocked = (keys: string[]) => {
  const now = Date.now()
  if (keys.some((k) => recent(k, now).length >= MAX_FAILURES)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Too many attempts, try again later",
    )
  }
}

const recordFailure = (keys: string[]) => {
  const now = Date.now()
  for (const k of keys) failures.set(k, [...recent(k, now), now])
  // Curățăm doar intrările expirate; nu golim tot (ar debloca un atacator).
  if (failures.size > 10_000) {
    for (const [k] of failures) if (!recent(k, now).length) failures.delete(k)
  }
}

const normalizeEmail = (v: unknown) =>
  typeof v === "string" ? v.trim().toLowerCase() : ""

/** Numărul comenzii, așa cum îl scrie omul: „#1234”, „ 1234 ”. */
const parseDisplayId = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""))
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Găsește comanda după număr + email (comparat fără majuscule). Același
 * răspuns „not found” dacă numărul nu există sau emailul nu se potrivește, ca
 * să nu confirmăm că o comandă există.
 */
export const findGuestOrder = async (
  req: MedusaRequest,
  body: { display_id?: unknown; email?: unknown },
) => {
  const displayId = parseDisplayId(body.display_id)
  const email = normalizeEmail(body.email)
  if (!displayId || !email) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Order number and email are required",
    )
  }
  const keys = [`e:${email}`, `o:${displayId}`]
  assertNotBlocked(keys)
  const order = await loadOrderForReturn(req.scope, { display_id: displayId })
  if (!order || normalizeEmail(order.email) !== email) {
    recordFailure(keys)
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }
  assertOrderReturnable(order)
  return order
}
