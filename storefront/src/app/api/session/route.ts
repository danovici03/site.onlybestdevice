import { NextResponse } from "next/server"

import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"

/**
 * Coșul și clientul logat sunt singurele date din shell care diferă de la un
 * vizitator la altul. Cât timp erau citite în `(main)/layout.tsx`, layout-ul
 * atingea cookie-uri la randare, deci FIECARE pagină de sub el devenea
 * dinamică — catalogul se randa de la zero la fiecare cerere, fără cache.
 *
 * Mutate aici, ele se cer după hidratare, dintr-o rută care are voie să fie
 * dinamică pentru că nu e nimic de cache-uit în ea. Paginile de catalog rămân
 * cache-uibile.
 *
 * Clientul cere ruta doar dacă are cookie-ul martor `_medusa_session` (vezi
 * `session-context.tsx`), deci vizitatorii la prima vizită și boții nu ajung
 * niciodată aici.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const [cart, customer] = await Promise.all([
    retrieveCart().catch(() => null),
    retrieveCustomer().catch(() => null),
  ])

  return NextResponse.json(
    { cart, customer },
    // Date per-vizitator: nu trebuie să atingă niciun cache intermediar.
    { headers: { "cache-control": "private, no-store" } }
  )
}
