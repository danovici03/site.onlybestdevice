"use client"

import { getProductPrice } from "@lib/util/get-product-price"
import {
  SHOWROOM_BADGE_LABEL,
  isShowroomProduct,
} from "@lib/util/showroom"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import { ArrowLeft, ArrowRight, Star } from "@phosphor-icons/react/dist/ssr"
import { usePrevNextButtons } from "@modules/common/components/carousel/embla-carousel-hooks"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import useEmblaCarousel from "embla-carousel-react"
import Image from "next/image"
import { useState } from "react"

type Tab = {
  id: string
  handle: string
  label: string
  products: HttpTypes.StoreProduct[]
}

type BestSellersTabsProps = {
  tabs: Tab[]
}

const getBadge = (product: HttpTypes.StoreProduct): string | null => {
  if (isShowroomProduct(product)) return SHOWROOM_BADGE_LABEL
  const tags = (product.tags ?? []).map((t) => t.value?.toLowerCase() ?? "")
  if (tags.includes("new") || tags.includes("nuovo") || tags.includes("nou"))
    return "Nou"
  if (tags.includes("bestseller") || tags.includes("best-seller"))
    return "Best seller"
  if (tags.includes("sale") || tags.includes("saldo") || tags.includes("reducere"))
    return "Reducere"
  return null
}

const getRating = (product: HttpTypes.StoreProduct): number | null => {
  const meta = (product.metadata ?? {}) as Record<string, unknown>
  const r = meta.rating
  if (typeof r === "number") return r
  if (typeof r === "string") {
    const n = Number(r)
    return Number.isNaN(n) ? null : n
  }
  return null
}

const getColorOption = (product: HttpTypes.StoreProduct) => {
  const opt = (product.options ?? []).find((o) =>
    /colou?r|culoare/i.test(o.title ?? "")
  )
  return opt
}

const ProductCard = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const { cheapestPrice } = getProductPrice({ product })
  const badge = getBadge(product)
  const rating = getRating(product)
  const colorOption = getColorOption(product)

  const swatches: { value: string; image?: string }[] = (
    colorOption?.values ?? []
  )
    .map((v) => {
      const variant = (product.variants ?? []).find((variantItem) =>
        (variantItem.options ?? []).some(
          (vo: any) => vo.option_id === colorOption?.id && vo.value === v.value
        )
      )
      const image = (variant as any)?.images?.[0]?.url as string | undefined
      return { value: v.value, image }
    })
    .slice(0, 4)

  const thumb = product.thumbnail ?? product.images?.[0]?.url

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="group block w-[260px] sm:w-[300px] shrink-0"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] bg-brand-light mb-4">
        {thumb && (
          <Image
            src={thumb}
            alt={product.title ?? ""}
            fill
            sizes="(min-width: 1024px) 25vw, 80vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
        {badge && (
          <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white text-brand-dark">
            {badge}
          </span>
        )}
        {rating !== null && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-xs font-bold text-brand-dark">
            <Star size={12} weight="fill" className="text-brand-accent" />
            {rating.toFixed(1)}
          </span>
        )}
      </div>
      <div className="px-1 flex flex-col gap-1.5">
        {product.collection && (
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-brand-dark/50">
            {product.collection.title}
          </span>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-bold text-brand-dark leading-tight truncate">
            {product.title}
          </h3>
          {cheapestPrice && (
            <span className="font-bold text-brand-dark shrink-0">
              {cheapestPrice.calculated_price}
            </span>
          )}
        </div>
        {swatches.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {swatches.map((s) =>
              s.image ? (
                <span
                  key={s.value}
                  className="relative h-5 w-5 rounded-md overflow-hidden border border-brand-dark/10"
                  title={s.value}
                >
                  <Image src={s.image} alt={s.value} fill sizes="20px" />
                </span>
              ) : (
                <span
                  key={s.value}
                  className="px-1.5 h-5 inline-flex items-center rounded-md bg-brand-light text-[10px] font-bold text-brand-dark/70"
                >
                  {s.value}
                </span>
              )
            )}
          </div>
        )}
      </div>
    </LocalizedClientLink>
  )
}

const BestSellersTabs = ({ tabs }: BestSellersTabsProps) => {
  const [activeId, setActiveId] = useState(tabs[0]?.id)
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start" })
  const { onPrevButtonClick, onNextButtonClick } = usePrevNextButtons(emblaApi)

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0]

  return (
    <section className="content-container my-16 lg:my-24">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <h2 className="font-serif text-4xl lg:text-5xl text-brand-dark">
            Cele mai vândute
          </h2>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-manipulation overscroll-x-contain">
              {tabs.map((tab) => {
                const isActive = tab.id === active?.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveId(tab.id)}
                    className={clx(
                      "px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors",
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
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onPrevButtonClick}
                aria-label="Anterior"
                className="h-11 w-11 rounded-full border border-brand-dark/15 flex items-center justify-center text-brand-dark hover:bg-brand-dark hover:text-white hover:border-brand-dark transition-colors"
              >
                <ArrowLeft size={16} weight="bold" />
              </button>
              <button
                type="button"
                onClick={onNextButtonClick}
                aria-label="Următor"
                className="h-11 w-11 rounded-full border border-brand-dark/15 flex items-center justify-center text-brand-dark hover:bg-brand-dark hover:text-white hover:border-brand-dark transition-colors"
              >
                <ArrowRight size={16} weight="bold" />
              </button>
            </div>
          </div>
        </div>

        <div
          key={activeId}
          ref={emblaRef}
          className="overflow-hidden -mx-4 px-4"
        >
          <div className="flex gap-6 pb-2 [touch-action:pan-y_pinch-zoom]">
            {active?.products.map((p) => (
              <div key={p.id} className="flex-none">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default BestSellersTabs
