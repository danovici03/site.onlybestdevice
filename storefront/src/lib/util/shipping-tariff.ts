/**
 * Taxa de transport intră în coș: opțiunile de livrare din Medusa au preț real
 * (vezi backend/src/scripts/shipping-fan-curier.ts), deci sumele afișate în coș,
 * în checkout și pe comandă vin de la API, nu de aici.
 *
 * Cifrele de mai jos rămân pentru textele informative de pe paginile statice,
 * unde n-avem coș din care să citim. ATENȚIE: sunt o copie a celor din
 * backend/src/lib/shipping/tariffs.ts — se schimbă în ambele locuri, iar pe
 * bază se aplică rulând scriptul de acolo.
 */
export const COURIER_NAME = "Fan Curier"

/** Paginile curierului la care trimitem clientul pentru retur și service. */
export const COURIER_PICKUP_URL = "https://www.fancourier.ro/trimite-un-colet/"
export const COURIER_CONTACT_URL = "https://www.fancourier.ro/contact/"
export const COURIER_COVERAGE_URL = "https://www.fancourier.ro/locatii-fan/#cov"

const STANDARD_TARIFF = 38
const PRIORITY_SURCHARGE = 5.99
// Rotunjire explicită: 38 + 5.99 dă 43.989999999999995 în virgulă mobilă.
const PRIORITY_TARIFF = Number((STANDARD_TARIFF + PRIORITY_SURCHARGE).toFixed(2))

/** Ridicarea din magazin chiar e gratuită — o recunoaștem după nume, ca în
 *  widget-ul de admin (backend/src/admin/widgets/order-pickup-ready.tsx). */
export const isPickupMethod = (name?: string | null) =>
  /ridicare/i.test(name ?? "")

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(amount)

export const formatTariff = (amount: number) => `${formatAmount(amount)} lei`

export const COURIER_TARIFF_STANDARD = formatTariff(STANDARD_TARIFF)
export const COURIER_TARIFF_PRIORITY = formatTariff(PRIORITY_TARIFF)
export const COURIER_SURCHARGE_PRIORITY = formatTariff(PRIORITY_SURCHARGE)

/** „38 + 5,99 = 43,99 lei" — pentru textele explicative. */
export const COURIER_TARIFF_PRIORITY_BREAKDOWN =
  `${formatAmount(STANDARD_TARIFF)} + ${formatAmount(PRIORITY_SURCHARGE)} = ` +
  `${COURIER_TARIFF_PRIORITY}`

/** Pentru texte generale, unde nu știm ce opțiune alege clientul. */
export const COURIER_TARIFF_FROM = `de la ${COURIER_TARIFF_STANDARD}`

/** Formularea scurtă, folosită lângă sume. */
export const COURIER_INCLUDED_NOTE = "inclus în totalul comenzii"

/**
 * Nota de la ramburs. Transportul apare în total ca la orice altă metodă, dar
 * banii ăia nu ajung la noi: îi oprește curierul, ca plată a livrării. Pentru
 * client diferența e zero — dă o singură sumă, la ușă — dar fără rândul ăsta
 * pare că plătește transportul de două ori.
 */
export const COURIER_SETTLED_EXPLAINER =
  `Plătești totalul de mai sus curierului, la primirea coletului. Taxa de ` +
  `transport din el e decontată direct de ${COURIER_NAME}.`
