"use client"

import { ArrowRight } from "@phosphor-icons/react/dist/ssr"
import { useEffect, useRef, useState } from "react"

import type { RailTab } from "@lib/util/rail"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import RailTabs from "@modules/home/components/product-rail/rail-tabs"
import ProductCard from "@modules/products/components/product-card"

type IconicProductsGridProps = {
  tabs: RailTab[]
}

const IconicProductsGrid = ({ tabs }: IconicProductsGridProps) => {
  const rootRef = useRef<HTMLElement | null>(null)
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "all")

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0]

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    )
    root.querySelectorAll(".reveal-up").forEach((el) => observer.observe(el))
    return () => observer.disconnect()
    // Cardurile se schimbă la fiecare tab, deci observatorul se refac; fără
    // asta, cardurile tabului nou ar rămâne invizibile (clasa `active` se pune
    // o singură dată, la intrarea în cadru).
  }, [activeId])

  if (!active) return null

  return (
    <section
      ref={rootRef}
      className="py-10 sm:py-16 px-4 sm:px-8 max-w-[1800px] mx-auto bg-white rounded-[2rem] sm:rounded-[4rem] my-8 shadow-sm"
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col gap-5 sm:gap-6 mb-8 sm:mb-12">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
            <h2 className="font-serif text-3xl sm:text-4xl text-brand-dark">
              Produse recomandate
            </h2>
            <p className="text-sm text-brand-dark/55">
              Alegerile echipei, pe categorii.
            </p>
          </div>
          <RailTabs
            tabs={tabs}
            activeId={active.id}
            onSelect={setActiveId}
            ariaLabel="Produse recomandate"
          />
        </div>

        {/* Grid 2 coloane pe mobil (statice), 4 pe desktop. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-8 sm:gap-y-16">
          {active.products.map((product, index) => (
            <div
              key={product.id}
              // Pe mobil rămân patru carduri: cu taburi, opt ar împinge restul
              // paginii cu două ecrane în jos.
              className={`reveal-up min-w-0 ${index >= 4 ? "hidden sm:block" : ""}`}
              style={{ transitionDelay: `${(index + 1) * 100}ms` }}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        <div className="mt-10 sm:mt-16 text-center">
          <LocalizedClientLink
            href="/store"
            className="inline-flex items-center gap-2 bg-brand-light text-brand-dark px-8 py-4 rounded-full font-bold text-sm hover:bg-brand-dark hover:text-white transition-all duration-300 group"
          >
            Vezi tot catalogul{" "}
            <ArrowRight
              size={18}
              className="group-hover:translate-x-1 transition-transform"
            />
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}

export default IconicProductsGrid
