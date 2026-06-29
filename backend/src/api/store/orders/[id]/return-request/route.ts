import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

const RETURN_WINDOW_DAYS = 14

type ReturnRequestItem = {
  item_id: string
  quantity: number
  reason?: string
  note?: string
}

type ReturnRequestBody = {
  items: ReturnRequestItem[]
  note?: string
}

type StoredReturnRequest = {
  id: string
  requested_at: string
  status: "requested" | "received" | "refunded" | "denied"
  items: ReturnRequestItem[]
  note?: string
}

// Customer-initiated return REQUEST. Records the request on the order metadata
// and emits `return.requested` for the admin email subscriber. The admin then
// processes the actual Medusa return via the admin UI (where return shipping
// options, locations, and refunds are properly arranged).
export const POST = async (
  req: AuthenticatedMedusaRequest<ReturnRequestBody>,
  res: MedusaResponse,
) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Unauthorized")
  }

  const orderId = req.params.id
  const body = req.body as ReturnRequestBody
  if (!body?.items?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "At least one item is required",
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "customer_id",
      "email",
      "created_at",
      "updated_at",
      "fulfillment_status",
      "metadata",
      "items.id",
      "items.quantity",
      "items.product_title",
      "items.variant_title",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order || order.customer_id !== customerId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  // 14-day return window starts from delivery (or shipment if no delivery date)
  const ref =
    (order as any).delivered_at ||
    (order as any).shipped_at ||
    order.updated_at ||
    order.created_at
  const daysSince = (Date.now() - new Date(ref).getTime()) / 86_400_000
  if (daysSince > RETURN_WINDOW_DAYS) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Return window of ${RETURN_WINDOW_DAYS} days has expired`,
    )
  }

  // Validate each item belongs to the order and quantities are within bounds
  const orderItemMap = new Map(
    (order.items ?? []).map((i: any) => [i.id, i.quantity]),
  )
  for (const reqItem of body.items) {
    const orderedQty = orderItemMap.get(reqItem.item_id)
    if (orderedQty === undefined) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Item ${reqItem.item_id} is not part of this order`,
      )
    }
    if (reqItem.quantity < 1 || reqItem.quantity > Number(orderedQty)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Invalid quantity for item ${reqItem.item_id}`,
      )
    }
  }

  const newRequest: StoredReturnRequest = {
    id: `rreq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    requested_at: new Date().toISOString(),
    status: "requested",
    items: body.items,
    note: body.note,
  }

  const existingMeta = (order.metadata ?? {}) as Record<string, unknown>
  const existingRequests = Array.isArray(existingMeta.return_requests)
    ? (existingMeta.return_requests as StoredReturnRequest[])
    : []

  const orderModule = req.scope.resolve(Modules.ORDER)
  await orderModule.updateOrders(orderId, {
    metadata: {
      ...existingMeta,
      return_requests: [...existingRequests, newRequest],
    },
  })

  const eventBus = req.scope.resolve(Modules.EVENT_BUS)
  await eventBus.emit({
    name: "return.requested",
    data: {
      order_id: orderId,
      request_id: newRequest.id,
    },
  })

  res.status(201).json({ return_request: newRequest })
}
