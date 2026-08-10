/**
 * Calculul ratelor pentru cei doi finanțatori ai magazinului:
 *
 *   • UniCredit Consumer Financing IFN S.A. („Creditul Online")
 *   • TBI Bank („Rate online")
 *
 * Ambii folosesc aceeași structură (`FinancingPlan` = un prag de sumă cu
 * dobânda și comisioanele lui), dar formula ratei diferă — vezi
 * `monthlyPayment`. NU modifica dobânzile/pragurile/comisioanele fără
 * confirmare de la finanțator: publicitatea la credit cere DAE corect
 * (OUG 50/2010).
 *
 * ─── UniCredit ──────────────────────────────────────────────────────────────
 * Valorile și formula vin din documentația oficială UCFin (email 23.07.2026 +
 * „Calcul Rata.xlsx" + „Informatii Credit UCFin_ONLY BEST DEVICE
 * SRL_23.07.26.docx"), verificate pe toate exemplele lor: 2090/36/25% → 94,74 ·
 * 4199,99/48/22% → 144,63 · 6999,99/60/11% → 163,53.
 *
 *   rata = ROUND( P · (1 + r·59/360) · i·(1+i)^(n−1) / ((1+i)^n − 1), 2 ) + 10
 *
 * unde P = valoarea coșului, r = dobânda anuală fixă, i = r/12, n = numărul de
 * luni, 10 = comisionul lunar de administrare. Factorul (1 + r·59/360)
 * capitalizează dobânda pe perioada de grație de 59 de zile până la prima
 * scadență.
 *
 * ─── TBI Bank ───────────────────────────────────────────────────────────────
 * Valorile și formula vin din simulatorul oficial primit de la TBI
 * („Simulator TBI Bank", assets/Calculatorgeneral.js, 05.12.2024). Pragurile
 * de sumă sunt exact codurile `promo` din API-ul lor eCommerce (vezi
 * `tbiPromo` din backend/src/modules/tbi-pay/client.ts):
 *
 *   asigurare = 0,20% · (P + comision) · n        (0 sub 2.000 lei)
 *   principal = P + comision + asigurare
 *   rata      = principal · (1+i)^n · i / ((1+i)^n − 1),  i = r/12
 *
 * Sub 2.000 lei dobânda e 0 și perioada e fixă la 4 rate, deci rata devine
 * (P + 40) / 4.
 *
 * ─── DAE ────────────────────────────────────────────────────────────────────
 * `offerFor` întoarce DAE recalculată din fluxul real de plăți (suma
 * finanțată încasată azi vs. ratele plătite lunar), prin `effectiveDae`.
 * Rutina de DAE din simulatorul TBI e ruptă (secanta pornește din rate = 0 și
 * întoarce NaN), deci o calculăm noi, cu bisecție. Pentru UCFin afișăm în
 * continuare DAE publicată de ei (`publishedDae`) — e cea agreată juridic.
 *
 * Calculul rămâne orientativ: aprobarea și graficul final aparțin
 * finanțatorului.
 */

export type Financier = "ucfin" | "tbi"

export const FINANCIER_LABEL: Record<Financier, string> = {
  ucfin: "UniCredit Consumer Financing",
  tbi: "TBI Bank",
}

/** Numele scurt, pentru taburi și etichete. */
export const FINANCIER_SHORT: Record<Financier, string> = {
  ucfin: "UniCredit",
  tbi: "TBI Bank",
}

export type FinancingPlan = {
  financier: Financier
  id: string
  name: string
  /** Suma minimă finanțabilă (inclusiv), în lei. */
  minAmount: number
  /** Prima sumă care NU mai intră în plan (exclusiv), în lei. */
  maxAmountExclusive: number
  /** Suma maximă afișabilă în textele legale, în lei. */
  maxAmountLabel: number
  /** Dobânda anuală fixă, ex. 0.25 = 25%. */
  annualRate: number
  /** Comision lunar de administrare credit, în lei (inclus în rată). */
  monthlyAdminFee: number
  /** Comision de analiză dosar, în lei (finanțat, perceput la acordare). */
  fileAnalysisFee: number
  /** Rata lunară de asigurare aplicată la (sumă + comision), ex. 0.002. */
  monthlyInsuranceRate: number
  minMonths: number
  maxMonths: number
  /** Termenele oferite în selector, în luni. */
  terms: number[]
  /** DAE publicată de finanțator (pentru suma și perioada maximă). */
  publishedDae?: number
}

