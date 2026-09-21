import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { syncWarrantyLines } from "../../../../../../lib/warranty-cart"

/**
 * Realiniază garanțiile extinse din coș cu produsele acoperite (cantitate,
 * produs scos, garanție dublă). Storefront-ul o cheamă după fiecare schimbare
 * de cantitate sau ștergere și la finalizare, înainte de sesiunea de plată —
 * vezi `syncWarrantyLines`. `changed` spune dacă totalul coșului s-a mișcat.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const changed = await syncWarrantyLines(req.scope, req.params.id)
  res.status(200).json({ changed })
}
