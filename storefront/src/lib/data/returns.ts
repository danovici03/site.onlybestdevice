"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

export type ReturnRequestItem = {
  item_id: string
  quantity: number
  reason?: string
  note?: string
}

export type ReturnRequest = {
  id: string
  requested_at: string
  status: "requested" | "received" | "refunded" | "denied"
  items: ReturnRequestItem[]
  note?: string
}

// Customer-initiated return request — handled by our custom backend route
// that records the request on order.metadata.return_requests and emits an event.
export async function createReturnRequest(
  orderId: string,
  body: { items: ReturnRequestItem[]; note?: string },
): Promise<{ ok: boolean; message: string | null }> {
  const headers = { ...(await getAuthHeaders()) }
  try {
    await sdk.client.fetch(`/store/orders/${orderId}/return-request`, {
      method: "POST",
      headers,
      body,
    })
    return { ok: true, message: null }
  } catch (e: any) {
    const msg =
      e?.message?.includes("window")
        ? "return_window_expired"
        : e?.message ?? "return_error"
    return { ok: false, message: msg }
  }
}
