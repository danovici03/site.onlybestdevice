import { createHmac, timingSafeEqual } from "node:crypto"

import type { Answers } from "./catalog"

/**
 * Oferta „înghețată”: clientul primește un token semnat cu ce a răspuns și cât
 * i-am oferit. La trimiterea preluării (faza 3) verificăm semnătura și data,
 * nu recalculăm — dacă între timp ai schimbat prețurile, clientul primește
 * totuși suma pe care a văzut-o, cât timp oferta e valabilă.
 *
 * Fără tabel: tokenul se verifică singur. Nu conține date personale.
 */

export const QUOTE_VALID_DAYS = 7

export type QuotePayload = {
  v: 1
  price_id: string
  device_id: string
  storage: string
  color: string | null
  answers: Answers
  /** Prețul de bază la momentul ofertei — pentru recalcularea la verificare. */
  base_price: number
  price: number
  voucher_price: number
  voucher_bonus_percent: number
  iat: number
  exp: number
}

const secret = () => {
  const s = process.env.BUYBACK_QUOTE_SECRET || process.env.COOKIE_SECRET || process.env.JWT_SECRET
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("BUYBACK_QUOTE_SECRET / COOKIE_SECRET lipsește")
  }
  return s || "dev-buyback-secret"
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url")
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url")

export function signQuote(p: Omit<QuotePayload, "v" | "iat" | "exp">, now = Date.now()) {
  const payload: QuotePayload = {
    v: 1,
    ...p,
    iat: now,
    exp: now + QUOTE_VALID_DAYS * 24 * 3600 * 1000,
  }
  const data = b64(JSON.stringify(payload))
  return { token: `${data}.${sign(data)}`, expires_at: new Date(payload.exp).toISOString() }
}

/** null = token falsificat, stricat sau expirat. */
export function verifyQuote(token: string, now = Date.now()): QuotePayload | null {
  const [data, sig] = String(token ?? "").split(".")
  if (!data || !sig) return null
  const expected = Buffer.from(sign(data))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as QuotePayload
    if (p.v !== 1 || !(p.exp > now)) return null
    return p
  } catch {
    return null
  }
}
