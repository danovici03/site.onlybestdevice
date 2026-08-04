"use client"

import { useEffect, useRef } from "react"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr"
import { clx } from "@medusajs/ui"

import SearchInput from "@modules/search/components/search-input"
import SearchResults from "@modules/search/components/search-results"
import { useSearch } from "@modules/search/context"

/**
 * Căutarea pe mobil: ecran plin, deschis de lupa din nav. Bara din nav e prea
 * îngustă pe telefon ca să încapă lângă logo și coș, iar un dropdown peste
 * conținut ar fi acoperit de tastatură.
 */
const SearchSheet = () => {
  const { sheetOpen, closeSheet, isSearchable, query } = useSearch()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sheetOpen) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSheet()
        return
      }
      if (e.key !== "Tab") return

      // Ecranul acoperă tot, dar restul paginii rămâne în DOM: fără capcană,
      // Tab pleacă în nav-ul și în grila de dedesubt, invizibile, iar cine
      // navighează cu tastatura sau cu cititor de ecran se pierde acolo.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled])'
      )
      if (!focusables?.length) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      const inside = !!active && dialogRef.current!.contains(active)

      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sheetOpen, closeSheet])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal={sheetOpen}
      aria-label="Caută produse"
      aria-hidden={!sheetOpen}
      inert={!sheetOpen}
      className={clx(
        "lg:hidden fixed inset-0 z-[70] bg-white flex flex-col transition-opacity duration-200",
        sheetOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <div className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-brand-dark/5">
        {/* Input-ul se montează abia la deschidere: altfel `autoFocus` ar trage
            tastatura peste pagină la fiecare încărcare. */}
        {sheetOpen && <SearchInput autoFocus />}
        <button
          type="button"
          onClick={closeSheet}
          aria-label="Închide căutarea"
          className="shrink-0 text-sm font-bold text-brand-dark/60 hover:text-brand-dark transition-colors"
        >
          Anulează
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {!sheetOpen ? null : isSearchable ? (
          <SearchResults />
        ) : (
          <div className="pt-16 text-center">
            <MagnifyingGlass
              size={32}
              weight="light"
              aria-hidden
              className="mx-auto text-brand-dark/20"
            />
            <p className="mt-4 text-sm text-brand-dark/50">
              {query.trim()
                ? "Mai scrie o literă…"
                : "Scrie marca, modelul sau categoria."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Lupa din nav care deschide ecranul de mai sus. */
export const SearchSheetTrigger = () => {
  const { openSheet } = useSearch()

  return (
    <button
      type="button"
      onClick={openSheet}
      aria-label="Caută"
      aria-haspopup="dialog"
      data-testid="nav-search-button"
      className="lg:hidden hover:text-brand-accent transition-colors"
    >
      <MagnifyingGlass size={24} weight="light" />
    </button>
  )
}

export default SearchSheet
