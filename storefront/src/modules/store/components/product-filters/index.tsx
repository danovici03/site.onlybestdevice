"use client"

import {
  countActiveFilters,
  emptySelectedFilters,
  serializePrice,
  type AttributeFacet,
  type FacetValue,
  type Facets,
  type PriceRange,
  type SelectedFilters,
} from "@lib/util/product-filters"
import { clx } from "@medusajs/ui"
import { CaretDown, CaretUp, Funnel, X } from "@phosphor-icons/react/dist/ssr"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { countWithNoun } from "@lib/util/plural-ro"

/**
 * Câte valori arătăm inițial per fațetă (restul intră sub „Vezi mai multe”).
 * Listele numerice (stocare, RAM) sunt scurte și sortate crescător; tăiem doar
 * listele lungi.
 */
const COLLAPSE_AFTER = 8
const BRAND_COLLAPSE_AFTER = 6

type ProductFiltersProps = {
  facets: Facets
  selected: SelectedFilters
  resultCount: number
}

const fmtNum = (n: number) => n.toLocaleString("ro-RO")

/** „6–6,7 inch", „peste 4.000 mAh", „sub 12 h". */
const rangeLabel = (p: PriceRange, unit: string | null): string => {
  const u = unit ? ` ${unit}` : ""
  if (p.min != null && p.max != null) return `${fmtNum(p.min)}–${fmtNum(p.max)}${u}`
  if (p.min != null) return `peste ${fmtNum(p.min)}${u}`
  if (p.max != null) return `sub ${fmtNum(p.max)}${u}`
  return ""
}

const parseRange = (raw: string | undefined): PriceRange => {
  const [a, b] = (raw ?? "").split("-")
  const n = (s?: string) => {
    if (s == null || s.trim() === "") return null
    const v = Number(s)
    return Number.isFinite(v) ? v : null
  }
  return { min: n(a), max: n(b) }
}

/**
 * Selecția din URL, adusă la forma canonică pe care o recunoaște backendul:
 * slug-uri în loc de nume vechi (`?brand=Apple` → `apple`), iar filtrele care
 * nu se aplică aici (rămase în URL de pe altă categorie) cad. Tot panoul
 * lucrează pe forma asta, deci și aplicarea curăță URL-ul.
 */
const canonicalize = (selected: SelectedFilters, facets: Facets): SelectedFilters => {
  const attrs: Record<string, string[]> = {}
  for (const a of facets.attributes) {
    if (a.type === "number") {
      const r = a.selected as PriceRange | null
      const s = r ? serializePrice(r) : null
      if (s) attrs[a.key] = [s]
    } else {
      const slugs = Array.isArray(a.selected) ? a.selected : []
      if (slugs.length) attrs[a.key] = slugs
    }
  }
  return { ...selected, attrs }
}

