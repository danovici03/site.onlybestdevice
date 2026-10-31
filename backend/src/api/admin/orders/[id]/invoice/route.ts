import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"

import { revalidateStorefront } from "../../../../../lib/storefront-revalidate"

/**
 * Factura fiscală atașată comenzii, în `metadata`. Storefront-ul citește
 * `invoice_url` (vezi `storefront/src/lib/util/invoice.ts`) și arată butonul
 * „Descarcă factura” doar când cheia există.
 */
const INVOICE_KEYS = {
  url: "invoice_url",
  fileName: "invoice_file_name",
  attachedAt: "invoice_attached_at",
} as const

const BodySchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//.test(u), "URL-ul trebuie să fie http(s)."),
  file_name: z.string().max(255).optional(),
})

/**
 * Pagina comenzii și lista din cont stau în cache sub tagul `orders` (12 ore),
 * deci fără invalidare clientul ar vedea factura abia a doua zi.
 */
const revalidateOrders = (req: MedusaRequest, event: string) =>
  revalidateStorefront(
    req.scope.resolve(ContainerRegistrationKeys.LOGGER),
    event,
    ["orders"]
  )

const loadOrder = async (req: MedusaRequest) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { id: req.params.id },
  })
  return data?.[0] ?? null
}

/**
 * Atașează (sau înlocuiește) factura unei comenzi.
 *
 *   POST /admin/orders/:id/invoice
 *   { "url": "https://…/factura-1234.pdf", "file_name": "factura-1234.pdf" }
 *
 * Fișierul se urcă înainte, prin `POST /admin/uploads`; aici salvăm doar linkul.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = BodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message })
  }

  const order = await loadOrder(req)
  if (!order) {
    return res.status(404).json({ message: "Comanda nu există." })
  }

  const attachedAt = new Date().toISOString()
  await req.scope.resolve(Modules.ORDER).updateOrders(order.id, {
    metadata: {
      ...((order.metadata ?? {}) as Record<string, unknown>),
      [INVOICE_KEYS.url]: parsed.data.url,
      [INVOICE_KEYS.fileName]: parsed.data.file_name ?? null,
      [INVOICE_KEYS.attachedAt]: attachedAt,
    },
  })

  const revalidated = await revalidateOrders(req, "order.invoice.attached")
  req.scope
    .resolve(ContainerRegistrationKeys.LOGGER)
    .info(`[invoice] Factură atașată la comanda #${order.display_id}.`)

  return res.json({
    invoice: {
      url: parsed.data.url,
      file_name: parsed.data.file_name ?? null,
      attached_at: attachedAt,
    },
    revalidated,
  })
}

/**
 * Scoate factura de pe comandă (fișierul rămâne în storage).
 *
 *   DELETE /admin/orders/:id/invoice
 *
 * Cheile se pun pe `null`, nu se omit: dacă modulul ar face merge pe
 * `metadata`, o cheie lipsă ar rămâne cu valoarea veche.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const order = await loadOrder(req)
  if (!order) {
    return res.status(404).json({ message: "Comanda nu există." })
  }

  await req.scope.resolve(Modules.ORDER).updateOrders(order.id, {
    metadata: {
      ...((order.metadata ?? {}) as Record<string, unknown>),
      [INVOICE_KEYS.url]: null,
      [INVOICE_KEYS.fileName]: null,
      [INVOICE_KEYS.attachedAt]: null,
    },
  })

  const revalidated = await revalidateOrders(req, "order.invoice.removed")
  return res.json({ invoice: null, revalidated })
}
