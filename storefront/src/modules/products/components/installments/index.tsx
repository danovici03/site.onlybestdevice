"use client"

import {
  FINANCER_NAME,
  UCFIN_GUIDE_URL,
  availableTerms,
  formatLei,
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
  /** Termenul preselectat (dacă vine din altă parte a fluxului). */
  initialMonths?: number
  /** Anunță selecția termenului (folosit la checkout). */
  onSelectMonths?: (months: number) => void
}

const Installments = ({
  amount,
  currency,
  compact = false,
  initialMonths,
  onSelectMonths,
}: InstallmentsProps) => {
  const terms = useMemo(() => availableTerms(amount), [amount])

  // Termenul implicit: cel mai lung disponibil, adică rata cea mai mică. E
  // aceeași cifră cu teaser-ul „rate de la …" de lângă preț (`lowestOffer`);
  // dacă le desincronizezi, pe același ecran apar două rate diferite.
  const defaultTerm = terms[terms.length - 1]
  const [months, setMonths] = useState<number | null>(initialMonths ?? null)
  const [showDetails, setShowDetails] = useState(false)

  const selected =
    months != null && terms.includes(months) ? months : defaultTerm
  const offer = useMemo(
    () => (selected ? offerFor(amount, selected) : null),
    [amount, selected]
  )

  if (!supportsInstallments(currency) || !terms.length || !offer) return null

  const { product } = offer

  const pick = (m: number) => {
    setMonths(m)
    onSelectMonths?.(m)
  }

  return (
    <section
      id="plata-in-rate"
      className="scroll-mt-28 rounded-2xl border border-brand-dark/10 bg-white overflow-hidden"
      aria-label="Plata în rate"
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <CreditCard size={16} weight="fill" className="text-brand-accent" />
        <span className="flex-1 font-bold text-sm text-brand-dark">
          Cumpără în rate prin {FINANCER_NAME}
        </span>
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
      </div>

      {/* Selector de termen */}
      <div className="flex flex-wrap gap-1.5 px-4">
        {terms.map((m) => {
          const active = m === selected
          return (
            <button
              key={m}
              type="button"
              onClick={() => pick(m)}
              aria-pressed={active}
              className={clx(
                "flex-1 min-w-[64px] rounded-xl border py-2 text-xs font-bold transition-colors",
                active
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
        în {selected} rate lunare egale · dobândă anuală fixă{" "}
        {Math.round(product.annualRate * 100)}% · DAE{" "}
        {product.dae.toLocaleString("ro-RO")}%
        {!compact && (
          <>
            {" "}
            · valoare totală orientativă {formatLei(offer.total)}
          </>
        )}
      </p>

      {/* TBI fără cifre: până nu avem dobânda/DAE de la ei, nu avem voie să
          afișăm rate (OUG 50/2010 cere DAE la publicitatea creditelor). */}
      <p className="px-4 pt-2 pb-4 text-xs text-brand-dark/45">
        <span className="mr-1.5 inline-flex items-center rounded bg-black px-1.5 py-0.5 text-[9px] font-bold lowercase text-white">
          tbi bank
        </span>
        În curând: plata în rate online și prin TBI Bank.
      </p>

      {showDetails && (
        <div className="border-t border-brand-dark/10 bg-brand-light/50 px-4 py-3">
          <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-brand-dark/70">
            <li>
              Produs financiar{" "}
              <span className="font-bold text-brand-dark">{product.name}</span>{" "}
              de la UniCredit Consumer Financing IFN S.A.: finanțare între{" "}
              {formatLei(product.minAmount)} și{" "}
              {formatLei(product.maxAmountLabel)}, pe {product.minMonths}–
              {product.maxMonths} de luni.
            </li>
            <li>
              Rata include comisionul lunar de administrare credit de{" "}
              {formatLei(product.monthlyAdminFee)}. Comision de analiză dosar:{" "}
              {formatLei(product.fileAnalysisFee)}.
            </li>
            <li>
              DAE {product.dae.toLocaleString("ro-RO")}% este calculată pentru
              suma maximă și perioada maximă a produsului. Calculul este orientativ — suma finală și
              graficul de rambursare sunt stabilite de finanțator la aprobarea
              dosarului.
            </li>
            <li>
              Alegi ratele ca metodă de plată la finalizarea comenzii, parcurgi
              creditarea 100% online (identificare video + semnătură
              electronică) și primești răspunsul în maximum 15 minute.
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
          </ul>
        </div>
      )}
    </section>
  )
}

export default Installments
