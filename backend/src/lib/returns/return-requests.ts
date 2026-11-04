import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"

import { RETURN_REQUEST_MODULE } from "../../modules/return-request"
import type ReturnRequestModuleService from "../../modules/return-request/service"
import { orderCustomerName } from "../orders/customer-name"

export const RETURN_WINDOW_DAYS = 14

export type ReturnRequestItemInput = {
  item_id: string
  quantity: number
  reason?: string
  note?: string
}

/** Linia din cerere, cu fotografia produsului de la momentul cererii. */
export type StoredReturnItem = ReturnRequestItemInput & {
  title: string
  variant_title: string | null
  thumbnail: string | null
}

export const ORDER_RETURN_FIELDS = [
  "id",
  "display_id",
  "email",
  "status",
  "customer_id",
  "created_at",
  "updated_at",
  // `items.*`, nu `items.quantity`: cantitatea liniei de comandă stă în
  // `order_item`, iar query.graph o mapează doar la `*` — altfel e undefined.
  "items.*",
  "fulfillments.delivered_at",
  "customer.first_name",
  "customer.last_name",
  "customer.email",
  "customer.has_account",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.phone",
  "billing_address.first_name",
  "billing_address.last_name",
  "billing_address.phone",
]

export const ACTIVE_STATUSES = ["requested", "received", "refunded"]

/**
 * Cele 14 zile curg de la livrare. Dacă fulfillment-ul are `delivered_at`, de
 * acolo. Altfel de la ultima modificare a comenzii — de obicei marcarea ca
 * livrată din gestiune, care NU completează `delivered_at`. `shipped_at` nu se
 * folosește: e mai vechi decât livrarea și ar închide termenul prea devreme.
 */
export const returnWindowReference = (order: any): Date => {
  const delivered = (order.fulfillments ?? [])
    .map((f: any) => f?.delivered_at)
    .filter(Boolean)
    .map((d: string) => new Date(d).getTime())
  const ref = delivered.length
    ? Math.max(...delivered)
    : new Date(order.updated_at || order.created_at).getTime()
  return new Date(ref)
}

export const isReturnWindowOpen = (order: any) =>
  (Date.now() - returnWindowReference(order).getTime()) / 86_400_000 <=
  RETURN_WINDOW_DAYS

export const assertOrderReturnable = (order: any) => {
  if (order.status === "canceled") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Order is canceled")
  }
}

export const loadOrderForReturn = async (
  scope: MedusaContainer,
  filters: Record<string, unknown>,
) => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ORDER_RETURN_FIELDS,
    filters,
  })
  return (data?.[0] as any) ?? null
}

/**
 * Cât se mai poate cere din fiecare linie: comandat minus ce e deja în cereri
 * active (cele refuzate nu se scad, clientul poate cere din nou).
 */
export const remainingQuantities = async (
  scope: MedusaContainer,
  order: { id: string; items?: any[] },
  excludeRequestId?: string,
) => {
  const service: ReturnRequestModuleService = scope.resolve(
    RETURN_REQUEST_MODULE,
  )
  const existing = await service.listReturnRequests({
    order_id: order.id,
    status: ACTIVE_STATUSES,
  } as any)
  const requested = new Map<string, number>()
  for (const r of existing as any[]) {
    if (r.id === excludeRequestId) continue
    for (const it of (r.items ?? []) as StoredReturnItem[]) {
      requested.set(it.item_id, (requested.get(it.item_id) ?? 0) + Number(it.quantity || 0))
    }
  }
  const remaining = new Map<string, number>()
  for (const item of order.items ?? []) {
    remaining.set(
      item.id,
      Math.max(0, Number(item.quantity ?? 0) - (requested.get(item.id) ?? 0)),
    )
  }
  return remaining
}

/** Ce primește formularul pentru vizitatori: fără date personale. */
export const serializeOrderForReturn = async (
  scope: MedusaContainer,
  order: any,
) => {
  const remaining = await remainingQuantities(scope, order)
  return {
    id: order.id,
    display_id: order.display_id,
    return_window_open: isReturnWindowOpen(order),
    items: (order.items ?? []).map((i: any) => ({
      id: i.id,
      title: i.product_title || i.title,
      variant_title: i.variant_title ?? null,
      thumbnail: i.thumbnail ?? null,
      product_id: i.product_id ?? null,
      product_handle: i.product_handle ?? null,
      quantity: Number(i.quantity ?? 0),
      returnable_quantity: remaining.get(i.id) ?? 0,
      metadata: i.metadata ?? null,
    })),
  }
}

/**
 * Validează și salvează o cerere de retur, apoi emite `return.requested`
 * (emailurile către magazin și client). Folosită de ambele rute: cea din cont
 * și cea pentru vizitatori.
 */
export const createReturnRequestForOrder = async (
  scope: MedusaContainer,
  order: any,
  input: {
    items: ReturnRequestItemInput[]
    note?: string
    phone?: string
    source: "account" | "guest"
  },
) => {
  if (!input.items?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "At least one item is required",
    )
  }
  assertOrderReturnable(order)
  if (!isReturnWindowOpen(order)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Return window of ${RETURN_WINDOW_DAYS} days has expired`,
    )
  }

  const remaining = await remainingQuantities(scope, order)
  const byId = new Map((order.items ?? []).map((i: any) => [i.id, i]))
  const seen = new Set<string>()
  const items: StoredReturnItem[] = []

  for (const reqItem of input.items) {
    const orderItem: any = byId.get(reqItem.item_id)
    if (!orderItem || seen.has(reqItem.item_id)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Item ${reqItem.item_id} is not part of this order`,
      )
    }
    seen.add(reqItem.item_id)
    const qty = Number(reqItem.quantity)
    const max = remaining.get(reqItem.item_id) ?? 0
    if (!Number.isInteger(qty) || qty < 1 || qty > max) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        max === 0
          ? `Item ${reqItem.item_id} already requested for return`
          : `Invalid quantity for item ${reqItem.item_id}`,
      )
    }
    items.push({
      item_id: reqItem.item_id,
      quantity: qty,
      reason: reqItem.reason?.slice(0, 200) || undefined,
      note: reqItem.note?.slice(0, 1000) || undefined,
      title: orderItem.product_title || orderItem.title || reqItem.item_id,
      variant_title: orderItem.variant_title ?? null,
      thumbnail: orderItem.thumbnail ?? null,
    })
  }

  const service: ReturnRequestModuleService = scope.resolve(
    RETURN_REQUEST_MODULE,
  )
  const phone =
    input.phone?.trim() ||
    order.shipping_address?.phone ||
    order.billing_address?.phone ||
    null

  const request = await service.createReturnRequests({
    order_id: order.id,
    display_id: order.display_id ?? null,
    customer_id: order.customer_id ?? null,
    email: order.email,
    customer_name: orderCustomerName(order),
    phone,
    source: input.source,
    status: "requested",
    items: items as any,
    note: input.note?.trim().slice(0, 4000) || null,
    requested_at: new Date(),
  })

  const eventBus = scope.resolve(Modules.EVENT_BUS)
  await eventBus.emit({
    name: "return.requested",
    data: { order_id: order.id, request_id: request.id },
  })

  return request
}

/** Forma cererii pe care o vede clientul (fără nota internă). */
export const publicReturnRequest = (r: any) => ({
  id: r.id,
  order_id: r.order_id,
  display_id: r.display_id,
  status: r.status,
  source: r.source,
  items: r.items,
  note: r.note,
  requested_at: r.requested_at,
  status_changed_at: r.status_changed_at,
})
