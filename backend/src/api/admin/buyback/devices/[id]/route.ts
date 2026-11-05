import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { buybackService, revalidateBuyback } from "../../../../../lib/buyback/data"
import { normalizeStorage } from "../../../../../lib/buyback/schema"

const UpdateSchema = z.object({
  brand: z.string().trim().min(1).max(60).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  is_active: z.boolean().optional(),
  rank: z.number().int().min(-1000).max(1000).optional(),
  phone_group: z.string().trim().max(200).nullable().optional(),
  image_url: z.string().url().max(1000).nullable().optional(),
  /** Stocări noi, adăugate fără preț. */
  add_storages: z.array(z.string()).max(10).optional(),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Date invalide", error: parsed.error.flatten() })
  }
  const { add_storages, ...fields } = parsed.data
  const service = buybackService(req.scope)
  const device = (await service.retrieveBuybackDevice(req.params.id, {
    relations: ["prices"],
  })) as any

  if (Object.keys(fields).length) {
    await service.updateBuybackDevices({ id: device.id, ...fields })
  }

  if (add_storages?.length) {
    const have = new Set((device.prices ?? []).map((p: any) => p.storage))
    const add = [...new Set(add_storages.map(normalizeStorage))]
    if (add.some((s) => !s)) {
      return res.status(400).json({ message: "Stocare invalidă — scrie ca „128GB” sau „1TB”" })
    }
    const fresh = (add as string[]).filter((s) => !have.has(s))
    if (fresh.length) {
      await service.createBuybackPrices(
        fresh.map((storage) => ({ storage, base_price: null, device_id: device.id })),
      )
    }
  }

  revalidateBuyback(req.scope, "buyback.device.updated")
  res.json({ device: await service.retrieveBuybackDevice(device.id, { relations: ["prices"] }) })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await buybackService(req.scope).deleteBuybackDevices(req.params.id)
  revalidateBuyback(req.scope, "buyback.device.deleted")
  res.json({ id: req.params.id, deleted: true })
}
