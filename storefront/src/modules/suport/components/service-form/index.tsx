"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { CheckCircle, Truck, WarningCircle } from "@phosphor-icons/react/dist/ssr"

import { sendServiceRequest, type ServiceState } from "@lib/data/service"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { stepCtaClass } from "@modules/suport/components/step-card"
import { COURIER_PICKUP_URL } from "@lib/util/shipping-tariff"

const initialState: ServiceState = { ok: false, message: "" }

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-brand-dark/15 bg-white focus:outline-none focus:border-brand-dark transition-colors"

const labelClass = "block text-sm font-semibold text-brand-dark mb-1.5"

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null
  return (
    <p className="text-xs text-red-600 mt-1" role="alert">
      {errors[0]}
    </p>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full md:w-auto px-8 py-3.5 rounded-full bg-brand-dark text-white font-semibold hover:bg-brand-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Se trimite…" : "Trimite cererea de service"}
    </button>
  )
}

export default function ServiceForm() {
  const [state, formAction] = useActionState(sendServiceRequest, initialState)

  // După trimitere urmează pasul 2 din pagina de garanție: chemarea curierului.
  if (state.ok) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8">
        <CheckCircle
          size={48}
          weight="fill"
          className="text-emerald-600 mb-4"
        />
        <h3 className="text-xl font-bold text-brand-dark mb-2">
          Am primit cererea ta de service
        </h3>
        <p className="text-brand-dark/70 mb-6">{state.message}</p>
        <p className="text-brand-dark/70 mb-6 text-sm">
          Pasul următor: cheamă curierul să ridice produsul de la tine, cu plata
          taxei de transport la destinatar. Printează sau notează datele
          cererii și pune-le în colet, împreună cu o copie a facturii.
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

  const fe = state.fieldErrors

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.message && !state.ok && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <WarningCircle size={20} weight="fill" className="shrink-0 mt-0.5" />
          <span>{state.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label htmlFor="nume" className={labelClass}>
            Nume și prenume <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="nume"
            name="nume"
            required
            autoComplete="name"
            className={inputClass}
          />
          <FieldError errors={fe?.nume} />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            autoComplete="email"
            className={inputClass}
          />
          <FieldError errors={fe?.email} />
        </div>

        <div>
          <label htmlFor="telefon" className={labelClass}>
            Telefon <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="telefon"
            name="telefon"
            required
            autoComplete="tel"
            className={inputClass}
          />
          <FieldError errors={fe?.telefon} />
        </div>

        <div>
          <label htmlFor="numarComanda" className={labelClass}>
            Număr comandă sau factură <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="numarComanda"
            name="numarComanda"
            required
            className={inputClass}
          />
          <FieldError errors={fe?.numarComanda} />
        </div>

        <div>
          <label htmlFor="produs" className={labelClass}>
            Produsul trimis în service <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="produs"
            name="produs"
            required
            placeholder="ex. iPhone 15 Pro 256 GB"
            className={inputClass}
          />
          <FieldError errors={fe?.produs} />
        </div>

        <div>
          <label htmlFor="serie" className={labelClass}>
            Serie / IMEI (dacă îl ai la îndemână)
          </label>
          <input type="text" id="serie" name="serie" className={inputClass} />
          <FieldError errors={fe?.serie} />
        </div>
      </div>

      <div>
        <label htmlFor="problema" className={labelClass}>
          Descrierea problemei <span className="text-red-500">*</span>
        </label>
        <textarea
          id="problema"
          name="problema"
          required
          rows={6}
          minLength={10}
          maxLength={5000}
          placeholder="Când apare defectul, ce ai încercat, dacă produsul a fost lovit sau a luat contact cu lichide."
          className={`${inputClass} resize-y`}
        />
        <FieldError errors={fe?.problema} />
      </div>

      <div>
        <label htmlFor="adresaRetur" className={labelClass}>
          Adresa la care dorești să primești aparatul reparat{" "}
          <span className="text-red-500">*</span>
        </label>
        <textarea
          id="adresaRetur"
          name="adresaRetur"
          required
          rows={3}
          maxLength={400}
          autoComplete="street-address"
          className={`${inputClass} resize-y`}
        />
        <FieldError errors={fe?.adresaRetur} />
      </div>

      <div>
        <label htmlFor="codAcces" className={labelClass}>
          Cod de acces / date de deblocare
        </label>
        <input
          type="text"
          id="codAcces"
          name="codAcces"
          className={inputClass}
        />
        <p className="text-xs text-brand-dark/50 mt-1.5">
          Completează doar dacă nu poți reseta aparatul sau dezactiva „find my
          phone/iPhone". Fără acces, service-ul nu poate testa aparatul.
        </p>
        <FieldError errors={fe?.codAcces} />
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-brand-dark/[0.03] p-4">
        <input
          type="checkbox"
          id="resetatConfirmat"
          name="resetatConfirmat"
          required
          className="mt-1 w-4 h-4 accent-brand-dark shrink-0"
        />
        <label
          htmlFor="resetatConfirmat"
          className="text-sm text-brand-dark/80 leading-relaxed"
        >
          Aparatul este resetat, fără conturi active, modele sau coduri de
          deblocare (inclusiv „find my phone/iPhone"), ori am completat mai sus
          codul de acces. Trimit produsul cu toate accesoriile originale și o
          copie a facturii. <span className="text-red-500">*</span>
        </label>
      </div>
      <FieldError errors={fe?.resetatConfirmat} />

      <div className="flex items-start gap-3 rounded-2xl bg-brand-dark/[0.03] p-4">
        <input
          type="checkbox"
          id="consensoPrivacy"
          name="consensoPrivacy"
          required
          className="mt-1 w-4 h-4 accent-brand-dark shrink-0"
        />
        <label
          htmlFor="consensoPrivacy"
          className="text-sm text-brand-dark/80 leading-relaxed"
        >
          Am citit și accept{" "}
          <LocalizedClientLink
            href="/confidentialitate"
            className="text-brand-accent hover:underline"
          >
            politica de confidențialitate
          </LocalizedClientLink>{" "}
          și sunt de acord cu prelucrarea datelor mele pentru rezolvarea cererii
          de service (art. 13 GDPR). <span className="text-red-500">*</span>
        </label>
      </div>
      <FieldError errors={fe?.consensoPrivacy} />

      {/* Honeypot — ascuns pentru oameni, atractiv pentru boți. Lasă gol. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Site web (nu completa)</label>
        <input
          type="text"
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  )
}
