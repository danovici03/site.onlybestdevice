"use client"

import { clx } from "@medusajs/ui"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

type SortOption = {
  value: SortOptions
  label: string
}

const SORT_OPTIONS: SortOption[] = [
  { value: "created_at", label: "Cele mai recente" },
  { value: "price_asc", label: "Preț: crescător" },
  { value: "price_desc", label: "Preț: descrescător" },
]

type RefinementBarProps = {
  sortBy: SortOptions
  className?: string
}

const RefinementBar = ({ sortBy, className }: RefinementBarProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setSort = useCallback(
    (value: SortOptions) => {
      const params = new URLSearchParams(searchParams)
      params.set("sortBy", value)
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    <div
      className={clx(
        "flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0",
        className
      )}
      data-testid="sort-by-container"
    >
      <span className="text-xs uppercase tracking-[0.18em] font-bold text-brand-dark/50 shrink-0 mr-1">
        Ordina
      </span>
      {SORT_OPTIONS.map((opt) => {
        const isActive = opt.value === sortBy
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSort(opt.value)}
            className={clx(
              "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors",
              isActive
                ? "bg-brand-dark text-white"
                : "bg-white text-brand-dark border border-brand-dark/15 hover:border-brand-dark/40"
            )}
            data-testid="sort-by-link"
            data-active={isActive}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default RefinementBar
