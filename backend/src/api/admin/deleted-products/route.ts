import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { listDeletedProducts } from "../../../lib/products/restore"

/**
 * Produsele șterse din Admin, pentru pagina „Produse șterse”.
 *
 *   GET /admin/deleted-products
 *
 * Fiecare vine cu `conflicts` deja calculat (handle sau SKU luate între timp de
 * un produs activ), ca pagina să poată spune dinainte de ce nu se poate
 * restaura, în loc să afle abia la apăsarea butonului.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const products = await listDeletedProducts(req.scope)
  res.json({ products, count: products.length })
}
