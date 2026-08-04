import { HttpTypes } from "@medusajs/types"

export const SALE_BADGE_LABEL = "Ofertă"

/**
 * Tagul care marchează un produs ca fiind la ofertă.
 *
 * Exact cel pe care îl scrie bifa „La ofertă" din admin, ca badge-ul de aici și
 * lista de pe /oferte să spună același lucru: dacă am accepta și sinonime
 * moștenite din import (`sale`, `reducere`, …), un produs le-ar putea purta,
 * ar primi badge-ul, dar bifa din admin ar arăta „Preț normal" și n-ar avea
 * cum să i-l scoată. Trebuie să rămână aliniat cu `SALE_TAG` din
 * `backend/src/api/store/catalog/route.ts`.
 *
 * Nu deducem oferta din `compare_at_price`: aproape tot catalogul are un preț
 * tăiat, deci criteriul acela ar marca tot magazinul. Oferta e o selecție
 * făcută manual în admin.
 */
const SALE_TAG = "oferta"

export const isSaleProduct = (product: HttpTypes.StoreProduct): boolean =>
  (product.tags ?? []).some((t) => (t.value ?? "").toLowerCase() === SALE_TAG)
