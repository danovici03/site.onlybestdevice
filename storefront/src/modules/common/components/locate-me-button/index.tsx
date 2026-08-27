"use client"

import { clx } from "@medusajs/ui"
import {
  CircleNotch,
  CrosshairSimple,
  MapPin,
} from "@phosphor-icons/react/dist/ssr"
import { useEffect, useRef, useState } from "react"

import type { LocalitySuggestion } from "@modules/common/components/locality-select"

type LocateMeButtonProps = {
  /** Primește localitatea găsită: nume oficial, județ și cod poștal. */
  onResolve: (locality: LocalitySuggestion) => void
  /**
   * Adresa e încă goală. Atunci arătăm cardul care explică la ce folosește
   * permisiunea și, dacă vizitatorul a dat-o deja altă dată, completăm singuri.
   * Când devine `false`, rămâne doar butonul discret.
   */
  invite?: boolean
  className?: string
}

const MESSAGES = {
  unsupported: "Browserul tău nu poate detecta locația. Completează manual.",
  unavailable:
    "Nu am putut afla locația. Încearcă din nou sau completează manual.",
  outside_ro: "Locația ta pare a fi în afara României.",
  not_found: "Nu am recunoscut localitatea. Completează manual.",
  upstream: "Serviciul de localizare nu răspunde. Încearcă mai târziu.",
} as const

/**
 * Instrucțiunea de reactivare nu poate fi una singură.
 *
 * Pe telefon nu există „iconița din stânga adresei" la care să trimiți omul,
 * iar refuzul vine adesea de la sistem, nu de la site: browserul însuși n-are
 * voie la locație în setările telefonului, sau serviciile de localizare sunt
 * oprite de tot. `PERMISSION_DENIED` arată la fel în toate cazurile — API-ul
 * web nu le poate deosebi — deci pe mobil le numim pe amândouă.
 */
const deniedMessage = () => {
  const mobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  return mobile
    ? "Accesul la locație e blocat. Verifică permisiunile site-ului în " +
        "meniul browserului și, în setările telefonului, dacă browserul are " +
        "voie să folosească locația. Până atunci, completează câmpurile manual."
    : "Accesul la locație e blocat pentru acest site. Îl poți reactiva din " +
        "iconița din stânga adresei, apoi apasă din nou."
}

/**
 * Detectarea locației pentru formularele de adresă: coordonatele din browser,
 * trecute prin `/api/geo/reverse`, completează localitatea, județul și codul
 * poștal.
 *
 * Am ales GPS-ul în locul geolocalizării după IP fiindcă în România IP-urile
 * de consumer (Digi, Vodafone, Orange mobil) ies aproape toate în București,
 * indiferent unde e clientul — o precompletare care arată corectă și nu e.
 *
 * Permisiunea NU se cere la încărcarea paginii: Safari o refuză fără gest de
 * utilizator, iar în Chrome un prompt neașteptat e respins din reflex — și un
 * refuz se scoate doar din setările site-ului, deci ne-ar închide ușa definitiv.
 * Cerem printr-un card care explică la ce folosește. Odată dată, Permissions API
 * ne spune că e `granted` și completăm singuri, fără să mai întrebe nimeni.
 */
const LocateMeButton = ({
  onResolve,
  invite = false,
  className,
}: LocateMeButtonProps) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [permission, setPermission] = useState<PermissionState | "unknown">(
    "unknown"
  )

  useEffect(() => {
    let alive = true

    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (!alive) return
        setPermission(status.state)
        // Dacă schimbă permisiunea din bara de adrese cât e pe pagină, cardul
        // trebuie să se adapteze fără reîncărcare.
        status.onchange = () => setPermission(status.state)
      })
      .catch(() => {
        // Safari mai vechi nu poate interoga `geolocation`; rămânem pe buton.
      })

    return () => {
      alive = false
    }
  }, [])

  const locate = (auto = false) => {
    setError(null)

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      if (!auto) setError(MESSAGES.unsupported)
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
            if (!auto) {
              setError(
                MESSAGES[data.error as keyof typeof MESSAGES] ??
                  MESSAGES.unavailable
              )
            }
            return
          }

          onResolve({
            name: data.name ?? "",
            county: data.county ?? "",
            postalCode: data.postalCode ?? "",
          })
          setDone(true)
        } catch {
          if (!auto) setError(MESSAGES.upstream)
        } finally {
          setBusy(false)
        }
      },
      (err) => {
        setBusy(false)
        // O încercare automată care eșuează nu merită un mesaj roșu: clientul
        // n-a cerut nimic, iar butonul rămâne oricum la dispoziția lui.
        if (auto) return
        setError(
          err.code === err.PERMISSION_DENIED
            ? deniedMessage()
            : MESSAGES.unavailable
        )
      },
      auto
        ? // Automat mergem pe precizie mică: e destul pentru localitate, nu
          // aprinde GPS-ul telefonului și acceptă o poziție veche de o oră.
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 60 * 60 * 1000,
          }
        : // La apăsare vrem și codul poștal al străzii, deci precizie mare.
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5 * 60 * 1000,
          }
    )
  }

  // O singură încercare automată per încărcare, altfel o adresă ștearsă de
  // client ar fi recompletată la loc sub degetele lui.
  const autoTried = useRef(false)

  useEffect(() => {
    if (!invite || permission !== "granted" || autoTried.current) return
    autoTried.current = true
    locate(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite, permission])

  const button = (
    <button
      type="button"
      onClick={() => locate()}
      disabled={busy}
      className={clx(
        "inline-flex w-fit items-center gap-1.5 transition-colors disabled:opacity-60",
        invite
          ? "rounded-full bg-brand-dark px-4 py-2 text-xs font-semibold text-white hover:bg-brand-accent"
          : "text-xs font-semibold text-brand-dark/70 hover:text-brand-dark"
      )}
      data-testid="locate-me-button"
    >
      {busy ? (
        <CircleNotch size={14} weight="bold" className="animate-spin" />
      ) : (
        <CrosshairSimple size={14} weight="bold" />
      )}
      {busy ? "Se detectează…" : "Detectează locația mea"}
    </button>
  )

  return (
    <div className={clx("flex flex-col gap-1.5", className)}>
      {invite && permission !== "denied" ? (
        <div className="rounded-2xl border border-brand-dark/10 bg-brand-light/40 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
            <MapPin size={16} weight="fill" className="text-brand-accent" />
            Completează adresa automat
          </p>
          <p className="mt-1 mb-3 text-xs leading-relaxed text-brand-dark/65">
            Apasă și permite accesul la locație în fereastra browserului. Îți
            completăm localitatea, județul și codul poștal — rămâne doar strada
            de scris.
          </p>
          {button}
        </div>
      ) : (
        button
      )}

      {done && !error && (
        <p className="text-xs text-emerald-700">
          Am completat localitatea, județul și codul poștal după locația ta.
        </p>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}

export default LocateMeButton