/** Compat: pagina /credit-online tipizează tabelul UCFin cu numele vechi. */
export type FinancingProduct = FinancingPlan

const UCFIN_TERMS = [12, 24, 36, 48, 60]

/** Termenele multiplu de 12 dintr-un interval, pentru planurile UCFin. */
const ucfinTerms = (min: number, max: number) =>
  UCFIN_TERMS.filter((m) => m >= min && m <= max)

export const FINANCING_PRODUCTS: FinancingPlan[] = [
  {
    financier: "ucfin",
    id: "low-dae-36",
    name: "Low DAE 36M",
    minAmount: 1000,
    maxAmountExclusive: 3000,
    maxAmountLabel: 2999,
    annualRate: 0.25,
    monthlyAdminFee: 10,
    fileAnalysisFee: 0,
    monthlyInsuranceRate: 0,
    minMonths: 12,
    maxMonths: 36,
    terms: ucfinTerms(12, 36),
    publishedDae: 37.92,
  },
  {
    financier: "ucfin",
    id: "low-dae-48",
    name: "Low DAE 48M",
    minAmount: 3000,
    maxAmountExclusive: 5000,
    maxAmountLabel: 4999,
    annualRate: 0.22,
    monthlyAdminFee: 10,
    fileAnalysisFee: 0,
    monthlyInsuranceRate: 0,
    minMonths: 12,
    maxMonths: 48,
    terms: ucfinTerms(12, 48),
    publishedDae: 30.09,
  },
  {
    financier: "ucfin",
    id: "low-dae-60",
    name: "Low DAE 60M",
    minAmount: 5000,
    maxAmountExclusive: 50000.01,
    maxAmountLabel: 50000,
    annualRate: 0.11,
    monthlyAdminFee: 10,
    fileAnalysisFee: 0,
    monthlyInsuranceRate: 0,
    minMonths: 12,
    maxMonths: 60,
    terms: ucfinTerms(12, 60),
    publishedDae: 12.44,
  },
]

/**
 * Termenele TBI de peste 2.000 lei. Simulatorul lor lasă perioada liberă;
 * grila de mai jos e cea uzuală pentru rate online și e trimisă ca
 * `instalments` în cererea de credit.
 */
const TBI_TERMS = [6, 12, 18, 24, 36, 48, 60]

/** Asigurarea TBI: 0,20% pe lună din (valoare + comision de dosar). */
const TBI_INSURANCE_RATE = 0.002

export const TBI_PLANS: FinancingPlan[] = [
  {
    financier: "tbi",
    id: "tbi-promo-1",
    // NU „4 rate fără dobândă": dobânda e 0, dar comisionul fix de 40 de lei
    // rămâne un cost — vezi textul din calculator, care le pune împreună.
    name: "Plata în 4 rate",
    // Simulatorul TBI pornește de la 100 lei; pragul comercial al magazinului
    // e 200 (decizie 10.08.2026). Sub el nu afișăm rate: comisionul fix de 40
    // de lei ar da un DAE de ordinul sutelor de procente.
    minAmount: 200,
    maxAmountExclusive: 2000.01,
    maxAmountLabel: 2000,
    annualRate: 0,
    monthlyAdminFee: 0,
    fileAnalysisFee: 40,
    monthlyInsuranceRate: 0,
    minMonths: 4,
    maxMonths: 4,
    terms: [4],
  },
  {
    financier: "tbi",
    id: "tbi-promo-0",
    name: "Rate TBI 29%",
    minAmount: 2000.01,
    maxAmountExclusive: 5000.01,
    maxAmountLabel: 5000,
    annualRate: 0.29,
    monthlyAdminFee: 0,
    fileAnalysisFee: 95,
    monthlyInsuranceRate: TBI_INSURANCE_RATE,
    minMonths: 6,
    maxMonths: 60,
    terms: TBI_TERMS,
  },
  {
    financier: "tbi",
    id: "tbi-promo-2",
    name: "Rate TBI 24%",
    minAmount: 5000.01,
    maxAmountExclusive: 10000.01,
    maxAmountLabel: 10000,
    annualRate: 0.24,
    monthlyAdminFee: 0,
    fileAnalysisFee: 95,
    monthlyInsuranceRate: TBI_INSURANCE_RATE,
    minMonths: 6,
    maxMonths: 60,
    terms: TBI_TERMS,
  },
  {
    financier: "tbi",
    id: "tbi-promo-3",
    name: "Rate TBI 18%",
    minAmount: 10000.01,
    // Simulatorul TBI se oprește la 60.000 lei; plafonul magazinului e 90.000
    // (decizie 10.08.2026), cu aceiași parametri ca ultimul prag din simulator
    // — de confirmat cu TBI dacă dobânda diferă peste 60.000.
    maxAmountExclusive: 90000.01,
    maxAmountLabel: 90000,
    annualRate: 0.18,
    monthlyAdminFee: 0,
    fileAnalysisFee: 95,
    monthlyInsuranceRate: TBI_INSURANCE_RATE,
    minMonths: 6,
    maxMonths: 60,
    terms: TBI_TERMS,
  },
]

