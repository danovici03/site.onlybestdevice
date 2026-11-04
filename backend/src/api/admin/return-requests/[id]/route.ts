import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"

import { RETURN_REQUEST_MODULE } from "../../../../modules/return-request"
import { RETURN_REQUEST_STATUSES } from "../../../../modules/return-request/models/return-request"
import type ReturnRequestModuleService from "../../../../modules/return-request/service"
import {
  ACTIVE_STATUSES,
  loadOrderForReturn,
  remainingQuantities,
} from "../../../../lib/returns/return-requests"

const UpdateSchema = z.object({
  status: z.enum(RETURN_REQUEST_STATUSES).optional(),
  admin_note: z.string().max(4000).nullable().optional(),
  // Trimite clientului email cu noul status (doar dacă statusul s-a schimbat).
  notify_customer: z.boolean().optional(),
  // Mesaj inclus în emailul către client (ex. motivul refuzului).
  customer_message: z.string().max(2000).optional(),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service: ReturnRequestModuleService = req.scope.resolve(
    RETURN_REQUEST_MODULE,
  )
  const return_request = await service.retrieveReturnRequest(req.params.id)
  res.json({ return_request })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Date invalide", error: parsed.error.flatten() })
  }
  const { status, admin_note, notify_customer, customer_message } = parsed.data

  const service: ReturnRequestModuleService = req.scope.resolve(
    RETURN_REQUEST_MODULE,
  )
  const before = (await service.retrieveReturnRequest(req.params.id)) as any
  const statusChanged = !!status && status !== before.status

  // O cerere refuzată readusă în lucru: între timp clientul poate să fi trimis o
  // cerere nouă pentru aceleași produse, iar două cereri active ar acoperi mai
  // multe bucăți decât s-au comandat.
  if (statusChanged && before.status === "denied" && ACTIVE_STATUSES.includes(status!)) {
    const order = await loadOrderForReturn(req.scope, { id: before.order_id })
    if (order) {
      const remaining = await remainingQuantities(req.scope, order, before.id)
      const blocked = ((before.items ?? []) as any[]).filter(
        (it) => Number(it.quantity) > (remaining.get(it.item_id) ?? 0),
      )
      if (blocked.length) {
        return res.status(409).json({
          message: `Nu se poate reactiva: există deja o cerere activă pentru ${blocked
            .map((b) => b.title ?? b.item_id)
            .join(", ")}.`,
        })
      }
    }
  }

  const update: Record<string, unknown> = { id: req.params.id }
  if (statusChanged) {
    update.status = status
    update.status_changed_at = new Date()
  }
  if (admin_note !== undefined) update.admin_note = admin_note || null

  const [return_request] = (await service.updateReturnRequests([update as any])) as any[]

  let notified = false
  if (statusChanged && notify_customer && return_request.email) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    try {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "display_id", "customer_id", "shipping_address.first_name"],
        filters: { id: return_request.order_id },
      })
      const notification = req.scope.resolve(Modules.NOTIFICATION)
      await notification.createNotifications({
        to: return_request.email,
        channel: "email",
        template: "return-status-changed-customer",
        data: {
          order: orders?.[0] ?? { id: return_request.order_id },
          request: return_request,
          message: customer_message?.trim() || null,
          storefront_url: process.env.STOREFRONT_URL,
        },
      })
      notified = true
    } catch (e: any) {
      logger.error(`return request ${return_request.id}: status email failed: ${e?.message}`)
    }
  }

  res.json({ return_request, notified })
}
