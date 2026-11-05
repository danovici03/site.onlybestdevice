"use client"

import { WarningCircle } from "@phosphor-icons/react/dist/ssr"
import { useParams, useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { submitBuybackOrder } from "@lib/data/buyback"
import { matchCounty, RO_COUNTIES } from "@lib/util/counties"
import LocateMeButton from "@modules/common/components/locate-me-button"

import { isValidIban } from "../iban"

const inputClass =
  "w-full rounded-xl border border-brand-dark/15 bg-white px-4 py-3 focus:border-brand-dark focus:outline-none"
const labelClass = "mb-1.5 block text-sm font-semibold text-brand-dark"

/**
 * Datele pentru preluare, după ce clientul a ales cum vrea banii. Suma nu
 * pleacă de aici: backend-ul o ia din oferta semnată (`quoteToken`).
 *
 * CNP-ul și actul nu se cer aici: abia când oferta finală e acceptată, pe
 * pagina preluării (vezi `order-status.tsx`).
 */
export default function SellForm({
  quoteToken,
  payout,
  onSubmitted,
}: {
  quoteToken: string
  payout: "bank" | "voucher"
  onSubmitted: () => void
}) {
  const router = useRouter()
  const { countryCode } = useParams<{ countryCode: string }>()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    delivery_method: "courier" as "courier" | "store",
    county: "",
    city: "",
    street: "",
    postal_code: "",
    iban: "",
    iban_holder: "",
    customer_note: "",
    confirm: false,
  })
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (payout === "bank" && !isValidIban(f.iban)) {
      setError("IBAN-ul nu este valid. Îl găsești în aplicația băncii, la detaliile contului.")
      return
    }
    if (!f.confirm) {
      setError("Bifează confirmarea de la final.")
      return
    }
    startTransition(async () => {
      const res = await submitBuybackOrder({
        quote_token: quoteToken,
        payout_method: payout,
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        delivery_method: f.delivery_method,
        address:
          f.delivery_method === "courier"
            ? { county: f.county, city: f.city.trim(), street: f.street.trim(), postal_code: f.postal_code.trim() || undefined }
            : null,
        iban: payout === "bank" ? f.iban : null,
        iban_holder: payout === "bank" ? f.iban_holder.trim() || null : null,
        customer_note: f.customer_note.trim() || null,
        confirm: true,
      })
      if (!res.ok) {
        setError(res.message)
        return
      }
      onSubmitted()
      router.push(`/${countryCode}/vinde-telefonul/preluare/${res.access_token}?nou=1`)
    })
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-5 rounded-3xl border border-brand-dark/10 p-6">
      <h3 className="text-xl font-bold text-brand-dark">Datele tale</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="bb-first">Prenume</label>
          <input id="bb-first" required autoComplete="given-name" className={inputClass} value={f.first_name} onChange={(e) => set({ first_name: e.target.value })} />
        </div>
        <div>
          <label className={labelClass} htmlFor="bb-last">Nume</label>
          <input id="bb-last" required autoComplete="family-name" className={inputClass} value={f.last_name} onChange={(e) => set({ last_name: e.target.value })} />
        </div>
        <div>
          <label className={labelClass} htmlFor="bb-email">Email</label>
          <input id="bb-email" required type="email" autoComplete="email" className={inputClass} value={f.email} onChange={(e) => set({ email: e.target.value })} />
        </div>
        <div>
          <label className={labelClass} htmlFor="bb-phone">Telefon</label>
          <input id="bb-phone" required type="tel" autoComplete="tel" className={inputClass} value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
        </div>
      </div>

      <div>
        <p className={labelClass}>Cum ne dai telefonul?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["courier", "Îl trimit prin Fan Courier", "Comanzi tu curierul pe site-ul lor, transportul îl plătim noi la primire."],
              ["store", "Îl aduc în magazin", "Vii când îți convine, în program."],
            ] as const
          ).map(([v, l, h]) => (
            <button
              type="button"
              key={v}
              onClick={() => set({ delivery_method: v })}
              className={`rounded-2xl border px-4 py-3 text-left ${
                f.delivery_method === v ? "border-brand-dark ring-1 ring-brand-dark" : "border-brand-dark/15"
              }`}
            >
              <span className="block font-semibold text-brand-dark">{l}</span>
              <span className="text-sm text-brand-dark/60">{h}</span>
            </button>
          ))}
        </div>
      </div>

      {f.delivery_method === "courier" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <p className="-mb-1 text-sm text-brand-dark/60 sm:col-span-2">
            Adresa de unde trimiți coletul. Tot aici ți-l returnăm, dacă nu ajungem la o înțelegere.
          </p>
          <LocateMeButton
            className="sm:col-span-2"
            invite={!f.city && !f.county}
            onResolve={(l) =>
              set({
                city: l.name,
                county: matchCounty(l.county) ?? f.county,
                ...(l.postalCode ? { postal_code: l.postalCode } : {}),
              })
            }
          />
          <div>
            <label className={labelClass} htmlFor="bb-county">Județ</label>
            <select id="bb-county" required className={inputClass} value={f.county} onChange={(e) => set({ county: e.target.value })}>
              <option value="">Alege…</option>
              {RO_COUNTIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="bb-city">Localitate</label>
            <input id="bb-city" required autoComplete="address-level2" className={inputClass} value={f.city} onChange={(e) => set({ city: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="bb-street">Stradă, număr, bloc, apartament</label>
            <input id="bb-street" required autoComplete="street-address" className={inputClass} value={f.street} onChange={(e) => set({ street: e.target.value })} />
          </div>
          <div>
            <label className={labelClass} htmlFor="bb-postal">Cod poștal (opțional)</label>
            <input id="bb-postal" autoComplete="postal-code" inputMode="numeric" className={inputClass} value={f.postal_code} onChange={(e) => set({ postal_code: e.target.value })} />
          </div>
        </div>
      )}

      {payout === "bank" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="bb-iban">IBAN</label>
            <input
              id="bb-iban"
              required
              autoComplete="off"
              placeholder="RO00 XXXX 0000 0000 0000 0000"
              className={`${inputClass} font-mono uppercase`}
              value={f.iban}
              onChange={(e) => set({ iban: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="bb-holder">Titularul contului (dacă nu ești tu)</label>
            <input id="bb-holder" className={inputClass} value={f.iban_holder} onChange={(e) => set({ iban_holder: e.target.value })} />
          </div>
        </div>
      )}


      <div>
        <label className={labelClass} htmlFor="bb-note">Ceva ce ar trebui să știm? (opțional)</label>
        <textarea id="bb-note" rows={3} className={inputClass} value={f.customer_note} onChange={(e) => set({ customer_note: e.target.value })} />
      </div>

      <label className="flex items-start gap-3 text-sm text-brand-dark/80">
        <input type="checkbox" className="mt-1" checked={f.confirm} onChange={(e) => set({ confirm: e.target.checked })} />
        <span>
          Confirm că telefonul îmi aparține, că nu este furat sau blocat pe un cont (iCloud, Google, Samsung) și
          că starea descrisă este corectă. Am citit{" "}
          <a href={`/${countryCode}/vinde-telefonul/termeni`} target="_blank" className="font-semibold underline">
            condițiile de preluare
          </a>{" "}
          și înțeleg că prețul final se confirmă la verificare.
        </span>
      </label>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-brand-dark px-8 py-4 font-semibold text-white transition-colors hover:bg-brand-accent disabled:opacity-50"
      >
        {pending ? "Trimitem…" : "Vinde telefonul"}
      </button>
    </form>
  )
}
