"use server"

import { headers } from "next/headers"

import { sdk } from "@lib/config"
import { getCacheOptions } from "./cookies"

/**
 * Preluarea telefoanelor („Vinde telefonul”). Lista de modele e cache-uită cu
 * tagul `buyback` (golit de backend când schimbi prețuri în admin); oferta se
 * cere live, la fiecare evaluare.
 */

export type BuybackDeviceCard = {
  handle: string
  brand: string
  model: string
  image_url: string | null
  /** Cel mai mare preț de bază: telefon perfect, cea mai mare stocare. */
  max_price: number | null
}

export type BuybackDevice = BuybackDeviceCard & {
  storages: string[]
  colors: string[]
  questions: { battery: boolean; burn_in: boolean }
}

export type BuybackBrand = { brand: string; devices: BuybackDeviceCard[] }

export type BuybackAnswers = {
  network: "unlocked" | "carrier" | "foreign"
  liquid: boolean
  burn_in?: boolean
  screen: BuybackGrade
  case: BuybackGrade
  battery?: number
  display_defects: string[]
  phone_defects: string[]
}

export type BuybackGrade = "perfect" | "light" | "visible" | "worn" | "broken"

export type BuybackQuote =
  | {
      status: "offer"
      price: number
      voucher_price: number
      voucher_bonus_percent: number
      expires_at: string
      token: string
    }
  | { status: "rejected"; reasons: string[] }
  | { status: "too_low" }

/**
 * Erorile se aruncă, nu se înghit: un `[]` sau `null` returnat cât backend-ul
 * repornește ar ajunge în cache (ISR) ca listă goală / 404 până la 12 ore.
 * Aruncând, Next păstrează ultima versiune bună (la fel ca /api/mega-menu).
 */
export const listBuybackBrands = async (): Promise<BuybackBrand[]> => {
  const { brands } = await sdk.client.fetch<{ brands: BuybackBrand[] }>(
    `/store/buyback/devices`,
    { method: "GET", next: { ...(await getCacheOptions("buyback")) }, cache: "force-cache" }
  )
  return brands ?? []
}

/** `null` doar când modelul chiar nu există (404); orice altă eroare se aruncă. */
export const getBuybackDevice = async (handle: string): Promise<BuybackDevice | null> => {
  try {
    const { device } = await sdk.client.fetch<{ device: BuybackDevice }>(
      `/store/buyback/devices/${encodeURIComponent(handle)}`,
      { method: "GET", next: { ...(await getCacheOptions("buyback")) }, cache: "force-cache" }
    )
    return device ?? null
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status
    if (status === 404) return null
    throw e
  }
}

export type QuoteResult =
  | { ok: true; quote: BuybackQuote }
  | { ok: false; error: "rate_limited" | "unavailable" | "error" }

/**
 * Oferta. Trimitem IP-ul vizitatorului ca backend-ul să limiteze pe client,
 * nu pe IP-ul Vercel (vezi `backend/src/lib/buyback/rate-limit.ts`).
 */
export async function getBuybackQuote(input: {
  handle: string
  storage: string
  color: string | null
  answers: BuybackAnswers
}): Promise<QuoteResult> {
  const h = await headers()
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || ""
  try {
    const { quote } = await sdk.client.fetch<{ quote: BuybackQuote }>(`/store/buyback/quote`, {
      method: "POST",
      headers: ip ? { "x-client-ip": ip } : {},
      body: input,
      cache: "no-store",
    })
    return { ok: true, quote }
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status
    if (status === 429) return { ok: false, error: "rate_limited" }
    if (status === 404) return { ok: false, error: "unavailable" }
    return { ok: false, error: "error" }
  }
}

// ── Preluări ────────────────────────────────────────────────────────────────

export type BuybackOrderStatus =
  | "submitted"
  | "received"
  | "revised"
  | "accepted"
  | "paid"
  | "declined"
  | "returned"
  | "canceled"

export type PublicBuybackOrder = {
  display_id: number
  status: BuybackOrderStatus
  device_name: string
  storage: string
  color: string | null
  payout_method: "bank" | "voucher"
  quoted_price: number
  quoted_voucher_price: number
  voucher_bonus_percent: number
  revised_price: number | null
  revised_voucher_price: number | null
  final_amount: number | null
  amount: number
  customer_message: string | null
  delivery_method: "courier" | "store"
  awb: string | null
  voucher_code: string | null
  iban_last4: string | null
  first_name: string
  submitted_at: string
  status_changed_at: string | null
}

export type SubmitBuybackInput = {
  quote_token: string
  payout_method: "bank" | "voucher"
  first_name: string
  last_name: string
  email: string
  phone: string
  delivery_method: "courier" | "store"
  address?: { county: string; city: string; street: string; postal_code?: string } | null
  iban?: string | null
  iban_holder?: string | null
  customer_note?: string | null
  cnp: string
  id_document: string
  home_address: string
  confirm: true
}

const errorMessage = (e: any, fallback: string) => {
  const status = e?.status ?? e?.response?.status
  if (status === 429) return "Prea multe încercări. Încearcă din nou în câteva minute."
  if (status === 410) return "Oferta a expirat. Refă evaluarea ca să primești o ofertă nouă."
  const msg = String(e?.message ?? "")
  if (msg.includes("IBAN")) return "IBAN-ul nu este valid. Verifică-l încă o dată."
  if (msg.includes("CNP")) return "CNP-ul nu este valid. Verifică-l încă o dată."
  return status === 400 ? "Verifică datele completate." : fallback
}

export async function submitBuybackOrder(
  input: SubmitBuybackInput
): Promise<{ ok: true; access_token: string; order: PublicBuybackOrder } | { ok: false; message: string }> {
  const h = await headers()
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || ""
  try {
    const res = await sdk.client.fetch<{ access_token: string; order: PublicBuybackOrder }>(
      `/store/buyback/orders`,
      { method: "POST", headers: ip ? { "x-client-ip": ip } : {}, body: input, cache: "no-store" }
    )
    return { ok: true, access_token: res.access_token, order: res.order }
  } catch (e: any) {
    return { ok: false, message: errorMessage(e, "Nu am putut trimite preluarea. Încearcă din nou.") }
  }
}

export async function getBuybackOrder(token: string): Promise<PublicBuybackOrder | null> {
  try {
    const { order } = await sdk.client.fetch<{ order: PublicBuybackOrder }>(
      `/store/buyback/orders/${encodeURIComponent(token)}`,
      { method: "GET", cache: "no-store" }
    )
    return order
  } catch (e: any) {
    // Doar „nu există" devine 404. O eroare de backend (restart, 502 la
    // deploy) aruncă mai departe, spre error.tsx cu „Încearcă din nou" — altfel
    // clientul care deschide linkul din email ar afla că preluarea lui nu există.
    const status = e?.status ?? e?.response?.status
    if (status === 404) return null
    throw e
  }
}

export async function respondBuybackOrder(
  token: string,
  accept: boolean
): Promise<{ ok: true; order: PublicBuybackOrder } | { ok: false; message: string }> {
  try {
    const { order } = await sdk.client.fetch<{ order: PublicBuybackOrder }>(
      `/store/buyback/orders/${encodeURIComponent(token)}/respond`,
      { method: "POST", body: { accept }, cache: "no-store" }
    )
    return { ok: true, order }
  } catch (e: any) {
    return { ok: false, message: errorMessage(e, "Nu am putut salva răspunsul. Încearcă din nou.") }
  }
}
