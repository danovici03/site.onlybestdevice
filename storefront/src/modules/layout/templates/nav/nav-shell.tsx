"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

/**
 * Un slot poate fi conținut fix sau o funcție de starea barei:
 * - `overlay`: bara stă peste hero-ul de pe home, deci conținutul e alb;
 * - `compact`: e pastila de la scroll, unde spațiul e cu sute de pixeli mai
 *   puțin decât în bara de sus și eticheta butonului cedează locul.
 */
type SlotContext = { overlay: boolean; compact: boolean }
type Slot = React.ReactNode | ((ctx: SlotContext) => React.ReactNode)

type Props = {
  left: Slot
  center: Slot
  right: Slot
  menuOpen?: boolean
}

const renderSlot = (slot: Slot, ctx: SlotContext): React.ReactNode =>
  typeof slot === "function" ? slot(ctx) : slot

/**
 * Lățimea câmpului de căutare, în procente din bara care îl conține — nu în rem
 * legați de breakpoint-uri, fiindcă pastila e plafonată la `max-w-6xl` și pe
 * ecrane late e mult mai îngustă decât bara de sus.
 *
 * Pastila primește procente mult mai mari pentru că acolo butonul „Toate
 * produsele" e redus la iconiță: grupul din stânga se scurtează cu ~135px, iar
 * spațiul eliberat se duce în câmp. Fără asta, un câmp centrat exact rămânea
 * îngust, cu un gol de zece ori mai mare în dreapta decât în stânga — centrat
 * matematic, dar citit ca împins spre stânga.
 */
const BAR_CENTER = "lg:w-[22%] xl:w-[34%] 2xl:w-[36%]"
const PILL_CENTER = "lg:w-[42%] xl:w-[44%]"

/**
 * `--logo-w` e lățimea logo-ului, setată pe fiecare bară în parte pentru că
 * spațiul din stânga diferă: în pastilă butonul „Toate produsele" e doar
 * iconiță, dar câmpul de căutare ia un procent mult mai mare din bară.
 *
 * Logo-ul e un wordmark de ~6,8:1, deci se dimensionează pe lățime — la
 * înălțimea uzuală a unui logo ar trece de 400px lățime și ar împinge căutarea
 * din centru. Valorile de aici sunt plafonul la care logo-ul plus butonul de
 * meniu încap în jumătatea din stânga a barei, la fiecare breakpoint.
 */
const BAR_LOGO =
  "[--logo-w:10.5rem] sm:[--logo-w:12rem] lg:[--logo-w:11rem] xl:[--logo-w:12.5rem] 2xl:[--logo-w:14rem]"
const PILL_LOGO = "[--logo-w:9.5rem] sm:[--logo-w:11rem]"

const NavShell = ({ left, center, right, menuOpen = false }: Props) => {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  // Home = doar segmentul de country-code în path (ex. "/ro"). Doar acolo
  // navul stă peste hero-ul întunecat, deci doar acolo activăm overlay-ul alb.
  const isHome = pathname.split("/").filter(Boolean).length <= 1

  useEffect(() => {
    let ticking = false
    let lastScrolled = false
    let lastBottom = -1

    // Panourile care se deschid sub nav (mega-meniu, sugestii de căutare) sunt
    // `fixed`, deci au nevoie de o coordonată absolută. Header-ul e sticky, dar
    // sus de tot e împins în jos de bara de anunțuri, așa că marginea lui de jos
    // nu e constantă: pornește de sub top-bar și urcă la 5rem după scroll. Fără
    // asta, primul rând din panou intra sub nav înainte de scroll.
    const publishBottom = () => {
      const header = document.getElementById("site-header")
      if (!header) return
      const bottom = Math.round(Math.max(0, header.getBoundingClientRect().bottom))
      if (bottom === lastBottom) return
      lastBottom = bottom
      document.documentElement.style.setProperty("--nav-bottom", `${bottom}px`)
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const top = window.pageYOffset || document.documentElement.scrollTop
        const next = top > 40
        if (next !== lastScrolled) {
          lastScrolled = next
          setScrolled(next)
        }
        publishBottom()
        ticking = false
      })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  // Suprapus peste hero: doar pe home, sus de tot, cu mega-meniul închis.
  // Culoarea de bază (text-white / text-brand-dark) e setată pe fiecare <nav>
  // în parte, iar conținutul (logo, linkuri, iconițe) o moștenește prin currentColor.
  const overlay = isHome && !scrolled && !menuOpen

  /**
   * Cele două bare (cea de sus și pastila de la scroll) randează același
   * conținut. Pastila e mereu albă, deci primește `overlay: false` chiar și pe
   * home.
   *
   * Grupurile laterale au `flex-1 basis-0`, deci împart la fel spațiul rămas
   * indiferent cât de lat e logo-ul sau câte iconițe sunt în dreapta — numai așa
   * câmpul de căutare cade pe centrul real al barei, nu pe mijlocul spațiului
   * rămas după el.
   */
  const inner = (ctx: SlotContext, centerWidth: string) => (
    <>
      <div className="flex-1 basis-0 flex items-center gap-4 lg:gap-6">
        {renderSlot(left, ctx)}
      </div>
      <div className={`hidden lg:flex shrink-0 items-center ${centerWidth}`}>
        {renderSlot(center, ctx)}
      </div>
      <div className="flex-1 basis-0 flex items-center justify-end gap-5 sm:gap-6">
        {renderSlot(right, ctx)}
      </div>
    </>
  )

  const fadeStyle = (visible: boolean) => ({
    opacity: visible ? 1 : 0,
    transition: "opacity 200ms ease-out",
    willChange: "opacity",
    pointerEvents: visible ? ("auto" as const) : ("none" as const),
  })

  return (
    <header
      id="site-header"
      className="w-full sticky top-0 z-50 h-20"
    >
      {/* Layer A: bară full-width (top of page) — albă (text negru) sau
          transparentă peste hero (text alb) pe home. */}
      {/* `inert` scoate bara stinsă și din ordinea de tabulare. `pointer-events:
          none` oprea doar mouse-ul: cu un câmp de căutare în nav, Tab ajungea
          altfel într-un input invizibil. */}
      <nav
        aria-hidden={scrolled}
        inert={scrolled}
        style={fadeStyle(!scrolled)}
        className={`absolute inset-x-0 top-0 w-full h-20 px-4 sm:px-8 flex items-center transition-colors duration-300 ${BAR_LOGO} ${
          overlay
            ? "bg-transparent text-white"
            : "bg-white text-brand-dark border-b border-brand-dark/5"
        }`}
      >
        {/* Gradient subtil propriu navului — asigură lizibilitatea textului alb
            chiar și peste slide-uri cu partea de sus mai deschisă. */}
        {overlay && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 to-transparent"
          />
        )}
        <div className="relative w-full max-w-[1920px] mx-auto flex items-center justify-between">
          {inner({ overlay, compact: false }, BAR_CENTER)}
        </div>
      </nav>

      {/* Layer B: pastilă flotantă (după scroll) */}
      <nav
        aria-hidden={!scrolled}
        inert={!scrolled}
        style={fadeStyle(scrolled)}
        className={`absolute left-1/2 -translate-x-1/2 top-3 w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] max-w-6xl h-14 px-6 sm:px-8 flex items-center justify-between bg-white/85 backdrop-blur-md border border-white/60 rounded-full shadow-xl text-brand-dark ${PILL_LOGO}`}
      >
        {inner({ overlay: false, compact: true }, PILL_CENTER)}
      </nav>
    </header>
  )
}

export default NavShell
