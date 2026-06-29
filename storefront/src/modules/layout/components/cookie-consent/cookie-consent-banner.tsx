"use client"

import { X } from "@phosphor-icons/react/dist/ssr"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useConsent } from "@lib/context/consent-context"

export default function CookieConsentBanner() {
  const { decided, acceptAll, rejectAll, openPreferences } = useConsent()

  if (decided) return null

  return (
    <div
      role="dialog"
      aria-label="Informativa cookie"
      aria-modal="false"
      className="fixed inset-x-0 bottom-0 z-[70] p-2 sm:p-4 pointer-events-none"
    >
      <div
        className="pointer-events-auto mx-auto max-w-[560px] bg-white text-brand-dark rounded-2xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.3)] border border-brand-dark/10 px-4 py-3 sm:px-5 sm:py-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-start gap-3">
          <p className="flex-1 text-[13px] leading-snug text-brand-dark/80">
            Utilizziamo cookie tecnici e, con il tuo consenso, cookie analitici
            e di marketing.{" "}
            <LocalizedClientLink
              href="/cookie"
              className="underline font-bold hover:text-brand-accent"
            >
              Cookie Policy
            </LocalizedClientLink>
          </p>
          <button
            type="button"
            onClick={rejectAll}
            aria-label="Refuză cookie-urile neesențiale"
            className="-mt-0.5 -mr-1 p-1 rounded-full text-brand-dark/50 hover:text-brand-dark hover:bg-brand-light transition-colors shrink-0"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={rejectAll}
            className="flex-1 min-w-[80px] px-3 py-2 rounded-full text-xs font-bold border border-brand-dark/15 text-brand-dark hover:border-brand-dark hover:bg-brand-light transition-colors"
          >
            Necessari
          </button>
          <button
            type="button"
            onClick={openPreferences}
            className="flex-1 min-w-[80px] px-3 py-2 rounded-full text-xs font-bold border border-brand-dark/15 text-brand-dark hover:border-brand-dark hover:bg-brand-light transition-colors"
          >
            Personalizza
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="flex-1 min-w-[80px] px-3 py-2 rounded-full text-xs font-bold bg-brand-dark text-white hover:bg-brand-accent transition-colors"
          >
            Accetta tutti
          </button>
        </div>
      </div>
    </div>
  )
}
