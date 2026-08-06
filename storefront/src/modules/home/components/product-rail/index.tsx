"use client"

import { HttpTypes } from "@medusajs/types"
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr"
import useEmblaCarousel from "embla-carousel-react"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  RAIL_MAX_ITEMS,
  RAIL_PAGE_SIZE,
  type RailKind,
  type RailTab,
} from "@lib/util/rail"
import { usePrevNextButtons } from "@modules/common/components/carousel/embla-carousel-hooks"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductCard from "@modules/products/components/product-card"

import { loadRailPage } from "./actions"
import RailTabs from "./rail-tabs"

type TabState = {
  products: HttpTypes.StoreProduct[]
  page: number
  hasMore: boolean
  loading: boolean
}

type ProductRailProps = {
  kind: RailKind
  countryCode: string
  title: string
  subtitle?: string
  tabs: RailTab[]
  ctaHref: string
  ctaLabel: string
  /** Câte produse aduce o încărcare; prima pagină vine deja randată. */
  pageSize?: number
}

/**
 * Rail-ul de produse de pe prima pagină: taguri de categorie, drag cu
 * momentum și încărcare pe măsură ce clientul trage spre capăt.
 *
 * Prima pagină vine randată de pe server (deci există și fără JS, și în HTML-ul
 * indexat), iar restul se cere prin acțiunea `loadRailPage` când drag-ul ajunge
 * aproape de ultimele carduri — nu la click pe „încarcă încă”.
 *
 * Fiecare tab își ține propriile produse: revenind la un tab deja derulat,
 * cardurile încărcate rămân acolo, nu se cer din nou.
 */