const ProductFilters = ({ facets, selected: rawSelected, resultCount }: ProductFiltersProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selected = useMemo(
    () => canonicalize(rawSelected, facets),
    [rawSelected, facets]
  )

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SelectedFilters>(selected)

  // Resincronizează draftul cu URL-ul după navigare (apply / chip / reset).
  useEffect(() => {
    setDraft(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selected)])

  const activeCount = countActiveFilters(selected)

  const pushFilters = (next: SelectedFilters) => {
    const params = new URLSearchParams(searchParams)
    // Toate cheile de filtru cunoscute: cele din răspuns și cele venite în URL
    // (inclusiv cele care nu se mai aplică, ca să iasă din URL).
    const attrKeys = new Set([
      ...facets.attributes.map((a) => a.key),
      ...Object.keys(rawSelected.attrs),
    ])
    for (const k of [...Array.from(attrKeys), "category", "price", "stock", "page"]) params.delete(k)

    // O apariție per valoare, nu o listă separată prin virgulă: numele de
    // categorii conțin virgule („Console, Jocuri") și s-ar rupe la citire.
    for (const v of next.category) params.append("category", v)
    for (const [k, values] of Object.entries(next.attrs)) {
      for (const v of values) params.append(k, v)
    }
    const priceStr = serializePrice(next.price)
    if (priceStr) params.set("price", priceStr)
    if (next.stock) params.set("stock", "1")

    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const toggleIn = (list: string[], value: string) =>
    list.some((v) => v.toLowerCase() === value.toLowerCase())
      ? list.filter((v) => v.toLowerCase() !== value.toLowerCase())
      : [...list, value]

  const toggleCategory = (value: string) =>
    setDraft((prev) => ({ ...prev, category: toggleIn(prev.category, value) }))

  const toggleAttr = (key: string, slug: string) =>
    setDraft((prev) => {
      const values = toggleIn(prev.attrs[key] ?? [], slug)
      const attrs = { ...prev.attrs }
      if (values.length) attrs[key] = values
      else delete attrs[key]
      return { ...prev, attrs }
    })

  const setAttrRange = (key: string, range: PriceRange) =>
    setDraft((prev) => {
      const attrs = { ...prev.attrs }
      const s = serializePrice(range)
      if (s) attrs[key] = [s]
      else delete attrs[key]
      return { ...prev, attrs }
    })

  const applyDraft = () => {
    pushFilters(draft)
    setOpen(false)
  }

  const clearAll = () => {
    setDraft(emptySelectedFilters())
    pushFilters(emptySelectedFilters())
    setOpen(false)
  }

  if (!hasContent(facets)) return null

  const draftCount = countActiveFilters(draft)

  /* ---------------- Chips pentru selecția activă ---------------- */

  type Chip = { id: string; label: string; remove: () => SelectedFilters }
  const chips: Chip[] = []
  if (selected.stock) {
    chips.push({ id: "stock", label: "În stoc", remove: () => ({ ...selected, stock: false }) })
  }
  for (const value of selected.category) {
    chips.push({
      id: `category:${value}`,
      label: value,
      remove: () => ({ ...selected, category: toggleIn(selected.category, value) }),
    })
  }
  for (const a of facets.attributes) {
    const current = selected.attrs[a.key]
    if (!current?.length) continue
    const without = () => {
      const attrs = { ...selected.attrs }
      delete attrs[a.key]
      return attrs
    }
    if (a.type === "number") {
      chips.push({
        id: `${a.key}:range`,
        label: `${a.label}: ${rangeLabel(parseRange(current[0]), a.unit)}`,
        remove: () => ({ ...selected, attrs: without() }),
      })
      continue
    }
    for (const slug of current) {
      const v = a.values?.find((x) => x.slug === slug)
      chips.push({
        id: `${a.key}:${slug}`,
        label: `${a.label}: ${v?.value ?? slug}`,
        remove: () => {
          const rest = current.filter((s) => s !== slug)
          const attrs = without()
          if (rest.length) attrs[a.key] = rest
          return { ...selected, attrs }
        },
      })
    }
  }
  const priceActive = selected.price.min != null || selected.price.max != null
  if (priceActive) {
    chips.push({
      id: "price",
      label: rangeLabel(selected.price, "lei"),
      remove: () => ({ ...selected, price: { min: null, max: null } }),
    })
  }

  const chipClass =
    "group inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1.5 text-xs font-bold text-brand-dark transition-colors hover:bg-brand-dark hover:text-white"

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
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => pushFilters(chip.remove())}
          className={chipClass}
        >
          {chip.label}
          <X size={12} weight="bold" className="opacity-60 group-hover:opacity-100" />
        </button>
      ))}

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
        {countWithNoun(resultCount, resultCount === 1 ? "produs" : "produse")}
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
                <RangeSection
                  title="Preț (lei)"
                  range={facets.priceRange}
                  value={draft.price}
                  step={1}
                  onChange={(price) => setDraft((prev) => ({ ...prev, price }))}
                />
              )}

              {(facets.stock.count > 0 || draft.stock) && (
                <StockSection
                  count={facets.stock.count}
                  checked={draft.stock}
                  onChange={(stock) => setDraft((prev) => ({ ...prev, stock }))}
                />
              )}

              {facets.category.length > 0 && (
                <FacetSection
                  title="Categorie"
                  values={facets.category}
                  isColor={false}
                  collapseAfter={COLLAPSE_AFTER}
                  selectedValues={draft.category}
                  onToggle={toggleCategory}
                />
              )}

              {facets.attributes.map((a) =>
                a.type === "number" ? (
                  a.range ? (
                    <RangeSection
                      key={a.key}
                      title={a.unit ? `${a.label} (${a.unit})` : a.label}
                      range={a.range}
                      value={parseRange(draft.attrs[a.key]?.[0])}
                      step="any"
                      onChange={(r) => setAttrRange(a.key, r)}
                    />
                  ) : null
                ) : (
                  <FacetSection
                    key={a.key}
                    title={a.label}
                    values={a.values ?? []}
                    isColor={a.display === "swatch"}
                    collapseAfter={a.key === "brand" ? BRAND_COLLAPSE_AFTER : COLLAPSE_AFTER}
                    selectedValues={draft.attrs[a.key] ?? []}
                    onToggle={(slug) => toggleAttr(a.key, slug)}
                  />
                )
              )}
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

const hasContent = (f: Facets) =>
  f.priceRange != null ||
  f.stock.count > 0 ||
  f.category.length > 0 ||
  f.attributes.some((a: AttributeFacet) =>
    a.type === "number" ? a.range != null : (a.values?.length ?? 0) > 0
  )

