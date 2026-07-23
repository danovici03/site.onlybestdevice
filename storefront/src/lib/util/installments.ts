/**
 * Calculul ratelor pentru Creditul Online UniCredit Consumer Financing IFN S.A.
 *
 * Valorile comerciale și formula vin din documentația oficială UCFin
 * (email 23.07.2026 + „Calcul Rata.xlsx" + „Informatii Credit UCFin_ONLY BEST
 * DEVICE SRL_23.07.26.docx"). NU modifica dobânzile/pragurile fără confirmare
 * de la UCFin — publicitatea la credit cere afișarea DAE corect.
 *
 * Formula ratei (extrasă din Excel-ul oficial, verificată pe toate exemplele
 * lor: 2090/36/25% → 94,74 · 4199,99/48/22% → 144,63 · 6999,99/60/11% →
 * 163,53, plus exemplele reprezentative din documentul juridic):
 *
 *   rata = ROUND( P · (1 + r·59/360) · i·(1+i)^(n−1) / ((1+i)^n − 1), 2 ) + 10
 *
 * unde P = valoarea coșului, r = dobânda anuală fixă, i = r/12, n = numărul
 * de luni, 10 = comisionul lunar de administrare. Factorul (1 + r·59/360)
 * capitalizează dobânda pe perioada de grație de 59 de zile până la prima
 * scadență.
 *
 * Calculul rămâne orientativ: aprobarea și graficul final aparțin UCFin.
 */

export type FinancingProduct = {
  id: "low-dae-36" | "low-dae-48" | "low-dae-60"
  name: string
  /** Suma minimă finanțabilă (inclusiv), în lei. */
  minAmount: number
  /** Prima sumă care NU mai intră în produs (exclusiv), în lei. */
  maxAmountExclusive: number
  /** Suma maximă afișabilă în textele legale, în lei. */
  maxAmountLabel: number
  /** Dobânda anuală fixă, ex. 0.25 = 25%. */
  annualRate: number
  /** Comision lunar de administrare credit, în lei. */
  monthlyAdminFee: number
  /** Comision de analiză dosar (perceput doar la acordare), în lei. */
  fileAnalysisFee: number
  minMonths: number
  maxMonths: number
  /** DAE, calculată de UCFin pentru suma maximă și perioada maximă. */
  dae: number
}

export const FINANCING_PRODUCTS: FinancingProduct[] = [
  {
    id: "low-dae-36",
    name: "Low DAE 36M",
    minAmount: 1000,
    maxAmountExclusive: 3000,
    maxAmountLabel: 2999,
    annualRate: 0.25,
    monthlyAdminFee: 10,
    fileAnalysisFee: 0,
    minMonths: 12,
    maxMonths: 36,
    dae: 37.92,
  },
  {
    id: "low-dae-48",
    name: "Low DAE 48M",
    minAmount: 3000,
    maxAmountExclusive: 5000,
    maxAmountLabel: 4999,
    annualRate: 0.22,
    monthlyAdminFee: 10,
    fileAnalysisFee: 0,
    minMonths: 12,
    maxMonths: 48,
    dae: 30.09,
  },
  {
    id: "low-dae-60",
    name: "Low DAE 60M",
    minAmount: 5000,
    maxAmountExclusive: 50000.01,
    maxAmountLabel: 50000,
    annualRate: 0.11,
    monthlyAdminFee: 10,
    fileAnalysisFee: 0,
    minMonths: 12,
    maxMonths: 60,
    dae: 12.44,
  },
]

/** Pragurile globale de finanțare UCFin, în lei. */
export const FINANCING_MIN = FINANCING_PRODUCTS[0].minAmount
export const FINANCING_MAX =
  FINANCING_PRODUCTS[FINANCING_PRODUCTS.length - 1].maxAmountLabel

export const FINANCER_NAME = "UniCredit Consumer Financing"

/** Nota GDPR UCFin — obligatoriu bifată la checkout pentru plata în rate. */
export const UCFIN_GDPR_URL =
  "https://www.ucfin.ro/pdf/protectia-datelor/UCFIN-Informare-privind-prelucrarea-datelor-personale-in-contextul-creditarii-la-distanta.pdf"

/** Ghidul UCFin pentru semnarea la distanță (dreptul de retragere etc.). */
export const UCFIN_GUIDE_URL =
  "https://www.ucfin.ro/pdf/fise_produs/GhidSemnareLaDistanta.pdf"

/** Moneda pentru care afișăm rate; în afara ei calculatorul se ascunde. */
export const INSTALLMENT_CURRENCY = "ron"

export type InstallmentOffer = {
  product: FinancingProduct
  months: number
  /** Rata lunară (include comisionul de administrare), cu 2 zecimale. */
  monthly: number
  /** Valoare totală plătibilă orientativă = rata × luni. */
  total: number
}

/** Produsul financiar în care se încadrează suma, sau null în afara pragurilor. */
export function productForAmount(amount: number): FinancingProduct | null {
  return (
    FINANCING_PRODUCTS.find(
      (p) => amount >= p.minAmount && amount < p.maxAmountExclusive
    ) ?? null
  )
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Rata lunară după formula oficială UCFin (vezi comentariul din capul
 * fișierului). Rotunjirea la 2 zecimale se face ÎNAINTE de adăugarea
 * comisionului lunar, exact ca în Excel-ul lor.
 */
export function monthlyPayment(
  amount: number,
  months: number,
  product: FinancingProduct
): number {
  const i = product.annualRate / 12
  const grace = 1 + (product.annualRate * 59) / 360
  const pow = Math.pow(1 + i, months - 1)
  const raw = (amount * grace * (i * pow)) / ((1 + i) * pow - 1)
  return round2(raw) + product.monthlyAdminFee
}

/**
 * Termenele afișate în selector (multipli de 12 luni în intervalul
 * produsului), sau [] dacă suma nu e finanțabilă.
 */
export function availableTerms(amount: number): number[] {
  const product = productForAmount(amount)
  if (!product) return []
  const terms: number[] = []
  for (let m = 12; m <= product.maxMonths; m += 12) {
    if (m >= product.minMonths) terms.push(m)
  }
  return terms
}

/** Oferta pentru o combinație sumă × termen, sau null dacă nu e finanțabilă. */
export function offerFor(
  amount: number,
  months: number
): InstallmentOffer | null {
  const product = productForAmount(amount)
  if (!product || months < product.minMonths || months > product.maxMonths) {
    return null
  }
  const monthly = monthlyPayment(amount, months, product)
  return { product, months, monthly, total: round2(monthly * months) }
}

/**
 * Cea mai mică rată lunară posibilă pentru sumă — la cel mai lung termen
 * disponibil. Pentru teaser-ul „rate de la …" din listări și PDP.
 */
export function lowestOffer(amount: number): InstallmentOffer | null {
  const terms = availableTerms(amount)
  if (!terms.length) return null
  return offerFor(amount, terms[terms.length - 1])
}

/** Ratele se afișează doar pentru RON. */
export const supportsInstallments = (currency?: string | null): boolean =>
  !currency || currency.toLowerCase() === INSTALLMENT_CURRENCY

/** „1.234,56 lei" — zecimalele apar doar când există. */
export const formatLei = (n: number): string =>
  `${n.toLocaleString("ro-RO", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })} lei`