const PLANS: Record<Financier, FinancingPlan[]> = {
  ucfin: FINANCING_PRODUCTS,
  tbi: TBI_PLANS,
}

/** Toți finanțatorii, în ordinea de afișare. */
export const FINANCIERS: Financier[] = ["ucfin", "tbi"]

/** Pragurile globale de finanțare UCFin, în lei. */
export const FINANCING_MIN = FINANCING_PRODUCTS[0].minAmount
export const FINANCING_MAX =
  FINANCING_PRODUCTS[FINANCING_PRODUCTS.length - 1].maxAmountLabel

/** Pragurile globale de finanțare TBI, în lei. */
export const TBI_MIN = TBI_PLANS[0].minAmount
export const TBI_MAX = TBI_PLANS[TBI_PLANS.length - 1].maxAmountLabel

export const FINANCER_NAME = FINANCIER_LABEL.ucfin

/** Nota GDPR UCFin — obligatoriu bifată la checkout pentru plata în rate. */
export const UCFIN_GDPR_URL =
  "https://www.ucfin.ro/pdf/protectia-datelor/UCFIN-Informare-privind-prelucrarea-datelor-personale-in-contextul-creditarii-la-distanta.pdf"

/** Ghidul UCFin pentru semnarea la distanță (dreptul de retragere etc.). */
export const UCFIN_GUIDE_URL =
  "https://www.ucfin.ro/pdf/fise_produs/GhidSemnareLaDistanta.pdf"

/** Moneda pentru care afișăm rate; în afara ei calculatorul se ascunde. */
export const INSTALLMENT_CURRENCY = "ron"

export type InstallmentOffer = {
  financier: Financier
  plan: FinancingPlan
  months: number
  /** Rata lunară (include toate costurile lunare), cu 2 zecimale. */
  monthly: number
  /** Valoare totală plătibilă orientativă = rata × luni. */
  total: number
  /** Costul total al asigurării inclus în finanțare (TBI). */
  insurance: number
  /** DAE recalculată din fluxul real de plăți, în procente. */
  dae: number
}

/**
 * Planul finanțatorului în care se încadrează suma, sau null. Suma se
 * rotunjește la bani înainte de comparație: backend-ul TBI alege `promo` cu
 * `<= 2000 / 5000 / 10000` pe totalul comenzii, iar un total cu mai mult de
 * două zecimale ar putea nimeri alt prag pe ecran decât cel trimis la TBI.
 */
export function planForAmount(
  financier: Financier,
  amount: number
): FinancingPlan | null {
  const value = Math.round(amount * 100) / 100
  return (
    PLANS[financier].find(
      (p) => value >= p.minAmount && value < p.maxAmountExclusive
    ) ?? null
  )
}

/** Compat: planul UCFin pentru o sumă. */
export const productForAmount = (amount: number) =>
  planForAmount("ucfin", amount)

const round2 = (n: number) => Math.round(n * 100) / 100

/** Costul total al asigurării pentru o combinație sumă × termen. */
export function insuranceFor(
  amount: number,
  months: number,
  plan: FinancingPlan
): number {
  if (!plan.monthlyInsuranceRate) return 0
  return plan.monthlyInsuranceRate * (amount + plan.fileAnalysisFee) * months
}

/**
 * Rata lunară, după formula finanțatorului (vezi comentariul din capul
 * fișierului). La UCFin rotunjirea la 2 zecimale se face ÎNAINTE de adăugarea
 * comisionului lunar, exact ca în Excel-ul lor.
 */
