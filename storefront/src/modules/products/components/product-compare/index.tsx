"use client"

import { HttpTypes } from "@medusajs/types"
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

type Side = {
  label: string
  image: string
}

type CompareData = {
  left: Side
  right: Side
  title?: string
}

const isSide = (s: unknown): s is Side => {
  if (!s || typeof s !== "object") return false
  const obj = s as Record<string, unknown>
  return typeof obj.label === "string" && typeof obj.image === "string"
}

const parseCompare = (raw: unknown): CompareData | null => {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  if (!isSide(obj.left) || !isSide(obj.right)) return null
  return {
    left: obj.left,
    right: obj.right,
    title: typeof obj.title === "string" ? obj.title : undefined,
  }
}

type ProductCompareProps = {
  product: HttpTypes.StoreProduct
}

const ProductCompare = ({ product }: ProductCompareProps) => {
  const meta = (product.metadata ?? {}) as Record<string, unknown>
  const data = parseCompare(meta.compare)

  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(50)
  const [dragging, setDragging] = useState(false)

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.max(0, Math.min(100, pct)))
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent | TouchEvent) => {
      const x =
        "touches" in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX
      if (typeof x === "number") updateFromClientX(x)
    }
    const onUp = () => setDragging(false)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("touchmove", onMove)
    window.addEventListener("mouseup", onUp)
    window.addEventListener("touchend", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("touchend", onUp)
    }
  }, [dragging, updateFromClientX])

  if (!data) return null

  return (
    <section className="content-container my-16 lg:my-24">
      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-serif text-3xl lg:text-4xl text-brand-dark">
            {data.title ?? "Confronta finiture"}
          </h2>
          <div className="hidden sm:flex items-center gap-3 text-sm text-brand-dark/60">
            <span>{data.left.label}</span>
            <span className="h-px w-8 bg-brand-dark/20" />
            <span>{data.right.label}</span>
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative aspect-[16/9] w-full overflow-hidden rounded-[2rem] bg-brand-light select-none"
          onMouseDown={(e) => {
            setDragging(true)
            updateFromClientX(e.clientX)
          }}
          onTouchStart={(e) => {
            setDragging(true)
            const x = e.touches[0]?.clientX
            if (typeof x === "number") updateFromClientX(x)
          }}
        >
          <Image
            src={data.right.image}
            alt={data.right.label}
            fill
            sizes="(min-width: 1024px) 80vw, 100vw"
            className="object-cover pointer-events-none"
            priority={false}
          />
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ width: `${position}%` }}
          >
            <div className="relative h-full" style={{ width: `${(100 / Math.max(position, 0.0001)) * 100}%` }}>
              <Image
                src={data.left.image}
                alt={data.left.label}
                fill
                sizes="(min-width: 1024px) 80vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>

          <div
            className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/90 backdrop-blur text-xs font-bold uppercase tracking-wider text-brand-dark"
            style={{
              opacity: position > 12 ? 1 : 0,
              transition: "opacity 150ms",
            }}
          >
            {data.left.label}
          </div>
          <div
            className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/90 backdrop-blur text-xs font-bold uppercase tracking-wider text-brand-dark"
            style={{
              opacity: position < 88 ? 1 : 0,
              transition: "opacity 150ms",
            }}
          >
            {data.right.label}
          </div>

          <div
            className="absolute top-0 bottom-0 w-px bg-white pointer-events-none"
            style={{ left: `${position}%` }}
          />
          <button
            type="button"
            role="slider"
            aria-label="Trage sau folosește săgețile pentru a compara"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            aria-valuetext={`${Math.round(position)}%`}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white shadow-lg flex items-center justify-center cursor-ew-resize touch-none focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2"
            style={{ left: `${position}%` }}
            onMouseDown={(e) => {
              e.stopPropagation()
              setDragging(true)
            }}
            onTouchStart={(e) => {
              e.stopPropagation()
              setDragging(true)
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 10 : 5
              if (e.key === "ArrowLeft") {
                e.preventDefault()
                setPosition((p) => Math.max(0, p - step))
              } else if (e.key === "ArrowRight") {
                e.preventDefault()
                setPosition((p) => Math.min(100, p + step))
              } else if (e.key === "Home") {
                e.preventDefault()
                setPosition(0)
              } else if (e.key === "End") {
                e.preventDefault()
                setPosition(100)
              }
            }}
          >
            <CaretLeft size={14} weight="bold" className="text-brand-dark" />
            <CaretRight size={14} weight="bold" className="text-brand-dark" />
          </button>
        </div>
      </div>
    </section>
  )
}

export default ProductCompare
