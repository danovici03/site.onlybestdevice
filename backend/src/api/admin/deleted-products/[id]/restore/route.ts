import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { restoreDeletedProduct } from "../../../../../lib/products/restore"

/**
 * Readuce un produs șters, cu aceleași ID-uri (vezi `lib/products/restore.ts`).
 *
 *   POST /admin/deleted-products/:id/restore
 *
 * 409 când handle-ul sau SKU-ul au fost luate între timp de alt produs activ.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const id = req.params.id

  try {
    const result = await restoreDeletedProduct(req.scope, id)

    if (!result.restored) {
      return res.status(409).json({
        message: `Nu se poate restaura: ${result.conflicts.join("; ")}.`,
        result,
      })
    }

    logger.info(
      `[restore] „${result.title}” (${id}) restaurat din Admin: ` +
        `${result.variants} variante, prețuri ${JSON.stringify(result.prices)}, ` +
        `stoc ${JSON.stringify(result.stock)}.`,
    )
    return res.json({ result })
  } catch (e) {
    const message = (e as Error).message
    logger.error(`[restore] ${id}: ${message}`)
    return res.status(400).json({ message })
  }
}
