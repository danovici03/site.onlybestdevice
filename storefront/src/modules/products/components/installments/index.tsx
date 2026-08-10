"use client"

/**
 * Calculatorul de rate. Aceleași cifre pentru ambii finanțatori (vezi
 * `lib/util/installments`), diferă doar textele legale. În modul cu taburi
 * (PDP) clientul comută între UniCredit și TBI Bank și calculatorul se
 * recalculează; cu `financier` fixat (coș, checkout) rămâne pe un singur
 * finanțator, pentru că părintele are deja rândul lui.
 */

import {
  FINANCIER_LABEL,
  FINANCIER_SHORT,
  Financier,
  UCFIN_GUIDE_URL,
  availableTerms,
  financiersFor,
  formatLei,
  lowestOffer,
  lowestOfferFrom,
  offerFor,
  supportsInstallments,
} from "@lib/util/installments"
import { clx } from "@medusajs/ui"
import { CaretDown, CreditCard } from "@phosphor-icons/react/dist/ssr"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useMemo, useState } from "react"

type InstallmentsProps = {
  /** Prețul în unitatea majoră (lei). */
  amount: number
  /** Codul ISO al monedei; ratele se afișează doar pentru RON. */
  currency?: string
  /** Varianta compactă (coș/checkout): fără detalii extinse. */
  compact?: boolean
  /**
   * Randare în interiorul altui container (ex. selectorul de finanțatori din
   * coș): fără chenar și fără header propriu — părintele le asigură.
   */
  embedded?: boolean
  /**
   * Fixează finanțatorul (fără taburi). Folosit acolo unde alegerea o face
   * părintele: rândurile din coș și metodele de plată din checkout.
   */
  financier?: Financier
  /** Termenul preselectat (dacă vine din altă parte a fluxului). */
  initialMonths?: number
  /** Anunță selecția termenului (folosit la checkout). */
  onSelectMonths?: (months: number) => void
  /**
   * Providerul TBI e activ pe regiune. Vine din lista reală de metode de
   * plată, ca să nu oferim un calcul pe un finanțator pe care clientul nu-l
   * poate alege la finalizare.
   */
  tbiAvailable?: boolean
}

