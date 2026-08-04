import { NextRequest, NextResponse } from "next/server"

import { listCatalog } from "@lib/data/products"
import { getProductPrice } from "@lib/util/get-product-price"
import { emptySelectedFilters } from "@lib/util/product-filters"

/**
 * Sugestiile din bara de căutare a nav-ului.
 *
 * Ruta există ca să nu facem typeahead prin server action: acțiunile se
 * serializează una după alta pe același client, deci fiecare tastă ar aștepta
 * răspunsul precedentei. Un GET obișnuit se anulează (AbortController) și se
 * cache-uiește pe CDN — două lucruri de care căutarea instant chiar are nevoie.
 */

export const SUGGESTION_LIMIT = 6

/** Sub două caractere sugestiile sunt zgomot: ar întoarce jumătate din catalog. */
const MIN_QUERY = 2

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const q = (params.get("q") ?? "").trim()
  const countryCode = (params.get("countryCode") ?? "").trim().toLowerCase()

  if (q.length < MIN_QUERY || !countryCode) {
    return NextResponse.json({ products: [], count: 0 })
  }

  try {
    const { products, count } = await listCatalog({
      countryCode,
      selected: emptySelectedFilters(),
      q,
      page: 1,
      limit: SUGGESTION_LIMIT,
    })

    return NextResponse.json(
      {
        count,
        products: products.map((p) => {
          const { cheapestPrice } = getProductPrice({ product: p })
          return {
            id: p.id,
            title: p.title ?? "",
            handle: p.handle ?? "",
            thumbnail: p.thumbnail ?? null,
            price: cheapestPrice?.calculated_price ?? null,
          }
        }),
      },
      // Termenii se repetă mult între vizitatori („iphone", „samsung"), iar
      // catalogul nu se schimbă de la un minut la altul.
      { headers: { "cache-control": "public, s-maxage=60, max-age=30" } }
    )
  } catch (e: any) {
    console.error("[search] sugestiile au eșuat:", e?.message ?? e)
    return NextResponse.json({ products: [], count: 0 })
  }
}
