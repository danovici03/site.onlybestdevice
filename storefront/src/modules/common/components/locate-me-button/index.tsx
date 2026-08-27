"use client"

import { clx } from "@medusajs/ui"
import { CircleNotch, CrosshairSimple } from "@phosphor-icons/react/dist/ssr"
import { useState } from "react"

import type { LocalitySuggestion } from "@modules/common/components/locality-select"

type LocateMeButtonProps = {
  /** Primește localitatea găsită: nume oficial, județ și cod poștal. */
  onResolve: (locality: LocalitySuggestion) => void
  className?: string
}

const MESSAGES = {
  unsupported: "Browserul tău nu poate detecta locația. Completează manual.",
  denied: "Ai blocat accesul la locație. Completează câmpurile manual.",
  unavailable:
    "Nu am putut afla locația. Încearcă din nou sau completează manual.",
  outside_ro: "Locația ta pare a fi în afara României.",
  not_found: "Nu am recunoscut localitatea. Completează manual.",
  upstream: "Serviciul de localizare nu răspunde. Încearcă mai târziu.",
} as const

/**
 * „Detectează locația mea" — coordonatele din browser, trecute prin
 * `/api/geo/reverse`, completează localitatea, județul și codul poștal.
 *
 * Am ales GPS-ul în locul geolocalizării după IP fiindcă în România IP-urile
 * de consumer (Digi, Vodafone, Orange mobil) ies aproape toate în București,
 * indiferent unde e clientul — o precompletare care arată corectă și nu e.
 *
 * Butonul nu cere nimic până nu e apăsat: permisiunea de locație cerută la
 * încărcarea paginii e refuzată de reflex de majoritatea vizitatorilor.
 */
const LocateMeButton = ({ onResolve, className }: LocateMeButtonProps) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locate = () => {
    setError(null)

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError(MESSAGES.unsupported)
      return
    }

    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `/api/geo/reverse?lat=${coords.latitude}&lon=${coords.longitude}`
          )
          const data = await res.json()

          if (data?.error) {
            setError(
              MESSAGES[data.error as keyof typeof MESSAGES] ??
                MESSAGES.unavailable
            )
            return
          }

          onResolve({
            name: data.name ?? "",
            county: data.county ?? "",
            postalCode: data.postalCode ?? "",
          })
        } catch {
          setError(MESSAGES.upstream)
        } finally {
          setBusy(false)
        }
      },
      (err) => {
        setBusy(false)
        setError(
          err.code === err.PERMISSION_DENIED
            ? MESSAGES.denied
            : MESSAGES.unavailable
        )
      },
      // `maximumAge` acceptă o poziție de până la 5 minute: cine apasă de două
      // ori nu mai așteaptă încă o dată fix-ul GPS.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  }

  return (
    <div className={clx("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-brand-dark/70 hover:text-brand-dark disabled:opacity-60 transition-colors"
        data-testid="locate-me-button"
      >
        {busy ? (
          <CircleNotch size={14} weight="bold" className="animate-spin" />
        ) : (
          <CrosshairSimple size={14} weight="bold" />
        )}
        {busy ? "Se detectează…" : "Detectează locația mea"}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}

export default LocateMeButton
