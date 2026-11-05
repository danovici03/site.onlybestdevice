import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { buybackService } from "../../../../lib/buyback/data"
import { isOffered, publicDevice } from "../../../../lib/buyback/public"

/** Modelele pe care le preluăm, grupate pe brand, cu „până la X lei”. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const devices = (await buybackService(req.scope).listBuybackDevices(
    { is_active: true },
    { relations: ["prices"], take: 2000, order: { rank: "DESC", model: "ASC" } },
  )) as any[]

  const brands = new Map<string, ReturnType<typeof publicDevice>[]>()
  for (const d of devices) {
    const pub = publicDevice(d)
    if (!isOffered(pub, d.is_active)) continue
    const { storages, colors, questions, ...card } = pub
    if (!brands.has(pub.brand)) brands.set(pub.brand, [])
    brands.get(pub.brand)!.push(card as any)
  }

  const ORDER = ["Apple", "Samsung", "Xiaomi", "Huawei"]
  const rank = (b: string) => (ORDER.indexOf(b) + 1 || ORDER.length + 1)
  res.json({
    brands: [...brands.entries()]
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
      .map(([brand, devices]) => ({ brand, devices })),
  })
}
