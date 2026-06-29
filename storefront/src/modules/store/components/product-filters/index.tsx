"use client"

import {
  FILTER_KEYS,
  FILTER_LABELS,
  countActiveFilters,
  emptySelectedFilters,
  serializePrice,
  type FacetValue,
  type Facets,
  type FilterKey,
  type PriceRange,
  type SelectedFilters,
} from "@lib/util/product-filters"
import { clx } from "@medusajs/ui"
import { Funnel, X } from "@phosphor-icons/react/dist/ssr"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type ProductFiltersProps = {
  facets: Facets
  selected: SelectedFilters
  resultCount: number
}

const ProductFilters = ({ facets, selected, resultCount }: ProductFiltersProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SelectedFilters>(selected)

  // Resincronizează draftul cu URL-ul după navigare (apply / chip / reset).
  useEffect(() => {
    setDraft(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selected)])

  const activeCount = countActiveFilters(selected)
  const visibleKeys = useMemo(
    () => FILTER_KEYS.filter((k) => facets[k].length > 0),
    [facets]
  )

  const pushFilters = (next: SelectedFilters) => {
    const params = new URLSearchParams(searchParams)
    for (const k of FILTER_KEYS) {
      if (next[k].length) params.set(k, next[k].join(","))
      else params.delete(k)
    }
    const priceStr = serializePrice(next.price)
    if (priceStr) params.set("price", priceStr)
    else params.delete("price")
    params.delete("page")
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const setDraftPrice = (next: PriceRange) =>
    setDraft((prev) => ({ ...prev, price: next }))

  const removePrice = () =>
    pushFilters({ ...selected, price: { min: null, max: null } })

  const priceLabel = (p: PriceRange): string => {
    const fmt = (n: number) => n.toLocaleString("ro-RO")
    if (p.min != null && p.max != null) return `${fmt(p.min)}–${fmt(p.max)} lei`
    if (p.min != null) return `peste ${fmt(p.min)} lei`
    if (p.max != null) return `sub ${fmt(p.max)} lei`
    return ""
  }
  const priceActive = selected.price.min != null || selected.price.max != null

  const toggleDraft = (key: FilterKey, value: string) => {
    setDraft((prev) => {
      const has = prev[key].some((v) => v.toLowerCase() === value.toLowerCase())
      return {
        ...prev,
        [key]: has
          ? prev[key].filter((v) => v.toLowerCase() !== value.toLowerCase())
          : [...prev[key], value],
      }
    })
  }

  const applyDraft = () => {
    pushFilters(draft)
    setOpen(false)
  }

  const clearAll = () => {
    setDraft(emptySelectedFilters())
    pushFilters(emptySelectedFilters())
    setOpen(false)
  }

  const removeChip = (key: FilterKey, value: string) => {
    const next = {
      ...selected,
      [key]: selected[key].filter((v) => v.toLowerCase() !== value.toLowerCase()),
    }
    pushFilters(next)
  }

  if (!visibleKeys.length && !facets.priceRange) return null

  const draftCount = countActiveFilters(draft)

  const chips: { key: FilterKey; value: string }[] = FILTER_KEYS.flatMap((k) =>
    selected[k].map((value) => ({ key: k, value }))
  )

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-brand-dark/15 bg-white px-4 py-2.5 text-sm font-bold text-brand-dark shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-brand-dark"
        data-testid="open-filters"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Funnel size={16} weight="bold" />
        Filtre
        {activeCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-dark px-1.5 text-[11px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* Chips active */}
      {chips.map(({ key, value }) => (
        <button
          key={`${key}:${value}`}
          type="button"
          onClick={() => removeChip(key, value)}
          className="group inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1.5 text-xs font-bold text-brand-dark transition-colors hover:bg-brand-dark hover:text-white"
        >
          {value}
          <X size={12} weight="bold" className="opacity-60 group-hover:opacity-100" />
        </button>
      ))}

      {priceActive && (
        <button
          type="button"
          onClick={removePrice}
          className="group inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1.5 text-xs font-bold text-brand-dark transition-colors hover:bg-brand-dark hover:text-white"
        >
          {priceLabel(selected.price)}
          <X size={12} weight="bold" className="opacity-60 group-hover:opacity-100" />
        </button>
      )}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="text-xs font-bold text-brand-dark/50 underline-offset-2 hover:text-brand-accent hover:underline"
        >
          Șterge tot
        </button>
      )}

      <span className="ml-auto hidden text-sm text-brand-dark/50 sm:inline">
        {resultCount} {resultCount === 1 ? "produs" : "produse"}
      </span>

      {/* Drawer */}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex"
          role="dialog"
          aria-modal="true"
          aria-label="Filtre produse"
        >
          <div
            className="absolute inset-0 bg-brand-dark/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-[min(88vw,360px)] flex-col bg-white shadow-2xl animate-[slidein_0.25s_ease]">
            <header className="flex items-center justify-between border-b border-brand-dark/10 px-5 py-4">
              <span className="flex items-center gap-2 text-lg font-bold text-brand-dark">
                <Funnel size={18} weight="bold" />
                Filtre
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-brand-dark transition-colors hover:bg-brand-light"
                aria-label="Închide filtrele"
              >
                <X size={18} weight="bold" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {facets.priceRange && (
                <PriceSection
                  range={facets.priceRange}
                  value={draft.price}
                  onChange={setDraftPrice}
                />
              )}
              {visibleKeys.map((key) => (
                <FacetSection
                  key={key}
                  title={FILTER_LABELS[key]}
                  values={facets[key]}
                  isColor={key === "color"}
                  selectedValues={draft[key]}
                  onToggle={(v) => toggleDraft(key, v)}
                />
              ))}
            </div>

            <footer className="flex items-center gap-3 border-t border-brand-dark/10 px-5 py-4">
              <button
                type="button"
                onClick={clearAll}
                className="flex-1 rounded-full border border-brand-dark/15 py-3 text-sm font-bold text-brand-dark transition-colors hover:border-brand-dark"
              >
                Resetează
              </button>
              <button
                type="button"
                onClick={applyDraft}
                className="flex-[1.4] rounded-full bg-brand-dark py-3 text-sm font-bold text-white transition-colors hover:bg-brand-accent"
              >
                Aplică{draftCount > 0 ? ` (${draftCount})` : ""}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  )
}

