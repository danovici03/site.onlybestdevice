"use client"

/**
 * Notificarea armonizată UE despre garanția legală de conformitate
 * (Regulamentul de punere în aplicare (UE) 2025/1960, obligatorie din
 * 27.09.2026). Imaginea e fișierul oficial al Comisiei, varianta color în
 * română („PNG and JPG.zip” de pe commission.europa.eu → practical guidelines
 * and high resolution vector files). Șablonul NU se modifică (nici culori,
 * nici text, nici decupaj) și online trebuie afișat color.
 *
 * Fișierul stă în public/images (nu importat static) pentru că același URL
 * îl folosește și emailul de confirmare a comenzii (backend, resend/templates).
 *
 * Ghidul cere notificarea „legible at default display size”. Pe telefon un A4
 * la lățimea ecranului are textul de ~7px, deci pe mobil fereastra ocupă tot
 * ecranul și o atingere pe imagine o mărește la 2× (derulare în ambele
 * direcții); a doua atingere o readuce la lățimea ecranului.
 */

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { clx } from "@medusajs/ui"
import {
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  ShieldCheck,
  X,
} from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"
import { useState } from "react"

export const LEGAL_GUARANTEE_NOTICE_SRC = "/images/garantia-legala-ue-ro.png"

// Aceeași destinație ca QR-ul din notificare (europa.eu/youreurope/garanții
// redirecționează aici) — ghidul cere un link clicabil spre ea.
const EU_INFO_URL =
  "https://europa.eu/youreurope/citizens/consumers/shopping/guarantees/index_ro.htm"

const LegalGuaranteeNotice = () => {
  const [open, setOpen] = useState(false)
  const [zoomed, setZoomed] = useState(false)

  const close = () => {
    setOpen(false)
    setZoomed(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border border-[#0b4ea2]/20 bg-[#0b4ea2]/5 hover:bg-[#0b4ea2]/10 transition-colors text-left"
        data-testid="legal-guarantee-notice-button"
      >
        <ShieldCheck
          size={18}
          weight="regular"
          className="text-[#0b4ea2] shrink-0"
        />
        <span className="flex-1 min-w-0 text-[13px] font-bold text-brand-dark leading-tight">
          Garanția legală de conformitate
        </span>
        <span className="text-xs text-[#0b4ea2] font-bold shrink-0">
          Informații UE
        </span>
      </button>

      <Dialog open={open} onClose={close} className="relative z-[80]">
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
        />
        <div className="fixed inset-0 flex items-center justify-center sm:p-4">
          <DialogPanel className="relative flex h-[100svh] w-full flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[92svh] sm:max-w-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between gap-4 border-b border-brand-dark/10 px-5 py-3">
              <DialogTitle className="text-sm font-bold text-brand-dark">
                Garanția legală de conformitate
              </DialogTitle>
              <button
                type="button"
                onClick={close}
                aria-label="Închide"
                className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-brand-dark hover:bg-brand-light transition-colors"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <div className="relative flex-1 overflow-auto overscroll-contain p-3 sm:p-4">
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                aria-label={zoomed ? "Micșorează notificarea" : "Mărește notificarea"}
                className={clx(
                  // Mărirea e doar pe mobil; pe desktop (max-w-2xl, ~13px text) se citește direct.
                  "block sm:!w-full sm:!cursor-default",
                  zoomed ? "w-[200%] cursor-zoom-out" : "w-full cursor-zoom-in"
                )}
              >
                <Image
                  src={LEGAL_GUARANTEE_NOTICE_SRC}
                  width={1654}
                  height={2339}
                  alt="Garanția legală: protecția oferită de garanția legală minimă de doi ani pentru bunurile vândute în Uniunea Europeană. Vânzătorii sunt răspunzători pentru orice neconformitate existentă la livrare și constatată în perioada de garanție legală și trebuie să ofere repararea sau înlocuirea gratuită, iar în unele cazuri o reducere de preț sau rambursarea integrală. Dacă bunurile sunt neconforme, contactați vânzătorul cât mai curând și furnizați o dovadă a achiziției. Mai multe informații: europa.eu/youreurope/garanții."
                  // Pe mobil poate ajunge la 2× lățimea ecranului (mărit).
                  sizes="(max-width: 640px) 200vw, 672px"
                  className="h-auto w-full"
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-brand-dark/10 px-5 py-3">
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                className="flex items-center gap-1.5 text-xs font-bold text-brand-dark/70 sm:hidden"
              >
                {zoomed ? (
                  <MagnifyingGlassMinus size={16} weight="bold" />
                ) : (
                  <MagnifyingGlassPlus size={16} weight="bold" />
                )}
                {zoomed ? "Micșorează" : "Mărește"}
              </button>
              <a
                href={EU_INFO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold text-[#0b4ea2] hover:underline sm:mx-auto"
              >
                Informații UE despre garanția legală
              </a>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}

export default LegalGuaranteeNotice
