"use client"

import { clx } from "@medusajs/ui"

export type RailTabButton = { id: string; label: string }

/**
 * Rândul de taguri („Telefoane mobile", „Huse telefoane", …) folosit de toate
 * secțiunile de pe prima pagină.
 *
 * Un singur component pentru toate trei ca pastilele să nu se depărteze una de
 * alta la următoarea retușare — sunt același control, în trei locuri.
 */
const RailTabs = ({
  tabs,
  activeId,
  onSelect,
  ariaLabel,
}: {
  tabs: RailTabButton[]
  activeId: string
  onSelect: (id: string) => void
  ariaLabel: string
}) => {
  if (tabs.length < 2) return null

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      // Lista de taguri e un scroller nativ, nu un carusel: e text scurt, se
      // scrollează cu degetul pe orizontală și n-are nevoie de drag JS.
      className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.id)}
            className={clx(
              "px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-colors shrink-0",
              isActive
                ? "bg-brand-dark text-white"
                : "bg-white text-brand-dark border border-brand-dark/15 hover:border-brand-dark/40"
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default RailTabs
