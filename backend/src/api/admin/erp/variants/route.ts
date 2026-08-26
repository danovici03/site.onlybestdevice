import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { resolveCurrencyCode } from "../../../../lib/currency"
import { resolveStockLocationId } from "../../../../lib/erp/stock"

/**
 * Lista plata de variante, pentru potrivirea si auditul din ERP
 * (`php artisan medusa:match-products`, `medusa:audit-unlinked`).
 *
 *   GET /admin/erp/variants?limit=200&offset=0
 *
 * Fata de /admin/products, raspunsul e deja aplatizat pe varianta (unitatea de
 * stoc) si contine starea de inventar — exact cele doua lucruri de care are
 * nevoie ERP-ul, fara sa parcurga produse imbricate.
 *
 * `price` e pretul de baza in moneda magazinului, ca `medusa:sync-prices` sa poata
 * arata diferenta inainte sa scrie si sa sara peste ce e deja la fel. Promotiile
 * nu apar aici: relatia `price_set.prices` intoarce doar preturile de baza, si
 * doar pe ele le si scrie ERP-ul.
 */

const FIELDS = [
  "id",
  "sku",
  "title",
  "product_id",
  "manage_inventory",
  "allow_backorder",
  "product.title",
  "product.handle",
  "product.status",
  "inventory_items.inventory.id",
  "inventory_items.inventory.location_levels.location_id",
  "inventory_items.inventory.location_levels.stocked_quantity",
  "inventory_items.inventory.location_levels.reserved_quantity",
  "price_set.prices.amount",
  "price_set.prices.currency_code",
  "price_set.prices.price_rules.attribute",
]

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const limit = Math.min(Math.max(Number(req.query.limit ?? 200), 1), 1000)
  const offset = Math.max(Number(req.query.offset ?? 0), 0)

  const locationId = await resolveStockLocationId(req.scope)
  const currencyCode = await resolveCurrencyCode(req.scope)

  const { data, metadata } = await query.graph({
    entity: "product_variant",
    fields: FIELDS,
    pagination: { skip: offset, take: limit, order: { id: "ASC" } },
  })

  const variants = (data ?? []).map((v: any) => {
    const inventory = v.inventory_items?.[0]?.inventory
    const level = (inventory?.location_levels ?? []).find(
      (l: any) => !locationId || l.location_id === locationId,
    )

    // Acelasi criteriu ca in lib/pricing.ts: moneda magazinului si fara reguli.
    // Un pret legat de regiune traieste in acelasi price set si in aceeasi
    // moneda; fara filtrul pe reguli l-am da drept pret general.
    const price = (v.price_set?.prices ?? []).find(
      (p: any) =>
        p.currency_code === currencyCode && !(p.price_rules ?? []).length,
    )

    return {
      id: v.id,
      sku: v.sku ?? null,
      title: v.title ?? null,
      product_id: v.product_id ?? null,
      product_title: v.product?.title ?? null,
      product_handle: v.product?.handle ?? null,
      product_status: v.product?.status ?? null,
      manage_inventory: !!v.manage_inventory,
      allow_backorder: !!v.allow_backorder,
      price: price ? Number(price.amount) : null,
      inventory_item_id: inventory?.id ?? null,
      stocked_quantity: level ? Number(level.stocked_quantity ?? 0) : null,
      reserved_quantity: level ? Number(level.reserved_quantity ?? 0) : null,
    }
  })

  return res.json({
    variants,
    count: metadata?.count ?? variants.length,
    limit,
    offset,
    currency_code: currencyCode,
    stock_location_id: locationId,
  })
}
