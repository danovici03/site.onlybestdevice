"use client"

import {
  INSTALLMENT_CURRENCY,
  availableProviders,
  availableTerms,
  bestOffer,
  formatLei,
} from "@lib/util/installments"
import { clx } from "@medusajs/ui"
import { ArrowRight, CaretDown, CreditCard } from "@phosphor-icons/react/dist/ssr"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useMemo, useState } from "react"

type InstallmentsProps = {
  /** Prețul în unitatea majoră (lei). */
  amount: number
  /** Codul ISO al monedei; ratele se afișează doar pentru RON. */
  currency?: string
}

const Installments = ({ amount, currency }: InstallmentsProps) => {
  const terms = useMemo(() => availableTerms(amount), [amount])
  const providers = useMemo(() => availableProviders(amount), [amount])

  // Termenul implicit: 12 rate dacă se poate, altfel cel mai lung disponibil —
  // e cel care dă rata cea mai mică, deci cel mai relevant la prima vedere.
  const defaultTerm = terms.includes(12) ? 12 : terms[terms.length - 1]
  const [months, setMonths] = useState<number | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const selected = months != null && terms.includes(months) ? months : defaultTerm
  const offer = useMemo(
    () => (selected ? bestOffer(amount, selected) : null),
    [amount, selected]
  )

  const currencyOk =
    !currency || currency.toLowerCase() === INSTALLMENT_CURRENCY
  if (!currencyOk || !terms.length || !providers.length || !offer) return null

  return (
    <section
      className="rounded-2xl border border-brand-dark/10 bg-white overflow-hidden"
      aria-label="Plata în rate"
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <CreditCard size={16} weight="fill" className="text-brand-accent" />
        <span className="flex-1 font-bold text-sm text-brand-dark">
          Cumpără în rate
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
      <div className="flex gap-1.5 px-4">
        {terms.map((m) => {
          const active = m === selected
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              aria-pressed={active}
              className={clx(
                "flex-1 rounded-xl border py-2 text-xs font-bold transition-colors",
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

      {/* Rata estimată */}
      <div className="flex items-baseline gap-2 px-4 pt-4">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-brand-dark/40">
          de la
        </span>
        <span className="font-serif text-2xl text-brand-dark">
          {formatLei(offer.monthly)}
        </span>
        <span className="text-sm text-brand-dark/50">/ lună</span>
      </div>

      <p className="px-4 pt-1 text-xs text-brand-dark/60">
        în {selected} rate lunare, prin{" "}
        {providers.map((p) => p.label).join(" sau ")}
      </p>

      {/* Finanțatori */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        {providers.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center rounded-lg border border-brand-dark/12 bg-brand-light px-2.5 py-1.5 text-xs font-bold text-brand-dark"
          >
            {p.label}
          </span>
        ))}
      </div>

      {/* Finanțarea nu se poate încă închide singură la checkout, deci trimitem
          explicit spre contact în loc să promitem un pas care nu există. */}
      <LocalizedClientLink
        href="/contact"
        className="mt-3 flex items-center justify-between gap-2 border-t border-brand-dark/10 px-4 py-3 text-xs font-bold text-brand-dark transition-colors hover:bg-brand-light"
      >
        Contactează-ne pentru finanțare
        <ArrowRight size={13} weight="bold" className="text-brand-accent" />
      </LocalizedClientLink>

      {showDetails && (
        <div className="border-t border-brand-dark/10 bg-brand-light/50 px-4 py-3">
          <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-brand-dark/70">
            <li>
              Rata afișată este{" "}
              <span className="font-bold text-brand-dark">orientativă</span> și
              se calculează împărțind prețul produsului la numărul de rate.
            </li>
            <li>
              Suma finală, dobânda și comisioanele sunt stabilite de finanțator
              în funcție de dosarul tău.
            </li>
            <li>
              Finanțarea este supusă aprobării. Scrie-ne și te ajutăm cu
              alegerea băncii și cu dosarul.
            </li>
            {providers.map((p) => (
              <li key={p.id}>
                <span className="font-bold text-brand-dark">{p.label}</span>:
                finanțare între {formatLei(p.minAmount)} și{" "}
                {formatLei(p.maxAmount)}, în {p.terms[0]}–
                {p.terms[p.terms.length - 1]} rate
                {p.dae != null ? `, DAE ${p.dae}%` : ""}.
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default Installments