export function monthlyPayment(
  amount: number,
  months: number,
  plan: FinancingPlan
): number {
  const i = plan.annualRate / 12

  if (plan.financier === "ucfin") {
    const grace = 1 + (plan.annualRate * 59) / 360
    const pow = Math.pow(1 + i, months - 1)
    const raw = (amount * grace * (i * pow)) / ((1 + i) * pow - 1)
    // Al doilea round2 curăță doar zgomotul binar al adunării (121,42 + 10 →
    // 131,42000000000002); valoarea rămâne cea din Excel-ul UCFin.
    return round2(round2(raw) + plan.monthlyAdminFee)
  }

  // TBI: comisionul de dosar și asigurarea se finanțează, apoi anuitate
  // clasică pe principalul rezultat.
  const principal = amount + plan.fileAnalysisFee + insuranceFor(amount, months, plan)
  if (i === 0) return round2(principal / months)
  const x = Math.pow(1 + i, months)
  return round2((principal * x * i) / (x - 1))
}

/**
 * DAE efectivă: rata dobânzii lunare care egalează suma încasată azi (prețul
 * bunului) cu ratele plătite, ridicată la an. Bisecție — sigură și suficient
 * de precisă; secanta din simulatorul TBI diverge pentru estimarea inițială 0.
 */
export function effectiveDae(
  amount: number,
  monthly: number,
  months: number
): number {
  if (amount <= 0 || months <= 0 || monthly <= 0) return 0
  // Fără cost total (rate ≤ suma finanțată) DAE e 0.
  if (monthly * months <= amount) return 0

  // Valoarea actualizată a ratelor la rata lunară `r`.
  const pv = (r: number) =>
    r === 0 ? monthly * months : (monthly * (1 - Math.pow(1 + r, -months))) / r

  let lo = 0
  let hi = 1 // 100% pe lună — peste orice produs de creditare real
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    if (pv(mid) > amount) lo = mid
    else hi = mid
  }
  const r = (lo + hi) / 2
  return round2((Math.pow(1 + r, 12) - 1) * 100)
}

/** Termenele afișate în selector, sau [] dacă suma nu e finanțabilă. */
export function availableTerms(
  financier: Financier,
  amount: number
): number[] {
  return planForAmount(financier, amount)?.terms ?? []
}

/** Oferta pentru o combinație finanțator × sumă × termen, sau null. */
export function offerFor(
  financier: Financier,
  amount: number,
  months: number
): InstallmentOffer | null {
  const plan = planForAmount(financier, amount)
  if (!plan || !plan.terms.includes(months)) return null
  const monthly = monthlyPayment(amount, months, plan)
  return {
    financier,
    plan,
    months,
    monthly,
    total: round2(monthly * months),
    insurance: round2(insuranceFor(amount, months, plan)),
    dae: effectiveDae(amount, monthly, months),
  }
}

/** Finanțatorii care pot acoperi suma. `tbi` = providerul e activ pe regiune. */
export function financiersFor(
  amount: number,
  { tbi = false }: { tbi?: boolean } = {}
): Financier[] {
  return FINANCIERS.filter(
    (f) => (f !== "tbi" || tbi) && availableTerms(f, amount).length > 0
  )
}

/**
 * Cea mai mică rată lunară a unui finanțator (de regulă termenul cel mai
 * lung, dar căutăm pe toate termenele — la TBI asigurarea crește cu durata,
 * deci minimul nu e garantat la capăt).
 */
export function lowestOfferFrom(
  financier: Financier,
  amount: number
): InstallmentOffer | null {
  let best: InstallmentOffer | null = null
  for (const months of availableTerms(financier, amount)) {
    const offer = offerFor(financier, amount, months)
    if (offer && (!best || offer.monthly < best.monthly)) best = offer
  }
  return best
}

/**
 * Cea mai mică rată lunară posibilă pentru sumă, dintre finanțatorii primiți.
 * Pentru teaser-ul „rate de la …" din listări, PDP și coș. Implicit doar
 * UCFin: TBI se adaugă doar unde știm că providerul e activ pe regiune.
 */
export function lowestOffer(
  amount: number,
  financiers: Financier[] = ["ucfin"]
): InstallmentOffer | null {
  let best: InstallmentOffer | null = null
  for (const financier of financiers) {
    const offer = lowestOfferFrom(financier, amount)
    if (offer && (!best || offer.monthly < best.monthly)) best = offer
  }
  return best
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
