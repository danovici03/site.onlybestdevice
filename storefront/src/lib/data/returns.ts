"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

export type ReturnRequestItem = {
  item_id: string
  quantity: number
  reason?: string
  note?: string
  title?: string
  variant_title?: string | null
  thumbnail?: string | null
}

export type ReturnRequestStatus = "requested" | "received" | "refunded" | "denied"

export type ReturnRequest = {
  id: string
  order_id: string
  display_id: number | null
  status: ReturnRequestStatus
  source: "account" | "guest"
  items: ReturnRequestItem[]
  note?: string | null
  requested_at: string
  status_changed_at?: string | null
}

/** Comanda așa cum o vede formularul pentru vizitatori (fără date personale). */
export type ReturnableOrder = {
  id: string
  display_id: number
  return_window_open: boolean
  items: {
    id: string
    title: string
    variant_title: string | null
    thumbnail: string | null
    product_id: string | null
    product_handle: string | null
    quantity: number
    returnable_quantity: number
    metadata: Record<string, unknown> | null
  }[]
}

export type ReturnErrorCode =
  | "return_window_expired"
  | "already_requested"
  | "order_not_found"
  | "too_many_attempts"
  | "order_canceled"
  | "missing_fields"
  | "return_error"

// Mesajele backend-ului (backend/src/lib/returns) — dacă le schimbi acolo,
// actualizează și potrivirile de aici.
const errorCode = (e: any): ReturnErrorCode => {
  const msg = String(e?.message ?? "")
  if (msg.includes("window")) return "return_window_expired"
  if (msg.includes("already requested") || msg.includes("Invalid quantity"))
    return "already_requested"
  if (msg.includes("canceled")) return "order_canceled"
  if (msg.includes("are required")) return "missing_fields"
  if (msg.includes("Order not found")) return "order_not_found"
  if (msg.includes("Too many")) return "too_many_attempts"
  return "return_error"
}

// Cererea din contul clientului (comanda se verifică după customer_id).
export async function createReturnRequest(
  orderId: string,
  body: { items: ReturnRequestItem[]; note?: string },
): Promise<{ ok: boolean; message: ReturnErrorCode | null }> {
  const headers = { ...(await getAuthHeaders()) }
  try {
    await sdk.client.fetch(`/store/orders/${orderId}/return-request`, {
      method: "POST",
      headers,
      body,
    })
    return { ok: true, message: null }
  } catch (e: any) {
    return { ok: false, message: errorCode(e) }
  }
}

/** Cât se mai poate returna din fiecare linie a unei comenzi din cont. */
export async function getReturnableQuantities(
  orderId: string,
): Promise<Record<string, number> | null> {
  const headers = { ...(await getAuthHeaders()) }
  return sdk.client
    .fetch<{ order: ReturnableOrder }>(`/store/orders/${orderId}/return-request`, {
      method: "GET",
      headers,
      cache: "no-store",
    })
    .then(({ order }) =>
      Object.fromEntries(order.items.map((i) => [i.id, i.returnable_quantity])),
    )
    .catch(() => null)
}

/** Cererile de retur ale clientului logat (pagina „Retururi” din cont). */
export async function listMyReturnRequests(): Promise<ReturnRequest[]> {
  const headers = { ...(await getAuthHeaders()) }
  return sdk.client
    .fetch<{ return_requests: ReturnRequest[] }>(
      `/store/customers/me/return-requests`,
      { method: "GET", headers, cache: "no-store" },
    )
    .then((r) => r.return_requests ?? [])
    .catch(() => [])
}

/** Formularul pentru vizitatori, pasul 1: număr comandă + email → produsele. */
export async function lookupReturnableOrder(input: {
  display_id: string
  email: string
}): Promise<
  { ok: true; order: ReturnableOrder } | { ok: false; message: ReturnErrorCode }
> {
  try {
    const { order } = await sdk.client.fetch<{ order: ReturnableOrder }>(
      `/store/return-requests/lookup`,
      { method: "POST", body: input, cache: "no-store" },
    )
    return { ok: true, order }
  } catch (e: any) {
    return { ok: false, message: errorCode(e) }
  }
}

/** Formularul pentru vizitatori, pasul 2: trimite cererea. */
export async function createGuestReturnRequest(input: {
  display_id: string
  email: string
  phone?: string
  items: ReturnRequestItem[]
  note?: string
}): Promise<{ ok: boolean; message: ReturnErrorCode | null }> {
  try {
    await sdk.client.fetch(`/store/return-requests`, {
      method: "POST",
      body: input,
      cache: "no-store",
    })
    return { ok: true, message: null }
  } catch (e: any) {
    return { ok: false, message: errorCode(e) }
  }
}
