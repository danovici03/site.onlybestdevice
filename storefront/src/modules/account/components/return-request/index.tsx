"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import AccountCard from "../account-card"
import { createReturnRequest } from "@lib/data/returns"
import { account as t } from "@lib/i18n/account.it"

type SelectedItem = {
  quantity: number
  reason: string
  selected: boolean
}

const ReasonOptions = Object.entries(t.returns.reasons) as Array<
  [keyof typeof t.returns.reasons, string]
>

const ReturnRequestForm = ({
  order,
  countryCode,
}: {
  order: HttpTypes.StoreOrder
  countryCode: string
}) => {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [note, setNote] = useState("")

  const initialItems: Record<string, SelectedItem> = {}
  for (const item of order.items ?? []) {
    initialItems[item.id] = {
      quantity: item.quantity,
      reason: ReasonOptions[0][0],
      selected: false,
    }
  }
  const [items, setItems] = useState(initialItems)

  const update = (id: string, patch: Partial<SelectedItem>) => {
    setItems((s) => ({ ...s, [id]: { ...s[id], ...patch } }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const selected = Object.entries(items).filter(([, v]) => v.selected)
    if (selected.length === 0) {
      setError("Selectează cel puțin un produs de returnat.")
      return
    }

    startTransition(async () => {
      const result = await createReturnRequest(order.id, {
        items: selected.map(([id, v]) => ({
          item_id: id,
          quantity: v.quantity,
          reason: t.returns.reasons[v.reason as keyof typeof t.returns.reasons],
        })),
        note: note.trim() || undefined,
      })

      if (!result.ok) {
        setError(
          result.message === "return_window_expired"
            ? t.returns.windowExpired
            : t.common.error,
        )
        return
      }

      setSuccess(true)
      router.refresh()
    })
  }

  if (success) {
    return (
      <div className="flex flex-col gap-6">
        <LocalizedClientLink
          href={`/account/orders/details/${order.id}`}
          className="inline-flex items-center gap-x-2 text-sm text-brand-dark/60 hover:text-brand-dark w-fit"
        >
          ← {t.orders.detailsTitle} #{order.display_id}
        </LocalizedClientLink>
        <AccountCard>
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-6 text-center">
            <h2 className="font-serif text-2xl text-emerald-800 mb-2">
              {t.returns.submitted}
            </h2>
            <LocalizedClientLink
              href="/account/returns"
              className="inline-flex mt-4 items-center justify-center rounded-full bg-brand-dark text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-accent transition-colors"
            >
              {t.returns.title}
            </LocalizedClientLink>
          </div>
        </AccountCard>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6" data-testid="return-request-page">
      <LocalizedClientLink
        href={`/account/orders/details/${order.id}`}
        className="inline-flex items-center gap-x-2 text-sm text-brand-dark/60 hover:text-brand-dark w-fit"
      >
        ← {t.orders.detailsTitle} #{order.display_id}
      </LocalizedClientLink>

      <header className="px-1">
        <h1 className="font-serif text-3xl small:text-4xl text-brand-dark tracking-tight">
          {t.returns.requestTitle}
        </h1>
        <p className="text-sm text-brand-dark/70 mt-2">
          {t.returns.requestSubtitle}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <AccountCard title={t.returns.selectItems} padded={false}>
          <ul className="divide-y divide-brand-dark/[0.06]">
            {(order.items ?? []).map((item) => {
              const it = items[item.id]
              return (
                <li key={item.id} className="p-4 small:p-6">
                  <div className="flex items-start gap-4">
                    <label className="flex items-center cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-brand-dark/30 text-brand-dark focus:ring-brand-accent"
                        checked={it.selected}
                        onChange={(e) =>
                          update(item.id, { selected: e.target.checked })
                        }
                        data-testid={`return-item-${item.id}`}
                      />
                    </label>
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-brand-light shrink-0">
                      <Thumbnail
                        thumbnail={item.thumbnail}
                        images={[]}
                        size="full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-dark">
                        {item.product_title || item.title}
                      </p>
                      {item.variant_title && (
                        <p className="text-xs text-brand-dark/60">
                          {item.variant_title}
                        </p>
                      )}
                      <p className="text-xs text-brand-dark/60 mt-1">
                        Ordinati: {item.quantity}
                      </p>
                    </div>
                  </div>

                  {it.selected && (
                    <div className="grid grid-cols-1 small:grid-cols-[120px_1fr] gap-3 mt-4 ml-8">
                      <label className="block">
                        <span className="text-xs uppercase tracking-wider text-brand-dark/50 mb-1 block">
                          {t.returns.quantity}
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={item.quantity}
                          value={it.quantity}
                          onChange={(e) =>
                            update(item.id, {
                              quantity: Math.max(
                                1,
                                Math.min(
                                  item.quantity,
                                  Number(e.target.value) || 1,
                                ),
                              ),
                            })
                          }
                          className="w-full rounded-2xl border border-brand-dark/[0.15] bg-white px-3 py-2 text-sm focus:border-brand-dark focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-wider text-brand-dark/50 mb-1 block">
                          {t.returns.reason}
                        </span>
                        <select
                          value={it.reason}
                          onChange={(e) =>
                            update(item.id, { reason: e.target.value })
                          }
                          className="w-full rounded-2xl border border-brand-dark/[0.15] bg-white px-3 py-2 text-sm focus:border-brand-dark focus:outline-none"
                        >
                          {ReasonOptions.map(([key, label]) => (
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
        </AccountCard>

        <AccountCard title={t.returns.note}>
          <textarea
            name="note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Dettagli aggiuntivi sulla richiesta…"
            className="w-full rounded-2xl border border-brand-dark/[0.15] bg-white px-4 py-3 text-sm focus:border-brand-dark focus:outline-none resize-none"
            data-testid="return-note"
          />
        </AccountCard>

        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <LocalizedClientLink
            href={`/account/orders/details/${order.id}`}
            className="rounded-full border border-brand-dark/[0.15] px-5 py-3 text-sm font-medium text-brand-dark/70 hover:bg-brand-dark/[0.05]"
          >
            {t.common.cancel}
          </LocalizedClientLink>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-6 py-3 text-sm font-semibold hover:bg-brand-accent transition-colors disabled:opacity-60"
            data-testid="return-submit"
          >
            {pending ? t.returns.submitting : t.returns.submit}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ReturnRequestForm
