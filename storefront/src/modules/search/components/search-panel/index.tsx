"use client"

import { clx } from "@medusajs/ui"

import SearchResults from "@modules/search/components/search-results"
import { useSearch } from "@modules/search/context"

/**
 * Panoul de sugestii de pe desktop.
 *
 * Stă sub header, nu ancorat de input: câmpul de căutare există în două
 * exemplare (bara de sus și pastila de la scroll) și se mută pe verticală când
 * pagina se derulează, deci un dropdown ancorat de el ar sări. Panoul e fix sub
 * header, exact ca panoul mega-meniului, și se aliniază vizual cu bara.
 */
const SearchPanel = () => {
  const { open, setOpen, isSearchable, resetActive, sheetOpen } = useSearch()
  // Panoul și ecranul de pe mobil folosesc aceleași id-uri de sugestie; când
  // ecranul plin e deschis, el e singurul care le randează.
  const visible = open && isSearchable && !sheetOpen

  const dismiss = () => {
    setOpen(false)
    resetActive()
  }

  return (
    <>
      <div
        aria-hidden={!visible}
        onClick={dismiss}
        className={clx(
          "hidden lg:block fixed inset-x-0 top-[var(--nav-bottom,5rem)] bottom-0 z-30 bg-brand-dark/30 backdrop-blur-sm transition-opacity duration-200",
          visible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      />

      <div
        className={clx(
          "hidden lg:block fixed inset-x-0 top-[var(--nav-bottom,5rem)] z-40 transition-all duration-200 ease-out",
          visible
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none"
        )}
      >
        <div className="bg-white border-b border-brand-dark/5 shadow-[0_24px_48px_rgba(0,0,0,0.08)]">
          <div className="max-w-[720px] mx-auto px-4 py-6">
            {visible && <SearchResults />}
          </div>
        </div>
      </div>
    </>
  )
}

export default SearchPanel
