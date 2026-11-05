"use client"

import { CheckCircle, Circle, WarningCircle, XCircle } from "@phosphor-icons/react/dist/ssr"
import { useState, useTransition } from "react"

import { respondBuybackOrder, type BuybackOrderStatus, type PublicBuybackOrder } from "@lib/data/buyback"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { lei, storageLabel } from "../questions"

const STEPS: { key: string; label: string; done: BuybackOrderStatus[] }[] = [
  { key: "submitted", label: "Preluare înregistrată", done: ["submitted", "received", "revised", "accepted", "paid", "declined", "returned"] },
  { key: "received", label: "Telefon primit", done: ["received", "revised", "accepted", "paid", "declined", "returned"] },
  { key: "checked", label: "Verificat", done: ["revised", "accepted", "paid", "declined", "returned"] },
  { key: "paid", label: "Plătit", done: ["paid"] },
]

const HEADLINE: Record<BuybackOrderStatus, string> = {
  submitted: "Așteptăm telefonul",
  received: "Am primit telefonul și îl verificăm",
  revised: "Avem o ofertă nouă pentru tine",
  accepted: "Totul e în regulă — urmează plata",
  paid: "Gata! Ți-am trimis banii",
  declined: "Preluarea nu s-a finalizat",
  returned: "Ți-am trimis telefonul înapoi",
  canceled: "Preluarea a fost anulată",
}

export default function OrderStatus({
  token,
  initial,
  justSubmitted,
}: {
  token: string
  initial: PublicBuybackOrder
  justSubmitted: boolean
}) {
  const [order, setOrder] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const voucher = order.payout_method === "voucher"

  const respond = (accept: boolean) => {
    if (!accept && !window.confirm("Refuzi oferta? Îți trimitem telefonul înapoi.")) return
    setError(null)
    startTransition(async () => {
      const res = await respondBuybackOrder(token, accept)
      if (res.ok) setOrder(res.order)
      else setError(res.message)
    })
  }

  const original = voucher ? order.quoted_voucher_price : order.quoted_price
  const revised = voucher ? order.revised_voucher_price : order.revised_price

  return (
    <div>
      {justSubmitted && (
        <div className="mb-8 flex items-start gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <CheckCircle size={32} weight="fill" className="shrink-0 text-emerald-600" />
          <div>
            <p className="font-bold text-brand-dark">Mulțumim, {order.first_name}! Preluarea #{order.display_id} a fost înregistrată.</p>
            <p className="mt-1 text-sm text-brand-dark/70">
              Ți-am trimis pe email toți pașii. Păstrează emailul: linkul din el te aduce oricând pe această pagină.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs uppercase tracking-widest text-brand-dark/50">Preluarea #{order.display_id}</p>
      <h1 className="mt-2 text-3xl font-bold text-brand-dark md:text-4xl">
        {order.status === "paid" && voucher ? "Gata! Voucherul tău e mai jos" : HEADLINE[order.status]}
      </h1>
      <p className="mt-2 text-brand-dark/60">
        {order.device_name} · {storageLabel(order.storage)}
        {order.color ? ` · ${order.color}` : ""}
      </p>

      {order.status !== "canceled" && (
        <ol className="my-8 grid grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const done = s.done.includes(order.status)
            return (
              <li key={s.key} className="flex flex-col items-center text-center">
                {done ? (
                  <CheckCircle size={28} weight="fill" className="text-emerald-600" />
                ) : (
                  <Circle size={28} className="text-brand-dark/20" />
                )}
                <span className={`mt-1 text-xs ${done ? "font-semibold text-brand-dark" : "text-brand-dark/50"}`}>{s.label}</span>
              </li>
            )
          })}
        </ol>
      )}

      <div className="rounded-3xl bg-brand-dark/[0.04] p-6">
        <p className="text-sm text-brand-dark/60">{voucher ? "Voucher pe Onlybestdevice" : "Transfer bancar"}</p>
        {order.status === "revised" && revised != null ? (
          <p className="mt-1 text-3xl font-bold text-brand-dark">
            {lei(revised)} <span className="text-lg font-normal text-brand-dark/40 line-through">{lei(original)}</span>
          </p>
        ) : (
          <p className="mt-1 text-3xl font-bold text-brand-dark">{lei(order.amount)}</p>
        )}
        {!voucher && order.iban_last4 && (
          <p className="mt-1 text-sm text-brand-dark/60">în contul care se termină în {order.iban_last4}</p>
        )}
        {order.status === "paid" && voucher && order.voucher_code && (
          <div className="mt-4 rounded-2xl border border-dashed border-brand-dark/30 bg-white p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-brand-dark/50">Codul tău</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-brand-dark">{order.voucher_code}</p>
            <p className="mt-2 text-xs text-brand-dark/60">Îl introduci în coș. Se folosește într-o singură comandă, în 12 luni.</p>
          </div>
        )}
      </div>

      {order.customer_message && (
        <p className="mt-4 rounded-2xl border border-brand-dark/10 p-4 text-sm text-brand-dark/80">{order.customer_message}</p>
      )}

      {order.status === "revised" && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            disabled={pending}
            onClick={() => respond(true)}
            className="flex-1 rounded-full bg-brand-dark px-6 py-4 font-semibold text-white hover:bg-brand-accent disabled:opacity-50"
          >
            Accept oferta de {lei(revised ?? 0)}
          </button>
          <button
            disabled={pending}
            onClick={() => respond(false)}
            className="flex-1 rounded-full border border-brand-dark/20 px-6 py-4 font-semibold text-brand-dark hover:border-brand-dark disabled:opacity-50"
          >
            Refuz, vreau telefonul înapoi
          </button>
        </div>
      )}

      {order.status === "submitted" && (
        <div className="mt-6 text-sm text-brand-dark/70">
          {order.delivery_method === "store"
            ? "Adu telefonul în magazin și spune numărul preluării."
            : "Te contactăm în cel mult o zi lucrătoare pentru ridicarea cu curierul. Transportul îl plătim noi."}{" "}
          Înainte: dezactivează „Găsește-mi iPhone-ul” sau contul Google/Samsung și resetează telefonul.
        </div>
      )}

      {order.awb && ["returned", "declined", "submitted"].includes(order.status) && (
        <p className="mt-4 text-sm text-brand-dark/70">
          AWB: <span className="font-mono font-semibold">{order.awb}</span>
        </p>
      )}

      {(order.status === "declined" || order.status === "canceled") && (
        <p className="mt-6 flex items-start gap-2 text-sm text-brand-dark/70">
          {order.status === "declined" ? <WarningCircle size={18} className="mt-0.5" /> : <XCircle size={18} className="mt-0.5" />}
          Ai întrebări? Scrie-ne pe pagina de{" "}
          <LocalizedClientLink href="/contact" className="font-semibold text-brand-accent hover:underline">
            contact
          </LocalizedClientLink>
          .
        </p>
      )}

      {error && (
        <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  )
}
