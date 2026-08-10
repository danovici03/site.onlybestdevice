"use client"

/**
 * Selectorul de finanțatori din coș: titlu „Cumpără în rate" + câte un rând
 * expandabil pe finanțator. Fiecare rând deschide calculatorul de rate
 * (`Installments` în modul embedded, fixat pe finanțatorul lui). Rândul TBI
 * rămâne descriptiv cât timp providerul nu e activ pe regiune.
 */

import {
  Financier,
  TBI_MAX,
  TBI_MIN,
  availableTerms,
  formatLei,
  lowestOffer,
  supportsInstallments,
} from "@lib/util/installments"
import { clx } from "@medusajs/ui"
import {
  TbiBadge,
  UniCreditBadge,
} from "@modules/checkout/components/payment-badges"
import Installments from "@modules/products/components/installments"
import { CaretDown, CreditCard } from "@phosphor-icons/react/dist/ssr"
import { useState } from "react"

type FinancingOptionsProps = {
  /** Totalul coșului în unitatea majoră (lei). */
  amount: number
  currency?: string
  /**
   * Providerul TBI e activ pe regiune. Vine din lista reală de metode de plată
   * (cart/page.tsx), ca textul să nu promită „în curând” după ce l-am activat,
   * nici să anunțe disponibil un provider oprit.
   */
  tbiAvailable?: boolean
}

type Provider = Financier

const FinancingOptions = ({
  amount,
  currency,
  tbiAvailable = false,
}: FinancingOptionsProps) => {
  // Deschis implicit pe finanțatorul cu rata cea mai mică pentru coșul
  // curent. Se evaluează doar la montare — un coș modificat între timp nu
  // sare peste alegerea clientului.
  const [open, setOpen] = useState<Provider | null>(
    () =>
      lowestOffer(amount, tbiAvailable ? ["ucfin", "tbi"] : ["ucfin"])
        ?.financier ?? "ucfin"
  )

  if (!supportsInstallments(currency)) return null

  const hasUcfin = availableTerms("ucfin", amount).length > 0
  const hasTbiTerms = availableTerms("tbi", amount).length > 0
  const tbiTeaser = tbiAvailable ? lowestOffer(amount, ["tbi"]) : null
  const ucfinTeaser = lowestOffer(amount, ["ucfin"])

  const toggle = (p: Provider) => setOpen((cur) => (cur === p ? null : p))

  const rowClass = (active: boolean) =>
    clx(
      "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
      active ? "bg-brand-light/60" : "hover:bg-brand-light/40"
    )

  return (
    <section
      id="plata-in-rate"
      aria-label="Cumpără în rate"
      className="scroll-mt-28 bg-white rounded-3xl p-5 lg:p-6 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-4">
        <CreditCard size={18} weight="fill" className="text-brand-accent" />
        <h2 className="font-serif text-2xl text-brand-dark leading-tight">
          Cumpără în rate
        </h2>
      </div>

      <div className="rounded-2xl border border-brand-dark/10 overflow-hidden divide-y divide-brand-dark/10">
        {hasUcfin && (
          <div>
            <button
              type="button"
              onClick={() => toggle("ucfin")}
              aria-expanded={open === "ucfin"}
              className={rowClass(open === "ucfin")}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-brand-dark">
                  UniCredit Consumer Financing
                </span>
                <span className="block text-xs text-brand-dark/55 mt-0.5">
                  {ucfinTeaser
                    ? `De la ${formatLei(ucfinTeaser.monthly)}/lună · răspuns în maximum 15 minute`
                    : "Credit online, răspuns în maximum 15 minute"}
                </span>
              </span>
              <UniCreditBadge />
              <CaretDown
                size={14}
                weight="bold"
                className={clx(
                  "shrink-0 text-brand-dark/40 transition-transform",
                  open === "ucfin" && "rotate-180"
                )}
              />
            </button>
            {open === "ucfin" && (
              <div className="border-t border-brand-dark/10">
                <Installments
                  amount={amount}
                  currency={currency}
                  financier="ucfin"
                  compact
                  embedded
                />
              </div>
            )}
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => toggle("tbi")}
            aria-expanded={open === "tbi"}
            className={rowClass(open === "tbi")}
          >
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 text-sm font-bold text-brand-dark">
                TBI Bank
                {!tbiAvailable && (
                  <span className="rounded-full bg-brand-dark/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark/60">
                    în curând
                  </span>
                )}
              </span>
              <span className="block text-xs text-brand-dark/55 mt-0.5">
                {tbiTeaser
                  ? `De la ${formatLei(tbiTeaser.monthly)}/lună · fără card de credit`
                  : "Plată în rate 100% online"}
              </span>
            </span>
            <TbiBadge />
            <CaretDown
              size={14}
              weight="bold"
              className={clx(
                "shrink-0 text-brand-dark/40 transition-transform",
                open === "tbi" && "rotate-180"
              )}
            />
          </button>
          {open === "tbi" &&
            (tbiAvailable && hasTbiTerms ? (
              <div className="border-t border-brand-dark/10">
                <Installments
                  amount={amount}
                  currency={currency}
                  financier="tbi"
                  compact
                  embedded
                />
              </div>
            ) : (
              <div className="border-t border-brand-dark/10 px-4 py-3 text-xs leading-relaxed text-brand-dark/70">
                {!tbiAvailable ? (
                  <>
                    În curând vei putea plăti în rate și prin TBI Bank: aplici
                    online direct din finalizarea comenzii, iar aprobarea vine
                    în câteva minute. Ratele, dobânda și DAE se calculează și se
                    afișează pe pagina securizată TBI Bank, înainte de semnarea
                    contractului.
                  </>
                ) : (
                  <>
                    Valoarea coșului este în afara sumelor finanțabile de TBI
                    Bank ({formatLei(TBI_MIN)} – {formatLei(TBI_MAX)}). Alegi
                    „TBI Bank” la finalizarea comenzii doar pentru comenzi din
                    acest interval.
                  </>
                )}
              </div>
            ))}
        </div>
      </div>
    </section>
  )
}

export default FinancingOptions
