import { PRICE_LIST_BOUNDARY_TAGS } from "./price-list-boundaries"
import {
  MAX_TARGETED_PRODUCTS,
  productRevalidationTags,
} from "./storefront-revalidate"

/**
 * Editarea unui price list din Admin nu emite niciun eveniment Medusa, deci
 * pagina produsului rămânea până la 12 ore pe prețul vechi, iar coșul lua deja
 * prețul nou. Jobul `price-list-revalidate` compară în fiecare minut prețurile
 * listelor aflate în desfășurare cu instantaneul precedent.
 *
 * Compară prețurile, nu `updated_at`: scoaterea unui produs din listă șterge
 * definitiv rândul din `price`, deci n-ar rămâne nicio urmă de interogat.
 */
export type PriceListRow = {
  product_id: string
  handle: string | null
  variant_id: string
  price_list_id: string
  currency_code: string
  amount: string | number
  min_quantity?: string | number | null
  max_quantity?: string | number | null
}

export type ProductPrices = { handle: string | null; prices: string }
export type PriceSnapshot = Map<string, ProductPrices>

export const buildPriceSnapshot = (rows: PriceListRow[]): PriceSnapshot => {
  const grouped = new Map<string, { handle: string | null; prices: string[] }>()

  for (const row of rows) {
    const entry = grouped.get(row.product_id) ?? {
      handle: row.handle,
      prices: [],
    }
    entry.prices.push(
      [
        row.price_list_id,
        row.variant_id,
        row.currency_code,
        Number(row.amount),
        row.min_quantity ?? "",
        row.max_quantity ?? "",
      ].join(":")
    )
    grouped.set(row.product_id, entry)
  }

  return new Map(
    [...grouped].map(([id, { handle, prices }]) => [
      id,
      { handle, prices: prices.sort().join("|") },
    ])
  )
}

/** Produsele cu preț adăugat, schimbat sau scos dintr-o listă în desfășurare. */
export const changedProducts = (
  previous: PriceSnapshot,
  next: PriceSnapshot
): Array<{ id: string; handle: string | null }> => {
  const changed: Array<{ id: string; handle: string | null }> = []

  for (const [id, entry] of next) {
    if (previous.get(id)?.prices !== entry.prices) {
      changed.push({ id, handle: entry.handle })
    }
  }
  for (const [id, entry] of previous) {
    if (!next.has(id)) changed.push({ id, handle: entry.handle })
  }

  return changed
}

/**
 * Doar pagina produsului și listările. `products` lipsește intenționat: invalidează
 * toate paginile de produs și e cea mai scumpă parte din factura Vercel.
 * Peste prag (listă activată sau mutată în masă) o singură invalidare globală e
 * mai ieftină decât sute de taguri.
 */
export const priceChangeTags = (
  products: Array<{ id: string; handle: string | null }>
) =>
  products.length > MAX_TARGETED_PRODUCTS
    ? [...PRICE_LIST_BOUNDARY_TAGS]
    : productRevalidationTags(products, { carts: false })
