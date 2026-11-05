"use client"

import { useState, useTransition } from "react"
import { CheckCircle, Truck, WarningCircle } from "@phosphor-icons/react/dist/ssr"

import {
  createGuestReturnRequest,
  lookupReturnableOrder,
  type ReturnErrorCode,
  type ReturnableOrder,
} from "@lib/data/returns"
import { account as t } from "@lib/i18n/account.it"
import {
  groupWarrantyLines,
  isWarrantyLine,
  warrantyTargetTitle,
} from "@lib/util/warranty"
import { COURIER_PICKUP_URL } from "@lib/util/shipping-tariff"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { stepCtaClass } from "@modules/suport/components/step-card"

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-brand-dark/15 bg-white focus:outline-none focus:border-brand-dark transition-colors"
const labelClass = "block text-sm font-semibold text-brand-dark mb-1.5"
const buttonClass =
  "w-full md:w-auto px-8 py-3.5 rounded-full bg-brand-dark text-white font-semibold hover:bg-brand-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"

const REASONS = Object.entries(t.returns.reasons) as Array<
  [keyof typeof t.returns.reasons, string]
>

const ERRORS: Record<ReturnErrorCode, string> = {
  return_window_expired: t.returns.windowExpired,
  already_requested: t.returns.alreadyRequested,
  order_not_found: t.returns.orderNotFound,
  too_many_attempts: t.returns.tooManyAttempts,
  order_canceled: t.returns.orderCanceled,
  missing_fields: t.returns.missingFields,
  return_error: t.common.error,
}

type Line = { selected: boolean; quantity: number; reason: string }

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <WarningCircle size={20} weight="fill" className="shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}

/**
 * Cererea de retur fără cont: comanda se găsește după număr + email, apoi
 * clientul alege produsele. Cererea ajunge în admin la „Cereri retur”, la fel
 * ca cele trimise din cont.
 */
