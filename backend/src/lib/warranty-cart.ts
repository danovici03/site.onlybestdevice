import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteLineItemsWorkflow,
  updateLineItemInCartWorkflow,
} from "@medusajs/medusa/core-flows"

import { WARRANTY_HANDLE } from "./warranty-prices"

/** Cheia din metadata liniei de garanție; aliniată cu storefront-ul. */
const WARRANTY_FOR = "warranty_for"

type CartLine = {
  id: string
  product_id: string | null
  product_handle: string | null
  quantity: number
  metadata: Record<string, unknown> | null
  created_at: string | Date
}

/**
 * Ține fiecare garanție extinsă aliniată cu produsul pe care îl acoperă.
 *
 * Garanția se vinde pe bucată: două telefoane = două garanții. Cantitatea ei
 * nu e deci o alegere a clientului, ci o consecință — egală cu câte bucăți din
 * produsul acoperit sunt în coș. Regulile:
 *
 * - cantitatea garanției = suma cantităților liniilor produsului acoperit;
 * - produsul a ieșit din coș → garanția iese și ea;
 * - o singură garanție per produs: dacă cineva adaugă „+2 ani" peste „+1 an",
 *   rămâne ultima aleasă.
 *
 * Garanțiile vechi, fără `warranty_for`, nu se ating — n-avem cum să știm ce
 * acoperă (vezi `warrantyCoverage` din storefront).
 *
 * Se cheamă după orice schimbare a coșului care poate strica alinierea: la
 * adăugarea garanției, la schimbarea cantității, la ștergere și înainte de
 * crearea sesiunii de plată la finalizare.
 *
 * Întoarce `true` dacă a modificat coșul — atunci totalul s-a schimbat, iar
 * checkout-ul nu trebuie să plaseze comanda fără ca clientul să-l vadă.
 */
export const syncWarrantyLines = async (
  scope: any,
  cartId: string
): Promise<boolean> => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "items.id",
      "items.product_id",
      "items.product_handle",
      "items.quantity",
      "items.metadata",
      "items.created_at",
    ],
    filters: { id: cartId },
  })

  const items: CartLine[] = ((carts as any[])[0]?.items ?? []).filter(Boolean)
  const isWarranty = (i: CartLine) => i.product_handle === WARRANTY_HANDLE

  const quantityByProduct = new Map<string, number>()
  for (const item of items) {
    if (isWarranty(item) || !item.product_id) continue
    quantityByProduct.set(
      item.product_id,
      (quantityByProduct.get(item.product_id) ?? 0) + Number(item.quantity)
    )
  }

  // Cea mai nouă garanție a fiecărui produs câștigă.
  const linked = items
    .filter(
      (i) =>
        isWarranty(i) &&
        typeof i.metadata?.[WARRANTY_FOR] === "string" &&
        i.metadata[WARRANTY_FOR] !== ""
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

  const toDelete: string[] = []
  const toUpdate: { id: string; quantity: number }[] = []
  const seen = new Set<string>()

  for (const line of linked) {
    const target = line.metadata![WARRANTY_FOR] as string
    const wanted = quantityByProduct.get(target) ?? 0

    if (seen.has(target) || wanted === 0) {
      toDelete.push(line.id)
      continue
    }
    seen.add(target)
    if (Number(line.quantity) !== wanted) {
      toUpdate.push({ id: line.id, quantity: wanted })
    }
  }

  if (!toDelete.length && !toUpdate.length) return false

  if (toDelete.length) {
    await deleteLineItemsWorkflow(scope).run({
      input: { cart_id: cartId, ids: toDelete },
    })
  }
  for (const { id, quantity } of toUpdate) {
    await updateLineItemInCartWorkflow(scope).run({
      input: { cart_id: cartId, item_id: id, update: { quantity } },
    })
  }
  return true
}