const ProductRail = ({
  kind,
  countryCode,
  title,
  subtitle,
  tabs,
  ctaHref,
  ctaLabel,
  pageSize = RAIL_PAGE_SIZE,
}: ProductRailProps) => {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "all")
  const [state, setState] = useState<Record<string, TabState>>(() =>
    Object.fromEntries(
      tabs.map((t) => [
        t.id,
        { products: t.products, page: 1, hasMore: t.hasMore, loading: false },
      ])
    )
  )

  // Sursa de adevăr pentru încărcare stă în ref: evenimentele Embla vin des și
  // ar citi altfel un state învechit, cerând de două ori aceeași pagină.
  const stateRef = useRef(state)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
  })
  const { prevBtnDisabled, nextBtnDisabled, onPrevButtonClick, onNextButtonClick } =
    usePrevNextButtons(emblaApi)

  const update = useCallback(
    (tabId: string, fn: (s: TabState) => TabState) => {
      setState((prev) => {
        const current = prev[tabId]
        if (!current) return prev
        const next = { ...prev, [tabId]: fn(current) }
        stateRef.current = next
        return next
      })
    },
    []
  )

  const loadMore = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId)
      const current = stateRef.current[tabId]
      if (!tab || !current || current.loading || !current.hasMore) return

      update(tabId, (s) => ({ ...s, loading: true }))

      try {
        const next = await loadRailPage(
          {
            kind,
            countryCode,
            category: tab.category,
            categoryIds: tab.categoryIds,
          },
          current.page + 1,
          pageSize
        )

        update(tabId, (s) => {
          // Clasamentul și umplutura se pot suprapune la margine — un produs
          // adăugat de două ori ar sparge cheia de React și ar arăta dublat.
          const seen = new Set(s.products.map((p) => p.id))
          const fresh = next.products.filter((p) => !seen.has(p.id))
          const products = [...s.products, ...fresh]
          return {
            products,
            page: s.page + 1,
            loading: false,
            hasMore: next.hasMore && products.length < RAIL_MAX_ITEMS,
          }
        })
      } catch {
        // O pagină picată nu trebuie să lase rail-ul cerând la nesfârșit.
        update(tabId, (s) => ({ ...s, loading: false, hasMore: false }))
      }
    },
    [countryCode, kind, pageSize, tabs, update]
  )

  // Încărcarea se declanșează din drag: când ultimele carduri intră în cadru,
  // cerem pagina următoare, ca ea să fie deja acolo când clientul ajunge.
  useEffect(() => {
    if (!emblaApi) return

    const maybeLoad = () => {
      const inView = emblaApi.slidesInView()
      const total = emblaApi.slideNodes().length
      const last = inView.length ? Math.max(...inView) : 0
      if (last >= total - 3) {
        void loadMore(activeIdRef.current)
      }
    }

    emblaApi
      .on("slidesInView", maybeLoad)
      .on("select", maybeLoad)
      .on("reInit", maybeLoad)
    maybeLoad()

    return () => {
      emblaApi
        .off("slidesInView", maybeLoad)
        .off("select", maybeLoad)
        .off("reInit", maybeLoad)
    }
  }, [emblaApi, loadMore])

  const active = state[activeId] ?? state[tabs[0]?.id ?? ""]

  // Embla măsoară slide-urile o singură dată; cardurile adăugate la drag n-ar
  // intra în geometrie fără reInit, iar caruselul s-ar opri la vechiul capăt.
  useEffect(() => {
    emblaApi?.reInit()
  }, [emblaApi, active?.products.length])

  if (!tabs.length || !active) return null

  return (
    <section className="content-container my-12 sm:my-16 lg:my-24">
      <div className="flex flex-col gap-5 sm:gap-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-brand-dark">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-brand-dark/55 max-w-xl">{subtitle}</p>
            )}
          </div>
          <LocalizedClientLink
            href={ctaHref}
            className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-brand-dark hover:text-brand-accent transition-colors shrink-0"
          >
            {ctaLabel}
            <ArrowRight size={16} weight="bold" />
          </LocalizedClientLink>
        </div>

        <div className="flex items-center justify-between gap-4">
          <RailTabs
            tabs={tabs}
            activeId={activeId}
            onSelect={setActiveId}
            ariaLabel={title}
          />
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onPrevButtonClick}
              disabled={prevBtnDisabled}
              aria-label="Anterior"
              className="h-11 w-11 rounded-full border border-brand-dark/15 flex items-center justify-center text-brand-dark transition-colors hover:bg-brand-dark hover:text-white hover:border-brand-dark disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-brand-dark disabled:hover:border-brand-dark/15"
            >
              <ArrowLeft size={16} weight="bold" />
            </button>
            <button
              type="button"
              onClick={onNextButtonClick}
              disabled={nextBtnDisabled}
              aria-label="Următor"
              className="h-11 w-11 rounded-full border border-brand-dark/15 flex items-center justify-center text-brand-dark transition-colors hover:bg-brand-dark hover:text-white hover:border-brand-dark disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-brand-dark disabled:hover:border-brand-dark/15"
            >
              <ArrowRight size={16} weight="bold" />
            </button>
          </div>
        </div>

        {/* Viewport-ul se remontează la schimbarea tabului (key), ca Embla să
            repornească din prima poziție cu geometria noilor carduri. */}
        <div key={activeId} ref={emblaRef} className="overflow-hidden -mx-4 px-4">
          <div className="flex gap-4 sm:gap-6 [touch-action:pan-y_pinch-zoom]">
            {active.products.map((product) => (
              <div
                key={product.id}
                // `flex-none` + lățime explicită: fără el flexbox comprimă
                // toate cardurile unul peste altul.
                className="flex-none w-[46%] sm:w-[31%] lg:w-[23%] xl:w-[22%]"
              >
                <ProductCard product={product} />
              </div>
            ))}
            {active.loading && (
              <div className="flex-none w-[46%] sm:w-[31%] lg:w-[23%] xl:w-[22%]">
                <div className="h-full min-h-[18rem] rounded-[1.5rem] border border-brand-dark/[0.07] bg-white p-2.5 sm:p-3">
                  <div className="aspect-[6/5] sm:aspect-square w-full rounded-[1.1rem] bg-brand-light animate-pulse" />
                  <div className="mt-3 h-3 w-2/3 rounded-full bg-brand-light animate-pulse" />
                  <div className="mt-2 h-3 w-1/3 rounded-full bg-brand-light animate-pulse" />
                </div>
              </div>
            )}
          </div>
        </div>

        <LocalizedClientLink
          href={ctaHref}
          className="sm:hidden inline-flex items-center justify-center gap-2 bg-brand-light text-brand-dark px-6 py-3.5 rounded-full font-bold text-sm"
        >
          {ctaLabel}
          <ArrowRight size={16} weight="bold" />
        </LocalizedClientLink>
      </div>
    </section>
  )
}

export default ProductRail
