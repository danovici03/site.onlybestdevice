"use client"

import { useEffect, useState } from "react"
import { usePathname, useParams } from "next/navigation"
import { WhatsappLogo, X } from "@phosphor-icons/react"
import { COMPANY } from "@lib/util/company-info"
import { useFooterInView } from "@lib/hooks/use-footer-in-view"

const WA_NUMBER = COMPANY.whatsapp.replace(/[^\d]/g, "")
const WA_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
  "Bună! Aș dori informații despre produsele voastre."
)}`

const BUBBLE_DELAY_MS = 30_000
const STORAGE_KEY = "av_wa_bubble_dismissed"

export default function WhatsAppWidget() {
  const [showBubble, setShowBubble] = useState(false)
  const pathname = usePathname()
  const params = useParams()

  const footerInView = useFooterInView()
  const countryCode = params.countryCode as string
  const stripped = pathname.replace(`/${countryCode}`, "")
  const isProductPage = stripped.startsWith("/products/")

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return
    } catch {
      return
    }

    const timer = setTimeout(() => setShowBubble(true), BUBBLE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  function dismissBubble() {
    setShowBubble(false)
    try {
      sessionStorage.setItem(STORAGE_KEY, "1")
    } catch {}
  }

  const mobileBottom = isProductPage ? "5rem" : "5.5rem"

  return (
    <div className={`fixed right-4 lg:right-5 z-[45] wa-widget transition-opacity duration-300 ${footerInView ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
      <style>{`
        .wa-widget { bottom: calc(env(safe-area-inset-bottom, 0px) + ${mobileBottom}); }
        @media (min-width: 1024px) { .wa-widget { bottom: 1.25rem; } }
      `}</style>

      {showBubble && (
        <div
          role="status"
          aria-live="polite"
          className="absolute bottom-full right-0 mb-3 w-[260px] lg:w-[280px] animate-fade-in-up"
        >
          <div className="relative bg-white rounded-2xl shadow-[0_8px_30px_-8px_rgba(0,0,0,0.15)] border border-brand-dark/10 p-4 pr-9">
            <button
              onClick={dismissBubble}
              aria-label="Închide messaggio"
              className="absolute top-2.5 right-2.5 p-1 rounded-full hover:bg-brand-light transition-colors"
            >
              <X size={14} weight="bold" className="text-brand-dark/40" />
            </button>
            <p className="text-sm text-brand-dark leading-relaxed">
              Bună! Un specialist al nostru îți stă la dispoziție. Scrie-ne!
            </p>
          </div>
          <div className="absolute -bottom-1.5 right-5 w-3 h-3 bg-white border-r border-b border-brand-dark/10 rotate-45" />
        </div>
      )}

      <a
        href={WA_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Discută cu noi pe WhatsApp"
        className="flex items-center justify-center w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-[#25D366] shadow-lg shadow-[#25D366]/30 hover:bg-[#20bd5a] transition-colors motion-safe:animate-wa-pulse"
      >
        <WhatsappLogo
          size={28}
          weight="fill"
          className="text-white w-6 h-6 lg:w-7 lg:h-7"
        />
      </a>
    </div>
  )
}