type StockSectionProps = {
  count: number
  checked: boolean
  onChange: (next: boolean) => void
}

const StockSection = ({ count, checked, onChange }: StockSectionProps) => (
  <section className="border-b border-brand-dark/10 py-4 first:pt-0">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-sm font-bold text-brand-dark">
        Doar produse în stoc
        <span className="ml-1.5 text-[11px] text-brand-dark/40">{count}</span>
      </span>
      <span
        className={clx(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-brand-dark" : "bg-brand-dark/15"
        )}
      >
        <span
          className={clx(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-[2px]"
          )}
        />
      </span>
    </button>
  </section>
)

type FacetSectionProps = {
  title: string
  values: FacetValue[]
  isColor: boolean
  collapseAfter?: number
  selectedValues: string[]
  onToggle: (value: string) => void
}

const FacetSection = ({
  title,
  values,
  isColor,
  collapseAfter,
  selectedValues,
  onToggle,
}: FacetSectionProps) => {
  const [expanded, setExpanded] = useState(false)

  // Identitatea unei valori e slug-ul (filtrele de atribut) sau numele
  // (categoriile, care n-au slug).
  const isSelected = (v: string) =>
    selectedValues.some((x) => x.toLowerCase() === v.toLowerCase())

  // Când e restrânsă, arătăm primele N (cele mai populare) plus valorile deja
  // bifate care ar cădea dincolo de limită — altfel selecția ar dispărea vizual.
  const collapsible = collapseAfter != null && values.length > collapseAfter + 1
  const visible = useMemo(() => {
    if (!collapsible || expanded) return values
    const head = values.slice(0, collapseAfter)
    const tail = values.slice(collapseAfter).filter((v) => isSelected(v.slug ?? v.value))
    return [...head, ...tail]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, collapsible, expanded, collapseAfter, selectedValues])

  const hidden = values.length - visible.length

  return (
    <section className="border-b border-brand-dark/10 py-4 first:pt-0 last:border-b-0">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-dark/50">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {visible.map((v) => {
          const active = isSelected(v.slug ?? v.value)
          // Backendul întoarce count 0 doar pentru valori bifate pe care restul
          // selecției le exclude complet — le păstrează în listă tocmai ca să
          // poată fi debifate.
          const deadEnd = active && v.count === 0
          if (isColor) {
            return (
              <button
                key={v.value}
                type="button"
                onClick={() => onToggle(v.slug ?? v.value)}
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
              onClick={() => onToggle(v.slug ?? v.value)}
              aria-pressed={active}
              className={clx(
                "rounded-full border px-3.5 py-2 text-sm font-bold transition-colors",
                active
                  ? "border-brand-dark bg-brand-dark text-white"
                  : "border-brand-dark/15 text-brand-dark hover:border-brand-dark/40",
                // Bifat, dar fără rezultate în combinația curentă: rămâne
                // clicabil ca să poată fi debifat, doar că se vede că e o
                // fundătură.
                deadEnd && "opacity-50"
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

      {collapsible && (expanded || hidden > 0) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-dark/60 underline-offset-2 transition-colors hover:text-brand-accent hover:underline"
        >
          {expanded ? (
            <>
              <CaretUp size={12} weight="bold" />
              Vezi mai puțin
            </>
          ) : (
            <>
              <CaretDown size={12} weight="bold" />
              Vezi încă {hidden}
            </>
          )}
        </button>
      )}
    </section>
  )
}

type RangeSectionProps = {
  title: string
  range: { min: number; max: number }
  value: PriceRange
  step: number | "any"
  onChange: (next: PriceRange) => void
}

const RangeSection = ({ title, range, value, step, onChange }: RangeSectionProps) => {
  const toNum = (v: string): number | null => {
    if (v.trim() === "") return null
    const n = Number(v.replace(",", "."))
    return Number.isFinite(n) ? n : null
  }
  const inputClass =
    "w-full rounded-xl border border-brand-dark/15 bg-white px-3 py-2.5 text-sm font-medium text-brand-dark outline-none transition-colors focus:border-brand-dark [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  return (
    <section className="border-b border-brand-dark/10 py-4 first:pt-0">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-dark/50">
        {title}
      </h3>
      <div className="flex items-center gap-2.5">
        <label className="flex-1">
          <span className="sr-only">{title} minim</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={step}
            placeholder={String(range.min)}
            value={value.min ?? ""}
            onChange={(e) => onChange({ ...value, min: toNum(e.target.value) })}
            className={inputClass}
          />
        </label>
        <span className="text-brand-dark/40">–</span>
        <label className="flex-1">
          <span className="sr-only">{title} maxim</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={step}
            placeholder={String(range.max)}
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
