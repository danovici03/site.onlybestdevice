"use client"

import { ArrowSquareOut, Check, Copy } from "@phosphor-icons/react/dist/ssr"
import { useState, useTransition } from "react"

import { submitBuybackAwb, type PublicBuybackOrder } from "@lib/data/buyback"

const inputClass =
  "w-full rounded-xl border border-brand-dark/15 bg-white px-4 py-3 font-mono uppercase focus:border-brand-dark focus:outline-none"

/**
 * Clientul își comandă singur curierul la Fan Courier, cu plata la
 * destinatar, și ne lasă AWB-ul aici. Noi nu mai sunăm și nu mai facem AWB.
 */
export default function CourierSteps({
  token,
  order,
  onChange,
}: {
  token: string
  order: PublicBuybackOrder
  onChange: (o: PublicBuybackOrder) => void
}) {
  const c = order.courier!
  const [awb, setAwb] = useState(order.awb ?? "")
  const [editing, setEditing] = useState(!order.awb)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  const recipient = [c.recipient, c.address, c.phone ? `tel. ${c.phone}` : ""].filter(Boolean).join(", ")

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recipient)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await submitBuybackAwb(token, awb)
      if (!res.ok) return setError(res.message)
      onChange(res.order)
      setEditing(false)
    })
  }

  return (
    <div className="mt-6 rounded-3xl border border-brand-dark/10 p-6">
      <h2 className="text-xl font-bold text-brand-dark">Trimite telefonul prin Fan Courier</h2>
      <p className="mt-1 text-sm text-brand-dark/60">Comanzi tu curierul, în 2 minute. Transportul îl plătim noi, la primire.</p>

      <ol className="mt-5 flex flex-col gap-4 text-sm text-brand-dark/80">
        <li>
          <span className="font-semibold text-brand-dark">1. Comandă curierul pe site-ul Fan Courier.</span>
          <a
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex w-fit items-center gap-2 rounded-full bg-brand-dark px-5 py-2.5 font-semibold text-white hover:bg-brand-accent"
          >
            Deschide Fan Courier <ArrowSquareOut size={16} />
          </a>
        </li>
        <li>
          <span className="font-semibold text-brand-dark">2. La destinatar scrie:</span>
          <span className="mt-2 flex items-start justify-between gap-3 rounded-2xl bg-brand-dark/[0.04] p-4">
            <span>{recipient}</span>
            <button type="button" onClick={copy} className="shrink-0 text-brand-dark/60 hover:text-brand-dark" aria-label="Copiază adresa">
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </span>
        </li>
        <li>
          <span className="font-semibold text-brand-dark">3. La plata transportului alege „Destinatar”.</span> Nu pune ramburs.
        </li>
        <li>
          <span className="font-semibold text-brand-dark">4. În observații scrie „Preluare #{order.display_id}”.</span>
        </li>
        <li>
          <span className="font-semibold text-brand-dark">5. Trece aici numărul AWB</span>, ca să urmărim coletul.
          {editing ? (
            <form onSubmit={save} className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                aria-label="Numărul AWB"
                required
                autoComplete="off"
                placeholder="ex. 2XXXXXXXXXXX"
                className={inputClass}
                value={awb}
                onChange={(e) => setAwb(e.target.value)}
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-brand-dark px-6 py-3 font-semibold text-white hover:bg-brand-accent disabled:opacity-50"
              >
                {pending ? "Salvăm…" : "Salvează"}
              </button>
            </form>
          ) : (
            <span className="mt-2 flex items-center gap-3">
              <span className="font-mono font-semibold text-brand-dark">{order.awb}</span>
              <button type="button" onClick={() => setEditing(true)} className="text-brand-accent underline">
                Schimbă
              </button>
            </span>
          )}
          {error && (
            <span role="alert" className="mt-2 block text-red-700">
              {error}
            </span>
          )}
        </li>
      </ol>
    </div>
  )
}
