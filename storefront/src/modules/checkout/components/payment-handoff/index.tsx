"use client"

import { createNetopiaPaymentSession } from "@lib/data/orders"
import {
  submitNetopiaForm,
  type NetopiaHandoffFields,
} from "@lib/util/netopia-form"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useEffect, useRef, useState } from "react"

type Props = {
  orderId: string
  confirmedHref: string
  displayId?: number
}

const goToBank = (fields: NetopiaHandoffFields) => {
  if ("redirect_url" in fields) {
    // replace, nu href: „înapoi" din pagina băncii nu trebuie să reintre aici.
    window.location.replace(fields.redirect_url)
    return
  }
  // Netopia v1 nu are link vizitabil — plata se deschide doar prin form POST.
  submitNetopiaForm(fields.payment_url, fields.env_key, fields.data)
}

/**
 * Ecranul de trecere spre pagina de plată.
 *
 * Sesiunea de plată se deschide de aici, o SINGURĂ dată per montare (`started`).
 * Două motive pentru care nu se deschide în randarea paginii: e o mutație —
 * consumă o sesiune Netopia și incrementează contorul de încercări al comenzii
 * — iar pagina e publică, deci orice reîmprospătare sau navigare înapoi ar
 * repeta-o. Guardul e un ref, nu o dependență de efect: un obiect nou din
 * re-randare ar reporni efectul și ar trimite clientul a doua oară.
 */
const PaymentHandoff = ({ orderId, confirmedHref, displayId }: Props) => {
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [slow, setSlow] = useState(false)
  const [fields, setFields] = useState<NetopiaHandoffFields | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let alive = true
    const timer = setTimeout(() => alive && setSlow(true), 6000)

    createNetopiaPaymentSession(orderId).then((result) => {
      if (!alive) return
      if ("error" in result) {
        setError(result.error)
        return
      }
      setFields(result.fields)
      goToBank(result.fields)
    })

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [orderId])

  if (error) {
    return (
      <div className="content-container flex flex-col items-center justify-center gap-4 py-24 text-center min-h-[60vh]">
        <h1 className="text-xl font-bold text-brand-dark">
          Nu am putut deschide plata
        </h1>
        <p className="text-sm text-brand-dark/60 max-w-sm">{error}</p>
        <LocalizedClientLink
          href={confirmedHref.replace(/^\/[^/]+/, "")}
          className="mt-2 rounded-full bg-brand-dark px-6 py-3 text-sm font-bold text-white hover:bg-brand-accent transition-colors"
        >
          Vezi comanda
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div className="content-container flex flex-col items-center justify-center gap-4 py-24 text-center min-h-[60vh]">
      <span className="h-10 w-10 rounded-full border-[3px] border-brand-dark/15 border-t-brand-dark animate-spin" />
      <h1 className="text-xl font-bold text-brand-dark">
        Te ducem la plata securizată…
      </h1>
      <p className="text-sm text-brand-dark/60 max-w-sm">
        {displayId ? `Comanda #${displayId} este înregistrată. ` : ""}
        Nu închide pagina și nu apăsa înapoi.
      </p>
      {slow && fields && (
        <button
          type="button"
          onClick={() => goToBank(fields)}
          className="mt-2 rounded-full bg-brand-dark px-6 py-3 text-sm font-bold text-white hover:bg-brand-accent transition-colors"
        >
          Deschide pagina de plată
        </button>
      )}
    </div>
  )
}

export default PaymentHandoff
