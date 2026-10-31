"use client"

import { ArrowDown } from "@phosphor-icons/react/dist/ssr"
import { useEffect, useState } from "react"

import { BLACK_FRIDAY, getBlackFridayPhase } from "@lib/util/black-friday"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const UNITS = [
  { label: "zile", ms: 86_400_000 },
  { label: "ore", ms: 3_600_000 },
  { label: "minute", ms: 60_000 },
  { label: "secunde", ms: 1_000 },
]

const remainingUnits = (ms: number) => {
  let rest = Math.max(0, ms)
  return UNITS.map(({ label, ms: size }) => {
    const value = Math.floor(rest / size)
    rest -= value * size
    return { label, value: String(value).padStart(2, "0") }
  })
}

const LEAD = {
  upcoming: `Reducerile încep pe ${BLACK_FRIDAY.startDate}.`,
  live: `Reduceri la telefoane, laptopuri și accesorii, ${BLACK_FRIDAY.dates}.`,
  ended: "Campania s-a încheiat.",
}

/**
 * `now` vine de pe server, ca prima randare din browser să fie identică cu HTML
 * primit; ceasul real preia după hidratare. Faza se recalculează la fiecare
 * secundă, deci pagina lăsată deschisă trece singură la „Se termină în".
 */
const BlackFridayHero = ({ now: serverNow }: { now: number }) => {
  const [now, setNow] = useState(serverNow)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const phase = getBlackFridayPhase(now)
  const target = phase === "upcoming" ? BLACK_FRIDAY.start : BLACK_FRIDAY.end

  return (
    <section className="bf-hero">
      <h1 className="bf-display bf-wordmark">
        Black
        <br />
        Friday
      </h1>

      <div className="bf-hero-footer">
        <div>
          <p className="bf-lead">{LEAD[phase]}</p>
          {phase === "live" ? (
            <a href="#oferte" className="bf-cta">
              Vezi ofertele
              <span className="bf-cta-icon">
                <ArrowDown size={20} weight="bold" aria-hidden />
              </span>
            </a>
          ) : (
            <LocalizedClientLink href="/oferte" className="bf-cta">
              Vezi ofertele
            </LocalizedClientLink>
          )}
        </div>

        {phase !== "ended" && (
          <div>
            <p className="bf-countdown-label">
              {phase === "upcoming" ? "Începe în" : "Se termină în"}
            </p>
            {/* Fără aria-live: un cititor de ecran ar anunța fiecare secundă. */}
            <dl className="bf-countdown" role="timer">
              {remainingUnits(target - now).map(({ label, value }) => (
                <div key={label}>
                  <dd className="bf-display">{value}</dd>
                  <dt>{label}</dt>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </section>
  )
}

export default BlackFridayHero
