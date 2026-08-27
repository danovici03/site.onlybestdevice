/**
 * Prețurile produsului, citite și scrise prin ruta proprie
 * `/admin/product-prices/:id`.
 *
 * Nu prin `/admin/products/:id/variants/batch`, care ar fi calea nativă: acolo
 * `prices` e un set complet, iar orice rând netrimis se șterge. Traducerea în
 * price set / price list o face serverul (`src/lib/pricing.ts`); de aici pleacă
 * doar numerele din card.
 */

export type VariantPrices = {
  id: string
  title: string
  sku: string | null
  price: number | null
  sale_price: number | null
}

/**
 * Prețurile garanției extinse pentru produsul curent.
 *
 * `null` (câmpul lipsă) = produsul de serviciu însuși, care n-are cum să-și
 * pună garanție pe el. `one_year`/`two_years` gol = produsul merge pe prețul
 * implicit din `defaults`.
 */
export type WarrantyPrices = {
  one_year: number | null
  two_years: number | null
}

export type WarrantyCard = WarrantyPrices & {
  defaults: WarrantyPrices
  /** Pragul sub care garanția nu apare pe site, oricât ar fi tarifată. */
  min_price: number
}

export type ProductPrices = {
  currency_code: string
  variants: VariantPrices[]
  warranty: WarrantyCard | null
}

export type PriceUpdate = {
  id: string
  price?: number
  /** `null` scoate varianta de la promoție. */
  sale_price?: number | null
}

const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      body?.error?.formErrors?.[0] || body?.message || `Cererea a eșuat: ${res.status}`
    )
  }
  return res.json()
}

export const fetchProductPrices = (productId: string): Promise<ProductPrices> =>
  api<ProductPrices>(`/admin/product-prices/${productId}`)

/** Întoarce starea proaspătă, deci nu mai e nevoie de o citire după salvare. */
export const saveProductPrices = (
  productId: string,
  payload: {
    variants?: PriceUpdate[]
    /** Doar duratele schimbate; `null` scoate prețul propriu al produsului. */
    warranty?: Partial<WarrantyPrices>
  }
): Promise<ProductPrices> =>
  api<ProductPrices>(`/admin/product-prices/${productId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
