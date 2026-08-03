"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useEffect, useState } from "react"

type Props = {
  paymentUrl?: string
  confirmedHref: string
  displayId?: number
}

/**
 * Ecranul de trecere spre pagina de plată. Redirectul îl face browserul, nu
 * serverul, ca să rămână un buton vizibil dacă navigarea automată e blocată
 * (unele browsere cu protecție agresivă nu urmează redirectul instant).
 */
const PaymentHandoff = ({ paymentUrl, confirmedHref, displayId }: Props) => {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!paymentUrl) return
    // replace, nu href: „înapoi" din pagina băncii nu trebuie să reintre aici.
    window.location.replace(paymentUrl)
    const t = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(t)
  }, [paymentUrl])

  return (
    <div className="content-container flex flex-col items-center justify-center gap-4 py-24 text-center min-h-[60vh]">
      {paymentUrl ? (
        <>
          <span className="h-10 w-10 rounded-full border-[3px] border-brand-dark/15 border-t-brand-dark animate-spin" />
          <h1 className="text-xl font-bold text-brand-dark">
            Te ducem la plata securizată…
          </h1>
          <p className="text-sm text-brand-dark/60 max-w-sm">
            {displayId ? `Comanda #${displayId} este înregistrată. ` : ""}
            Nu închide pagina și nu apăsa înapoi.
          </p>
          {slow && (
            <a
              href={paymentUrl}
              className="mt-2 rounded-full bg-brand-dark px-6 py-3 text-sm font-bold text-white hover:bg-brand-accent transition-colors"
            >
              Deschide pagina de plată
            </a>
          )}
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-brand-dark">
            Nu am putut deschide plata
          </h1>
          <p className="text-sm text-brand-dark/60 max-w-sm">
            Comanda {displayId ? `#${displayId} ` : ""}este înregistrată, dar
            pagina de plată nu a putut fi pregătită. Te contactăm noi pentru
            reluarea plății.
          </p>
          <LocalizedClientLink
            href={confirmedHref.replace(/^\/[^/]+/, "")}
            className="mt-2 rounded-full bg-brand-dark px-6 py-3 text-sm font-bold text-white hover:bg-brand-accent transition-colors"
          >
            Vezi comanda
          </LocalizedClientLink>
        </>
      )}
    </div>
  )
}

export default PaymentHandoff
