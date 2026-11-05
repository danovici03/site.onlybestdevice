"use client"

import { useState, useTransition } from "react"

import { submitBuybackIdentity, type PublicBuybackOrder } from "@lib/data/buyback"

import { isValidCnp } from "../cnp"

const inputClass =
  "w-full rounded-xl border border-brand-dark/15 bg-white px-4 py-3 focus:border-brand-dark focus:outline-none"
const labelClass = "mb-1.5 block text-sm font-semibold text-brand-dark"

/**
 * Datele pentru borderoul de achiziție. Le cerem abia după ce oferta finală
 * e acceptată: cine primește refuz la verificare nu ni le dă niciodată.
 */
export default function IdentityForm({
  token,
  onChange,
}: {
  token: string
  onChange: (o: PublicBuybackOrder) => void
}) {
  const [f, setF] = useState({ cnp: "", id_document: "", home_address: "" })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isValidCnp(f.cnp)) {
      setError("CNP-ul nu este valid. Verifică cele 13 cifre din buletin.")
      return
    }
    if (!/^[A-Za-z]{1,3}\s*\d{6,9}$/.test(f.id_document.trim())) {
      setError("Scrie seria și numărul buletinului, de exemplu „RX 123456”.")
      return
    }
    startTransition(async () => {
      const res = await submitBuybackIdentity(token, {
        cnp: f.cnp.replace(/\s+/g, ""),
        id_document: f.id_document.trim(),
        home_address: f.home_address.trim(),
      })
      if (!res.ok) return setError(res.message)
      onChange(res.order)
    })
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4 rounded-3xl border border-brand-dark/10 p-6">
      <div>
        <h2 className="text-xl font-bold text-brand-dark">Un ultim pas: datele pentru act</h2>
        <p className="mt-1 text-sm text-brand-dark/60">
          Când cumpărăm de la o persoană fizică, legea ne cere un borderou de achiziție cu datele din buletin. Le
          folosim doar pentru acest act; nu apar în emailuri. Plata pleacă după ce le primim.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="bb-cnp">CNP</label>
          <input
            id="bb-cnp"
            required
            inputMode="numeric"
            autoComplete="off"
            maxLength={16}
            className={`${inputClass} font-mono`}
            value={f.cnp}
            onChange={(e) => set({ cnp: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="bb-ci">Seria și numărul buletinului</label>
          <input
            id="bb-ci"
            required
            autoComplete="off"
            placeholder="RX 123456"
            className={`${inputClass} uppercase`}
            value={f.id_document}
            onChange={(e) => set({ id_document: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="bb-home">Adresa de domiciliu (ca în buletin)</label>
          <input
            id="bb-home"
            required
            minLength={5}
            className={inputClass}
            value={f.home_address}
            onChange={(e) => set({ home_address: e.target.value })}
          />
        </div>
      </div>
      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-brand-dark px-8 py-4 font-semibold text-white hover:bg-brand-accent disabled:opacity-50"
      >
        {pending ? "Trimitem…" : "Trimite datele"}
      </button>
    </form>
  )
}
