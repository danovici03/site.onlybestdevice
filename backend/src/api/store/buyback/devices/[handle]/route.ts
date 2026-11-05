import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { buybackService } from "../../../../../lib/buyback/data"
import { isOffered, publicDevice } from "../../../../../lib/buyback/public"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const [d] = (await buybackService(req.scope).listBuybackDevices(
    { handle: req.params.handle },
    { relations: ["prices"], take: 1 },
  )) as any[]
  const pub = d ? publicDevice(d) : null
  if (!d || !pub || !isOffered(pub, d.is_active)) {
    return res.status(404).json({ message: "Model negăsit" })
  }
  res.json({ device: pub })
}
