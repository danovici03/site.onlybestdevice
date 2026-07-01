"use client"

import { CaretDown } from "@phosphor-icons/react"
import { clx } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"

type ProductDescriptionProps = {
  text: string
}

const ProductDescription = ({ text }: ProductDescriptionProps) => {
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const collapsedHeight = el.clientHeight
      const fullHeight = el.scrollHeight
      setOverflows(fullHeight > collapsedHeight + 1)
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <p
          ref={ref}
          className={clx(
            "text-brand-dark/60 leading-relaxed whitespace-pre-line",
            !expanded && "line-clamp-6"
          )}
          data-testid="product-description"
        >
          {text}
        </p>
        {!expanded && overflows && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-brand-light via-brand-light/85 to-transparent"
          />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="self-start inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] font-bold text-brand-dark hover:text-brand-accent transition-colors"
        >
          <span>{expanded ? "Arată mai puțin" : "Citește mai mult"}</span>
          <CaretDown
            size={12}
            weight="bold"
            className={clx(
              "transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      )}
    </div>
  )
}

export default ProductDescription
