import { NextResponse } from "next/server"

import { listProducts } from "@lib/data/products"
import { listRelatedProducts } from "@lib/data/related-products"

/**
 * Raftul „S-ar putea să-ți placă și” de sub produs.
 *
 * Stă în afara paginii ca o golire de cache a raftului să nu mai regenereze
 * toate paginile de produs: acelea erau cea mai mare parte din ISR Writes.
 *
 * Răspunsul stă doar pe CDN, deci nu produce ISR Writes și nici nu se poate
 * invalida prin taguri: un preț sau un stoc vechi rămâne cel mult 2 ore. De
 * aceea cererile către backend ocolesc Data Cache, altfel vechimea s-ar aduna.
 * Tot pe CDN stau și răspunsurile 404, ca handle-urile inexistente să nu ajungă
 * la funcție de fiecare dată.
 */
const CDN_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
  // Googlebot are voie să o citească, ca linkurile din raft să rămână în pagina
  // randată (vezi `robots.ts`), dar JSON-ul nu trebuie să apară în rezultate.
  "X-Robots-Tag": "noindex",
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ countryCode: string; handle: string }> }
) {
  const { countryCode, handle } = await params

  const product = await listProducts({
    countryCode,
    queryParams: { handle },
    noStore: true,
  }).then(({ response }) => response.products[0])

  if (!product) {
    return NextResponse.json(
      { products: [] },
      { status: 404, headers: CDN_HEADERS }
    )
  }

  const related = await listRelatedProducts(product, countryCode)

  return NextResponse.json(
    {
      // Descrierile sunt HTML lung, iar cardul nu le folosește.
      products: related.map(({ description: _description, ...rest }) => rest),
    },
    { headers: CDN_HEADERS }
  )
}