export default function ReturnForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [displayId, setDisplayId] = useState("")
  const [email, setEmail] = useState("")
  const [order, setOrder] = useState<ReturnableOrder | null>(null)
  const [lines, setLines] = useState<Record<string, Line>>({})
  const [phone, setPhone] = useState("")
  const [note, setNote] = useState("")
  const [done, setDone] = useState(false)

  const lookup = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!displayId.trim() || !email.trim()) {
      setError("Completează numărul comenzii și emailul.")
      return
    }
    startTransition(async () => {
      const res = await lookupReturnableOrder({
        display_id: displayId.trim(),
        email: email.trim(),
      })
      if (!res.ok) {
        setError(ERRORS[res.message])
        return
      }
      if (!res.order.return_window_open) {
        setError(t.returns.windowExpired)
        return
      }
      const initial: Record<string, Line> = {}
      for (const it of res.order.items) {
        initial[it.id] = {
          selected: false,
          quantity: Math.max(1, it.returnable_quantity),
          reason: REASONS[0][0],
        }
      }
      setLines(initial)
      setOrder(res.order)
    })
  }

  const update = (id: string, patch: Partial<Line>) =>
    setLines((s) => ({ ...s, [id]: { ...s[id], ...patch } }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const selected = Object.entries(lines).filter(([, l]) => l.selected)
    if (selected.length === 0) {
      setError("Selectează cel puțin un produs de returnat.")
      return
    }
    startTransition(async () => {
      const res = await createGuestReturnRequest({
        display_id: displayId.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        note: note.trim() || undefined,
        items: selected.map(([id, l]) => ({
          item_id: id,
          quantity: l.quantity,
          reason: t.returns.reasons[l.reason as keyof typeof t.returns.reasons],
        })),
      })
      if (!res.ok) {
        setError(ERRORS[res.message ?? "return_error"])
        return
      }
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8">
        <CheckCircle size={48} weight="fill" className="text-emerald-600 mb-4" />
        <h3 className="text-xl font-bold text-brand-dark mb-2">
          Am primit cererea ta de retur
        </h3>
        <p className="text-brand-dark/70 mb-4">
          Ți-am trimis confirmarea pe email. Echipa noastră o preia în maximum
          48 de ore.
        </p>
        <p className="text-brand-dark/70 mb-6 text-sm">
          Pasul următor: cheamă curierul să ridice coletul de la tine, cu plata
          transportului la expeditor (costul este suportat de tine). Pune în colet numele tău, numărul
          comenzii (#{order?.display_id}) și motivul returului.
        </p>
        <a
          href={COURIER_PICKUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={stepCtaClass}
        >
          <Truck size={18} weight="bold" />
          Cheamă un curier acum
        </a>
      </div>
    )
  }

  if (!order) {
    return (
      <form onSubmit={lookup} className="space-y-6" noValidate>
        {error && <ErrorBox message={error} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="rr-order" className={labelClass}>
              Număr comandă <span className="text-red-500">*</span>
            </label>
            <input
              id="rr-order"
              inputMode="numeric"
              placeholder="ex. 1234"
              value={displayId}
              onChange={(e) => setDisplayId(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="rr-email" className={labelClass}>
              Emailul folosit la comandă <span className="text-red-500">*</span>
            </label>
            <input
              id="rr-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          </div>
        </div>
        <p className="text-sm text-brand-dark/60">
          Numărul comenzii îl găsești în emailul de confirmare. Ai cont?{" "}
          <LocalizedClientLink href="/account/orders" className="underline">
            Trimite cererea din contul tău
          </LocalizedClientLink>
          .
        </p>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Se caută…" : "Caută comanda"}
        </button>
      </form>
    )
  }

  const items = groupWarrantyLines(order.items)
  const anyReturnable = items.some((i) => i.returnable_quantity > 0)

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-brand-dark font-semibold">
          Comanda #{order.display_id}
        </p>
        <button
          type="button"
          onClick={() => {
            setOrder(null)
            setError(null)
          }}
          className="text-sm text-brand-dark/60 underline"
        >
          Altă comandă
        </button>
      </div>

      <ul className="divide-y divide-brand-dark/[0.06] rounded-3xl border border-brand-dark/10">
        {items.map((item) => {
          const line = lines[item.id]
          const disabled = item.returnable_quantity === 0
          return (
            <li key={item.id} className="p-4 md:p-5">
              <label
                className={`flex items-start gap-4 ${disabled ? "opacity-50" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  className="mt-1 w-4 h-4 rounded border-brand-dark/30"
                  checked={line?.selected ?? false}
                  disabled={disabled}
                  onChange={(e) => update(item.id, { selected: e.target.checked })}
                />
                {isWarrantyLine(item) ? (
                  <div className="w-14 shrink-0" aria-hidden />
                ) : (
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-brand-light shrink-0">
                    <Thumbnail thumbnail={item.thumbnail} images={[]} size="full" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-dark">{item.title}</p>
                  {item.variant_title && item.variant_title !== item.title && (
                    <p className="text-xs text-brand-dark/60">{item.variant_title}</p>
                  )}
                  {warrantyTargetTitle(item) && (
                    <p className="text-xs text-brand-dark/60">
                      pentru {warrantyTargetTitle(item)}
                    </p>
                  )}
                  <p className="text-xs text-brand-dark/60 mt-1">
                    {disabled
                      ? t.returns.nothingLeft
                      : `Comandate: ${item.quantity}`}
                  </p>
                </div>
              </label>

              {line?.selected && (
                <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-3 mt-4 md:ml-8">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-brand-dark/50 mb-1 block">
                      {t.returns.quantity}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={item.returnable_quantity}
                      value={line.quantity}
                      onChange={(e) =>
                        update(item.id, {
                          quantity: Math.max(
                            1,
                            Math.min(item.returnable_quantity, Number(e.target.value) || 1),
                          ),
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-brand-dark/50 mb-1 block">
                      {t.returns.reason}
                    </span>
                    <select
                      value={line.reason}
                      onChange={(e) => update(item.id, { reason: e.target.value })}
                      className={inputClass}
                    >
                      {REASONS.map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label htmlFor="rr-phone" className={labelClass}>
            Telefon (opțional)
          </label>
          <input
            id="rr-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Dacă e altul decât cel din comandă"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="rr-note" className={labelClass}>
          Detalii (opțional)
        </label>
        <textarea
          id="rr-note"
          rows={4}
          maxLength={4000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ce s-a întâmplat cu produsul, dacă ambalajul e desfăcut etc."
          className={`${inputClass} resize-y`}
        />
      </div>

      {error && <ErrorBox message={error} />}

      <button type="submit" disabled={pending || !anyReturnable} className={buttonClass}>
        {pending ? t.returns.submitting : t.returns.submit}
      </button>
    </form>
  )
}
