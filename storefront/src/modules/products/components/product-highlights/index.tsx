import { HttpTypes } from "@medusajs/types"
import {
  ArrowsOutSimple,
  Drop,
  Hammer,
  Leaf,
  Package,
  Ruler,
  Scales,
  ShieldCheck,
  Sparkle,
  Tree,
} from "@phosphor-icons/react/dist/ssr"

const ICONS = {
  ruler: Ruler,
  dimensions: Ruler,
  size: ArrowsOutSimple,
  weight: Scales,
  material: Tree,
  wood: Tree,
  leaf: Leaf,
  warranty: ShieldCheck,
  shield: ShieldCheck,
  package: Package,
  hammer: Hammer,
  drop: Drop,
  sparkle: Sparkle,
} as const

type Highlight = {
  icon?: string
  value: string
  label: string
}

const isHighlight = (h: unknown): h is Highlight => {
  if (!h || typeof h !== "object") return false
  const obj = h as Record<string, unknown>
  return typeof obj.value === "string" && typeof obj.label === "string"
}

type ProductHighlightsProps = {
  product: HttpTypes.StoreProduct
}

const ProductHighlights = ({ product }: ProductHighlightsProps) => {
  const meta = (product.metadata ?? {}) as Record<string, unknown>
  const raw = meta.highlights

  const highlights: Highlight[] = Array.isArray(raw)
    ? raw.filter(isHighlight)
    : []

  if (highlights.length === 0) return null

  return (
    <div className="rounded-[2rem] border border-brand-dark/10 bg-white p-5 lg:p-6">
      <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50 mb-4">
        Caratteristiche
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {highlights.map((h, i) => {
          const key = h.icon?.toLowerCase() as keyof typeof ICONS | undefined
          const Icon = (key && ICONS[key]) || Sparkle
          return (
            <div
              key={`${h.label}-${i}`}
              className="flex items-center gap-3 rounded-2xl bg-brand-light/60 px-4 py-3"
            >
              <Icon
                size={22}
                weight="regular"
                className="text-brand-dark shrink-0"
              />
              <div className="min-w-0">
                <div className="font-bold text-brand-dark text-sm leading-tight truncate">
                  {h.value}
                </div>
                <div className="text-xs text-brand-dark/60 leading-tight truncate">
                  {h.label}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ProductHighlights
