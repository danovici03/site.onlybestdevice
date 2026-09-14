/**
 * Tarifele de transport Fan Curier, în lei.
 *
 * Transportul se încasează prin site: e preț real pe opțiunile de livrare din
 * Medusa (îl aplică `src/scripts/shipping-fan-curier.ts`), deci intră în
 * `shipping_total` și în totalul comenzii. De acolo ajunge de la sine în suma
 * cerută la card, la rate și la ordin de plată.
 *
 * La ramburs suma apare la fel în total, dar banii îi încasează curierul
 * direct — noi primim doar contravaloarea mărfii.
 *
 * ATENȚIE: dublat în storefront (`src/lib/util/shipping-tariff.ts`), de unde
 * se scriu textele informative de pe paginile statice. Se schimbă în ambele
 * locuri, iar pe bază se aplică rulând scriptul de mai sus.
 */
export const STANDARD_TARIFF = 38

/** Cât costă în plus prioritara față de standard. */
export const PRIORITY_SURCHARGE = 5.99

// Rotunjire explicită: 38 + 5.99 dă 43.989999999999995 în virgulă mobilă.
export const PRIORITY_TARIFF = Number(
  (STANDARD_TARIFF + PRIORITY_SURCHARGE).toFixed(2)
)

/**
 * Cel mai scump transport pe care îl poate purta o comandă. Folosit acolo unde
 * vedem doar totalul, fără defalcare (vezi plafonul de numerar din
 * `src/modules/manual-payments/service.ts`).
 */
export const MAX_COURIER_TARIFF = Math.max(STANDARD_TARIFF, PRIORITY_TARIFF)

/** Tariful după codul tipului de opțiune de livrare din Medusa. */
export const TARIFF_BY_TYPE: Record<string, number> = {
  standard: STANDARD_TARIFF,
  priority: PRIORITY_TARIFF,
  express: PRIORITY_TARIFF,
  // Ridicarea din magazin chiar e gratuită.
  pickup: 0,
}
