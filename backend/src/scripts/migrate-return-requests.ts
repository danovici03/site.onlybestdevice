/**
 * Mută cererile de retur vechi din `order.metadata.return_requests` în tabelul
 * `return_request` (pagina „Cereri retur” din admin).
 *
 * Păstrează id-ul vechi (`rreq_…`), deci rularea repetată nu dublează nimic:
 * cererile deja mutate se sar. Nu trimite emailuri.
 *
 * Rulare:  cd backend && yarn medusa exec ./src/scripts/migrate-return-requests.ts
 *   DRY_RUN=1  doar raport, fără scriere
 *
 * Intenționat NU șterge `metadata.return_requests` de pe comenzi: orice scriere
 * pe comandă îi mută `updated_at` în prezent, iar termenul de retur cade pe
 * `updated_at` când lipsește `delivered_at` — comenzi vechi și-ar redeschide
 * fereastra de 14 zile. Cheia veche rămâne, nu mai e citită de nimeni.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { RETURN_REQUEST_MODULE } from "../modules/return-request"
import type ReturnRequestModuleService from "../modules/return-request/service"
import { ORDER_RETURN_FIELDS } from "../lib/returns/return-requests"
import { orderCustomerName } from "../lib/orders/customer-name"

const PAGE = 200
const STATUSES = new Set(["requested", "received", "refunded", "denied"])

export default async function migrateReturnRequests({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const service: ReturnRequestModuleService = container.resolve(RETURN_REQUEST_MODULE)
  const dryRun = !!process.env.DRY_RUN

  let created = 0
  let skipped = 0

  for (let skip = 0; ; skip += PAGE) {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [...ORDER_RETURN_FIELDS, "metadata"],
      pagination: { skip, take: PAGE, order: { created_at: "ASC", id: "ASC" } },
    })
    if (!orders?.length) break

    for (const order of orders as any[]) {
      const legacy = order.metadata?.return_requests
      if (!Array.isArray(legacy) || legacy.length === 0) continue

      const existing = new Set(
        (
          await service.listReturnRequests({ order_id: order.id }, { select: ["id"] })
        ).map((r: any) => r.id),
      )
      const byId = new Map((order.items ?? []).map((i: any) => [i.id, i]))

      for (const r of legacy) {
        if (!r?.id || existing.has(r.id)) {
          skipped++
          continue
        }
        const items = (r.items ?? []).map((it: any) => {
          const oi: any = byId.get(it.item_id)
          return {
            item_id: it.item_id,
            quantity: Number(it.quantity) || 1,
            reason: it.reason,
            note: it.note,
            title: oi?.product_title || oi?.title || it.item_id,
            variant_title: oi?.variant_title ?? null,
            thumbnail: oi?.thumbnail ?? null,
          }
        })
        logger.info(
          `#${order.display_id} ${r.id} (${r.status ?? "requested"}, ${items.length} produse)`,
        )
        if (!dryRun) {
          await service.createReturnRequests({
            id: r.id,
            order_id: order.id,
            display_id: order.display_id ?? null,
            customer_id: order.customer_id ?? null,
            email: order.email,
            customer_name: orderCustomerName(order),
            phone: order.shipping_address?.phone || order.billing_address?.phone || null,
            source: "account",
            status: STATUSES.has(r.status) ? r.status : "requested",
            items,
            note: r.note || null,
            requested_at: new Date(r.requested_at || order.created_at),
          } as any)
        }
        created++
      }
    }
    if (orders.length < PAGE) break
  }

  logger.info(
    `${dryRun ? "[DRY_RUN] " : ""}cereri mutate: ${created}, deja existente: ${skipped}`,
  )
}