type FacetSectionProps = {
  title: string
  values: FacetValue[]
  isColor: boolean
  selectedValues: string[]
  onToggle: (value: string) => void
}

const FacetSection = ({
  title,
  values,
  isColor,
  selectedValues,
  onToggle,
}: FacetSectionProps) => {
  const isSelected = (v: string) =>
    selectedValues.some((x) => x.toLowerCase() === v.toLowerCase())

  return (
    <section className="border-b border-brand-dark/10 py-4 first:pt-0 last:border-b-0">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-dark/50">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => {
          const active = isSelected(v.value)
          if (isColor) {
            return (
              <button
                key={v.value}
                type="button"
                onClick={() => onToggle(v.value)}
                aria-pressed={active}
                className={clx(
                  "inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-bold transition-colors",
                  active
                    ? "border-brand-dark bg-brand-dark text-white"
                    : "border-brand-dark/15 text-brand-dark hover:border-brand-dark/40"
                )}
              >
                <span
                  className="h-5 w-5 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: v.hex ?? "#e5e7eb" }}
                />
                {v.value}
              </button>
            )
          }
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => onToggle(v.value)}
              aria-pressed={active}
              className={clx(
                "rounded-full border px-3.5 py-2 text-sm font-bold transition-colors",
                active
                  ? "border-brand-dark bg-brand-dark text-white"
                  : "border-brand-dark/15 text-brand-dark hover:border-brand-dark/40"
              )}
            >
              {v.value}
              <span className={clx("ml-1.5 text-[11px]", active ? "text-white/60" : "text-brand-dark/40")}>
                {v.count}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

type PriceSectionProps = {
  range: { min: number; max: number }
  value: PriceRange
  onChange: (next: PriceRange) => void
}

const PriceSection = ({ range, value, onChange }: PriceSectionProps) => {
  const toNum = (v: string): number | null => {
    if (v.trim() === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const inputClass =
    "w-full rounded-xl border border-brand-dark/15 bg-white px-3 py-2.5 text-sm font-medium text-brand-dark outline-none transition-colors focus:border-brand-dark [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  return (
    <section className="border-b border-brand-dark/10 py-4 first:pt-0">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-dark/50">
        Preț (lei)
      </h3>
      <div className="flex items-center gap-2.5">
        <label className="flex-1">
          <span className="sr-only">Preț minim</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={`${range.min}`}
            value={value.min ?? ""}
            onChange={(e) => onChange({ ...value, min: toNum(e.target.value) })}
            className={inputClass}
          />
        </label>
        <span className="text-brand-dark/40">–</span>
        <label className="flex-1">
          <span className="sr-only">Preț maxim</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={`${range.max}`}
            value={value.max ?? ""}
            onChange={(e) => onChange({ ...value, max: toNum(e.target.value) })}
            className={inputClass}
          />
        </label>
      </div>
    </section>
  )
}

export default ProductFilters
