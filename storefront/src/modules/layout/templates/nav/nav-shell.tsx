"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

type Props = {
  left: React.ReactNode
  center: React.ReactNode
  right: React.ReactNode
  menuOpen?: boolean
}

const NavShell = ({ left, center, right, menuOpen = false }: Props) => {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  // Home = doar segmentul de country-code în path (ex. "/ro"). Doar acolo
  // navul stă peste hero-ul întunecat, deci doar acolo activăm overlay-ul alb.
  const isHome = pathname.split("/").filter(Boolean).length <= 1

  useEffect(() => {
    let ticking = false
    let lastScrolled = false
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
        ticking = false
      })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Suprapus peste hero: doar pe home, sus de tot, cu mega-meniul închis.
  // Culoarea de bază (text-white / text-brand-dark) e setată pe fiecare <nav>
  // în parte, iar conținutul (logo, linkuri, iconițe) o moștenește prin currentColor.
  const overlay = isHome && !scrolled && !menuOpen

  const Inner = (
    <>
      <div className="flex items-center gap-4 shrink-0">{left}</div>
      <div className="hidden lg:flex items-center gap-8 font-bold text-sm">
        {center}
      </div>
      <div className="flex items-center gap-5 sm:gap-6">{right}</div>
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
      <nav
        aria-hidden={scrolled}
        style={fadeStyle(!scrolled)}
        className={`absolute inset-x-0 top-0 w-full h-20 px-4 sm:px-8 flex items-center transition-colors duration-300 [--logo-h:2.5rem] sm:[--logo-h:4rem] ${
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
          {Inner}
        </div>
      </nav>

      {/* Layer B: pastilă flotantă (după scroll) */}
      <nav
        aria-hidden={!scrolled}
        style={fadeStyle(scrolled)}
        className="absolute left-1/2 -translate-x-1/2 top-3 w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] max-w-6xl h-14 px-6 sm:px-8 flex items-center justify-between bg-white/85 backdrop-blur-md border border-white/60 rounded-full shadow-xl text-brand-dark [--logo-h:2.25rem]"
      >
        {Inner}
      </nav>
    </header>
  )
}

export default NavShell
