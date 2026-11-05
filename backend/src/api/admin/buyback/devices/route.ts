import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { buybackService, loadSalePrices, revalidateBuyback, sortPrices } from "../../../../lib/buyback/data"
import { normalizeStorage } from "../../../../lib/buyback/schema"
import { slugify } from "../../../../lib/phone-group"

/**
 * Lista modelelor preluate, cu prețurile pe stocări și — unde modelul e legat
 * de catalog — prețul nostru de vânzare pentru aceeași stocare. Fără paginare:
 * sunt câteva sute de modele, iar tabelul de prețuri se editează pe toate.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = buybackService(req.scope)
  const devices = (await service.listBuybackDevices(
    {},
    { relations: ["prices"], take: 2000, order: { brand: "ASC", rank: "DESC", model: "ASC" } },
  )) as any[]

  const groups = new Set(devices.map((d) => d.phone_group).filter(Boolean) as string[])
  const sale = await loadSalePrices(req.scope, groups)

  res.json({
    devices: devices.map((d) => ({
      ...d,
      prices: sortPrices(d.prices ?? []).map((p: any) => ({
        id: p.id,
        storage: p.storage,
        base_price: p.base_price,
        sale_price: d.phone_group ? (sale.get(`${d.phone_group}|${p.storage}`) ?? null) : null,
      })),
    })),
  })
}

const CreateSchema = z.object({
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(120),
  storages: z.array(z.string()).min(1).max(10),
  phone_group: z.string().trim().max(200).nullable().optional(),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Date invalide", error: parsed.error.flatten() })
  }
  const { brand, model, phone_group } = parsed.data
  const storages = [...new Set(parsed.data.storages.map(normalizeStorage))]
  if (storages.some((s) => !s)) {
    return res.status(400).json({ message: "Stocare invalidă — scrie ca „128GB” sau „1TB”" })
  }

  const service = buybackService(req.scope)
  const handle = slugify(`${brand} ${model}`.replace(/\+/g, " plus "))
  const [existing] = await service.listBuybackDevices({ handle }, { take: 1 })
  if (existing) {
    return res.status(409).json({ message: `Modelul există deja: ${existing.brand} ${existing.model}` })
  }

  const device = await service.createBuybackDevices({
    brand,
    model,
    handle,
    phone_group: phone_group || handle,
  })
  await service.createBuybackPrices(
    storages.map((storage) => ({ storage: storage!, base_price: null, device_id: device.id })),
  )
  revalidateBuyback(req.scope, "buyback.device.created")
  res.status(201).json({ device })
}
