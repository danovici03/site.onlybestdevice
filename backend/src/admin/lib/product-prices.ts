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

export type ProductPrices = {
  currency_code: string
  variants: VariantPrices[]
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
  variants: PriceUpdate[]
): Promise<ProductPrices> =>
  api<ProductPrices>(`/admin/product-prices/${productId}`, {
    method: "POST",
    body: JSON.stringify({ variants }),
  })
