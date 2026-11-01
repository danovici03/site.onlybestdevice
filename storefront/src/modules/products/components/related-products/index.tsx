"use client"

import { HttpTypes } from "@medusajs/types"
import { ArrowRight } from "@phosphor-icons/react/dist/ssr"
import { useEffect, useRef, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import ProductCard from "../product-card"

type RelatedProductsProps = {
  handle: string
  countryCode: string
}

/** Pornește cererea cu puțin înainte ca raftul să intre în ecran. */
const LOAD_MARGIN = "400px"

/**
 * Se încarcă din `/api/related`, doar când clientul ajunge aproape de raft.
 * Motivul e în ruta respectivă: raftul nu are voie să țină paginile de produs
 * legate de cache-ul lui.
 */
export default function RelatedProducts({
  handle,
  countryCode,
}: RelatedProductsProps) {
  const anchor = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>()

  useEffect(() => {
    const element = anchor.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: LOAD_MARGIN }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!near) return
    let cancelled = false

    fetch(`/api/related/${countryCode}/${encodeURIComponent(handle)}`)
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then(
        (data) => !cancelled && setProducts(data.products),
        () => !cancelled && setProducts([])
      )

    return () => {
      cancelled = true
    }
  }, [near, handle, countryCode])

  if (!products) {
    return (
      <div ref={anchor}>
        <SkeletonRelatedProducts />
      </div>
    )
  }

  if (!products.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-brand-dark">
            S-ar putea să-ți placă și
          </h2>
          <p className="text-sm text-brand-dark/55 max-w-xl">
            Produse din aceeași familie, alese după categorie și etichete.
          </p>
        </div>
        <LocalizedClientLink
          href="/store"
          className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-brand-dark hover:text-brand-accent transition-colors shrink-0"
        >
          Vezi tot catalogul
          <ArrowRight size={16} weight="bold" />
        </LocalizedClientLink>
      </div>

      {/* Aceeași grilă ca în catalog și aceleași carduri: raftul de sub produs
          nu trebuie să arate ca alt magazin. */}
      <ul
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 w-full"
        data-testid="related-products-list"
      >
        {products.map((p) => (
          <li key={p.id} className="h-full">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>

      <LocalizedClientLink
        href="/store"
        className="sm:hidden inline-flex items-center justify-center gap-2 bg-white text-brand-dark px-6 py-3.5 rounded-full font-bold text-sm border border-brand-dark/[0.07]"
      >
        Vezi tot catalogul
        <ArrowRight size={16} weight="bold" />
      </LocalizedClientLink>
    </div>
  )
}
