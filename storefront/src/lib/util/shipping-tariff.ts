/**
 * Taxa de transport nu trece prin site: clientul o achită direct curierului, la
 * primirea coletului. În Medusa opțiunile de livrare au preț 0 (vezi
 * backend/src/scripts/shipping-fan-curier.ts), deci cifrele de mai jos sunt
 * singura sursă pentru sumele afișate — nu le duplica în pagini.
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

/** Tarif după codul tipului de opțiune de livrare din Medusa. */
const TARIFF_BY_TYPE: Record<string, number> = {
  standard: STANDARD_TARIFF,
  priority: PRIORITY_TARIFF,
  express: PRIORITY_TARIFF,
}

/**
 * Cât achită clientul curierului pentru opțiunea dată, sau `undefined` când
 * opțiunea chiar e gratuită (ridicarea din magazin).
 */
export const courierTariff = (typeCode?: string | null) =>
  typeCode ? TARIFF_BY_TYPE[typeCode] : undefined

/** Ridicarea din magazin chiar e gratuită — o recunoaștem după nume, ca în
 *  widget-ul de admin (backend/src/admin/widgets/order-pickup-ready.tsx). */
export const isPickupMethod = (name?: string | null) =>
  /ridicare/i.test(name ?? "")

/**
 * Pe comanda deja plasată nu mai avem codul tipului, doar numele metodei
 * salvate — deci deducem tariful din nume. Ține numele opțiunilor sincron cu
 * backend/src/scripts/shipping-fan-curier.ts.
 */
export const courierTariffForMethodName = (name?: string | null) => {
  if (!name || isPickupMethod(name)) return undefined
  return /prioritar/i.test(name) ? PRIORITY_TARIFF : STANDARD_TARIFF
}

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

/**
 * Cele două rânduri de preț de lângă o opțiune de livrare. La prioritară un
 * „43,99 lei" apărut de nicăieri nu se citește: arătăm din ce se compune și
 * lăsăm totalul pe rândul mic.
 */
export const courierTariffLabel = (amount: number) =>
  amount === PRIORITY_TARIFF
    ? {
        main: `${formatAmount(STANDARD_TARIFF)} + ${formatAmount(
          PRIORITY_SURCHARGE
        )} lei`,
        sub: `${COURIER_TARIFF_PRIORITY} la curier`,
      }
    : { main: formatTariff(amount), sub: "la curier" }

/** Pentru texte generale, unde nu știm ce opțiune alege clientul. */
export const COURIER_TARIFF_FROM = `de la ${COURIER_TARIFF_STANDARD}`

/** Formularea scurtă, folosită lângă sume. */
export const COURIER_PAID_NOTE = "se achită curierului la livrare"

/** Textul lung, pentru coș și checkout. */
export const COURIER_PAID_EXPLAINER =
  `Taxa de transport nu e inclusă în total: o achiți direct curierului ` +
  `${COURIER_NAME}, la primirea coletului.`
