/**
 * Configurația și calculul pentru plata în rate (TBI Bank / UniCredit).
 *
 * ATENȚIE — valorile comerciale de mai jos sunt PLACEHOLDERE. Înainte de
 * lansare trebuie confirmate cu fiecare finanțator și completate:
 *   • `interestFactor` — 1 înseamnă 0% dobândă (campanie „rate fără dobândă”).
 *     Pentru credit purtător de dobândă, pune factorul total de rambursare
 *     comunicat de bancă (ex. 1.18 pentru 18% cost total pe perioadă).
 *   • `dae` — Dobânda Anuală Efectivă. Cât timp e `null`, cardul afișează doar
 *     estimarea, fără cifre de cost. Publicitatea la credit în România cere
 *     afișarea DAE, deci NU activa un `interestFactor > 1` fără să pui și DAE.
 *   • `minAmount` / `maxAmount` — pragurile de finanțare ale fiecărui produs.
 *
 * Calculul de aici e pur orientativ: aprobarea și rata finală aparțin băncii.
 */

export type InstallmentProvider = {
  id: "tbi" | "unicredit"
  label: string
  /** Suma minimă finanțabilă, în unitatea majoră (lei). */
  minAmount: number
  /** Suma maximă finanțabilă, în unitatea majoră (lei). */
  maxAmount: number
  /** Numărul de rate disponibile la acest finanțator. */
  terms: number[]
  /** Factor total de rambursare; 1 = 0% dobândă. Vezi nota de sus. */
  interestFactor: number
  /** Dobânda Anuală Efectivă, dacă `interestFactor > 1`. */
  dae: number | null
}

export const INSTALLMENT_PROVIDERS: InstallmentProvider[] = [
  {
    id: "tbi",
    label: "TBI Bank",
    minAmount: 300,
    maxAmount: 20000,
    terms: [3, 6, 12, 24, 36],
    interestFactor: 1,
    dae: null,
  },
  {
    id: "unicredit",
    label: "UniCredit",
    minAmount: 500,
    maxAmount: 40000,
    terms: [6, 12, 24, 36, 48],
    interestFactor: 1,
    dae: null,
  },
]

/** Moneda pentru care afișăm rate; în afara ei cardul se ascunde. */
export const INSTALLMENT_CURRENCY = "ron"

/** Termenele oferite în selector, în ordinea afișării. */
export const INSTALLMENT_TERMS = [6, 12, 24, 36]

export type InstallmentOffer = {
  provider: InstallmentProvider
  months: number
  /** Rata lunară, rotunjită în sus la leu. */
  monthly: number
}

/**
 * Rata lunară, rotunjită **în sus**: mai bine afișăm cu un leu peste decât să
 * promitem o rată mai mică decât cea reală.
 */
export const monthlyPayment = (
  amount: number,
  months: number,
  interestFactor: number
): number => Math.ceil((amount * interestFactor) / months)

const eligible = (p: InstallmentProvider, amount: number, months: number) =>
  amount >= p.minAmount && amount <= p.maxAmount && p.terms.includes(months)

/** Finanțatorii care acceptă suma, indiferent de termen. */
export function availableProviders(amount: number): InstallmentProvider[] {
  return INSTALLMENT_PROVIDERS.filter(
    (p) => amount >= p.minAmount && amount <= p.maxAmount
  )
}

/** Termenele pentru care cel puțin un finanțator acceptă suma. */
export function availableTerms(amount: number): number[] {
  return INSTALLMENT_TERMS.filter((m) =>
    INSTALLMENT_PROVIDERS.some((p) => eligible(p, amount, m))
  )
}

/**
 * Cea mai mică rată lunară la un termen dat (oferta „de la …”), sau null dacă
 * niciun finanțator nu acoperă combinația sumă × termen.
 */
export function bestOffer(
  amount: number,
  months: number
): InstallmentOffer | null {
  const offers = INSTALLMENT_PROVIDERS.filter((p) =>
    eligible(p, amount, months)
  ).map((provider) => ({
    provider,
    months,
    monthly: monthlyPayment(amount, months, provider.interestFactor),
  }))
  if (!offers.length) return null
  return offers.reduce((a, b) => (b.monthly < a.monthly ? b : a))
}

export const formatLei = (n: number): string =>
  `${n.toLocaleString("ro-RO")} lei`