const Installments = ({
  amount,
  currency,
  compact = false,
  embedded = false,
  financier,
  initialMonths,
  onSelectMonths,
  tbiAvailable = false,
}: InstallmentsProps) => {
  // Finanțatorii care pot acoperi suma. Cu `financier` fixat rămâne cel mult
  // unul, deci taburile dispar singure.
  const financiers = useMemo(() => {
    if (financier) {
      return availableTerms(financier, amount).length ? [financier] : []
    }
    return financiersFor(amount, { tbi: tbiAvailable })
  }, [financier, amount, tbiAvailable])

  // Tabul implicit: finanțatorul cu rata cea mai mică — aceeași cifră cu
  // teaser-ul „rate de la …" de lângă preț. Dacă le desincronizezi, pe
  // același ecran apar două rate diferite.
  const defaultFinancier = useMemo(
    () => lowestOffer(amount, financiers)?.financier ?? financiers[0],
    [amount, financiers]
  )

  // Alegerea e legată de suma pentru care a fost făcută: la schimbarea
  // variantei (alt preț) revenim la implicit, altfel calculatorul ar rămâne pe
  // TBI în timp ce teaser-ul de lângă preț recalculează pe UniCredit — două
  // rate diferite pe același ecran.
  const [picked, setPicked] = useState<{
    financier: Financier
    amount: number
  } | null>(null)
  const [months, setMonths] = useState<number | null>(initialMonths ?? null)
  const [showDetails, setShowDetails] = useState(false)

  const active =
    picked && picked.amount === amount && financiers.includes(picked.financier)
      ? picked.financier
      : defaultFinancier

  const terms = useMemo(
    () => (active ? availableTerms(active, amount) : []),
    [active, amount]
  )

  // Termenul implicit: cel cu rata cea mai mică. La TBI asigurarea crește cu
  // durata, deci nu e garantat cel mai lung termen.
  const defaultTerm = useMemo(
    () => (active ? lowestOfferFrom(active, amount)?.months : undefined),
    [active, amount]
  )

  const selected = months != null && terms.includes(months) ? months : defaultTerm
  const offer = useMemo(
    () => (active && selected ? offerFor(active, amount, selected) : null),
    [active, amount, selected]
  )

  if (!supportsInstallments(currency) || !financiers.length || !offer) {
    return null
  }

  const { plan } = offer
  const current = offer.financier
  const isTbi = current === "tbi"
  // DAE recalculată pentru combinația aleasă, la ambii finanțatori. Cu
  // selectorul de finanțator, o DAE publicată (calculată de UCFin pentru suma
  // și perioada maximă a produsului) ar sta lângă DAE reală a TBI și ar face
  // UniCredit să pară mai ieftin decât e. Cifra publicată rămâne în detalii și
  // pe /credit-online, unde despre ea e vorba.
  const dae = offer.dae

  const pick = (m: number) => {
    setMonths(m)
    onSelectMonths?.(m)
  }

  const detailsToggle = (
    <button
      type="button"
      onClick={() => setShowDetails((v) => !v)}
      aria-expanded={showDetails}
      className="inline-flex items-center gap-1 text-xs font-bold text-brand-dark/50 transition-colors hover:text-brand-accent"
    >
      Detalii
      <CaretDown
        size={11}
        weight="bold"
        className={clx("transition-transform", showDetails && "rotate-180")}
      />
    </button>
  )

  return (
    <section
      id={embedded ? undefined : "plata-in-rate"}
      className={clx(
        "overflow-hidden",
        !embedded &&
          "scroll-mt-28 rounded-2xl border border-brand-dark/10 bg-white"
      )}
      aria-label="Plata în rate"
    >
      {!embedded && (
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <CreditCard size={16} weight="fill" className="text-brand-accent" />
          <span className="flex-1 font-bold text-sm text-brand-dark">
            Cumpără în rate
            {financiers.length === 1 && ` prin ${FINANCIER_LABEL[current]}`}
          </span>
          {detailsToggle}
        </div>
      )}
      {embedded && <div className="pt-3" />}

      {/* Selectorul de finanțator — doar când clientul chiar are de ales */}
      {financiers.length > 1 && (
        <div
          role="tablist"
          aria-label="Finanțator"
          className="mx-4 mb-3 flex gap-1 rounded-xl bg-brand-light p-1"
        >
          {financiers.map((f) => {
            const activeTab = f === active
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={activeTab}
                onClick={() => {
                  setPicked({ financier: f, amount })
                  // Termenele diferă între finanțatori; revenim la implicit ca
                  // să nu rămână agățată o alegere fără sens pe celălalt.
                  setMonths(null)
                }}
                className={clx(
                  "flex-1 rounded-lg py-2 text-xs font-bold transition-colors",
                  activeTab
                    ? "bg-white text-brand-dark shadow-sm"
                    : "text-brand-dark/55 hover:text-brand-dark"
                )}
              >
                {FINANCIER_SHORT[f]}
              </button>
            )
          })}
        </div>
      )}

      {/* Selector de termen */}
      <div className="flex flex-wrap gap-1.5 px-4">
        {terms.map((m) => {
          const isActive = m === selected
          return (
            <button
              key={m}
              type="button"
              onClick={() => pick(m)}
              aria-pressed={isActive}
              className={clx(
                "flex-1 min-w-[64px] rounded-xl border py-2 text-xs font-bold transition-colors",
                isActive
                  ? "border-brand-dark bg-brand-dark text-white"
                  : "border-brand-dark/15 text-brand-dark hover:border-brand-dark/40"
              )}
            >
              {m} rate
            </button>
          )
        })}
      </div>

      {/* Rata calculată */}
      <div className="flex items-baseline gap-2 px-4 pt-4">
        <span className="text-2xl font-extrabold tracking-tight text-brand-dark">
          {formatLei(offer.monthly)}
        </span>
        <span className="text-sm text-brand-dark/50">/ lună</span>
      </div>

      <p className="px-4 pt-1 text-xs text-brand-dark/60">
        în {selected} rate lunare egale ·{" "}
        {plan.annualRate === 0
          ? // Dobânda 0 nu înseamnă credit gratuit: comisionul de dosar intră
            // în aceeași frază, ca „fără dobândă" să nu contrazică DAE-ul.
            `fără dobândă · comision unic ${formatLei(plan.fileAnalysisFee)}`
          : `dobândă anuală fixă ${Math.round(plan.annualRate * 100)}%`}{" "}
        · DAE {dae.toLocaleString("ro-RO")}%
        {!compact && (
          <> · valoare totală orientativă {formatLei(offer.total)}</>
        )}
      </p>

      <div className="px-4 pt-2 pb-4">
        <p className="text-xs text-brand-dark/45">
          <span className="mr-1.5 inline-flex items-center rounded bg-black px-1.5 py-0.5 text-[9px] font-bold lowercase text-white">
            {isTbi ? "tbi bank" : "ucfin"}
          </span>
          {isTbi
            ? "Alegi TBI Bank la finalizarea comenzii; graficul final de rambursare se confirmă pe pagina lor, înainte de semnare."
            : "Alegi ratele UniCredit la finalizarea comenzii; creditarea e 100% online, cu răspuns în maximum 15 minute."}
        </p>
        {embedded && <div className="pt-2">{detailsToggle}</div>}
      </div>

      {showDetails && (
        <div className="border-t border-brand-dark/10 bg-brand-light/50 px-4 py-3">
          <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-brand-dark/70">
            <li>
              Produs financiar{" "}
              <span className="font-bold text-brand-dark">{plan.name}</span> de
              la {FINANCIER_LABEL[current]}
              {isTbi ? " EAD Sofia, sucursala București" : " IFN S.A."}:
              finanțare între{" "}
              {formatLei(plan.minAmount)} și {formatLei(plan.maxAmountLabel)}
              {plan.minMonths === plan.maxMonths
                ? `, în ${plan.maxMonths} rate lunare`
                : `, pe ${plan.minMonths}–${plan.maxMonths} de luni`}
              .
            </li>
            {isTbi ? (
              <>
                <li>
                  Rata include comisionul de analiză dosar de{" "}
                  {formatLei(plan.fileAnalysisFee)}
                  {offer.insurance > 0 && (
                    <>
                      {" "}
                      și asigurarea de {formatLei(offer.insurance)} (0,20% pe
                      lună din valoarea finanțată), ambele finanțate odată cu
                      creditul
                    </>
                  )}
                  .
                </li>
                <li>
                  DAE {offer.dae.toLocaleString("ro-RO")}% este calculată de
                  noi pentru această combinație de sumă și perioadă, cu toate
                  costurile incluse. Suma finală, dobânda și DAE contractuale
                  se afișează pe pagina securizată TBI Bank, înainte de
                  semnarea contractului.
                </li>
                <li>
                  Alegi „TBI Bank” ca metodă de plată la finalizarea comenzii și
                  aplici online, fără card de credit; răspunsul vine în câteva
                  minute.
                </li>
                <li>Finanțarea este supusă aprobării TBI Bank.</li>
              </>
            ) : (
              <>
                <li>
                  Rata include comisionul lunar de administrare credit de{" "}
                  {formatLei(plan.monthlyAdminFee)}. Comision de analiză dosar:{" "}
                  {formatLei(plan.fileAnalysisFee)}.
                </li>
                <li>
                  DAE {dae.toLocaleString("ro-RO")}% este calculată pentru suma
                  și perioada alese mai sus, cu toate costurile incluse. DAE de
                  referință a produsului, publicată de UCFin pentru suma maximă
                  și perioada maximă, este{" "}
                  {plan.publishedDae?.toLocaleString("ro-RO")}%. Calculul este
                  orientativ — suma finală și graficul de rambursare sunt
                  stabilite de finanțator la aprobarea dosarului.
                </li>
                <li>
                  Alegi ratele ca metodă de plată la finalizarea comenzii,
                  parcurgi creditarea 100% online (identificare video +
                  semnătură electronică) și primești răspunsul în maximum 15
                  minute.
                </li>
                <li>
                  Finanțarea este supusă aprobării UCFin.{" "}
                  <a
                    href={UCFIN_GUIDE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-brand-dark underline underline-offset-2 hover:text-brand-accent"
                  >
                    Ghidul creditării la distanță
                  </a>{" "}
                  ·{" "}
                  <LocalizedClientLink
                    href="/credit-online"
                    className="font-bold text-brand-dark underline underline-offset-2 hover:text-brand-accent"
                  >
                    toate detaliile despre Creditul Online
                  </LocalizedClientLink>
                  .
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </section>
  )
}

export default Installments
