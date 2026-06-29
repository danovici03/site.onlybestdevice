"use client"

import { HttpTypes } from "@medusajs/types"
import { ArrowRight } from "@phosphor-icons/react/dist/ssr"
import { useEffect, useRef } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductCard from "@modules/products/components/product-card"

type IconicProductsGridProps = {
  products: HttpTypes.StoreProduct[]
}

const IconicProductsGrid = ({ products }: IconicProductsGridProps) => {
  const rootRef = useRef<HTMLElement | null>(null)

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
  }, [])

  return (
    <section
      ref={rootRef}
      className="py-10 sm:py-16 px-4 sm:px-8 max-w-[1800px] mx-auto bg-white rounded-[2rem] sm:rounded-[4rem] my-8 shadow-sm"
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 sm:mb-12 reveal-up">
          <h2 className="font-serif text-3xl sm:text-4xl text-brand-dark">
            Produse recomandate
          </h2>
        </div>

        {/* Grid 2 coloane pe mobil (statice), 4 pe desktop. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-8 sm:gap-y-16">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="reveal-up min-w-0"
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
