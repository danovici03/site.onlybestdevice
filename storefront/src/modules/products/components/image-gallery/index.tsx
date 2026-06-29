"use client"

import { HttpTypes } from "@medusajs/types"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import useEmblaCarousel from "embla-carousel-react"

import { useDotButton } from "@modules/common/components/carousel/embla-carousel-hooks"

type ImageGalleryProps = {
  product: HttpTypes.StoreProduct
}

const ImageGallery = ({ product }: ImageGalleryProps) => {
  const searchParams = useSearchParams()
  const variantId = searchParams.get("v_id")
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "center" })
  const { selectedIndex } = useDotButton(emblaApi)

  const images = useMemo<HttpTypes.StoreProductImage[]>(() => {
    const all = product.images ?? []
    if (!variantId || !product.variants) return all
    const variant = product.variants.find((v) => v.id === variantId)
    if (!variant) return all
    const variantImages = (variant as any).images as
      | HttpTypes.StoreProductImage[]
      | null
      | undefined
    if (!variantImages?.length) return all
    const ids = new Set(variantImages.map((i) => i.id))
    const filtered = all.filter((i) => ids.has(i.id))
    return filtered.length ? filtered : all
  }, [variantId, product])

  // Desktop: imaginea mare selectată + strip de thumbnails (3 vizibile, slide).
  const [selected, setSelected] = useState(0)
  const [thumbsRef, thumbsApi] = useEmblaCarousel({
    align: "start",
    containScroll: "keepSnaps",
    dragFree: true,
  })

  // La schimbarea variantei/setului de imagini, revino la prima poză.
  useEffect(() => {
    setSelected(0)
    thumbsApi?.scrollTo(0)
  }, [variantId, images.length, thumbsApi])

  const selectThumb = useCallback(
    (index: number) => {
      setSelected(index)
      thumbsApi?.scrollTo(index)
    },
    [thumbsApi]
  )

  if (!images.length) {
    return (
      <div className="aspect-[5/4] w-full rounded-[2rem] bg-brand-light" />
    )
  }

  const safeSelected = Math.min(selected, images.length - 1)
  const main = images[safeSelected]

  return (
    <>
      {/* Mobile: slider orizontal */}
      <div className="lg:hidden">
        <div
          key={variantId ?? "all"}
          ref={emblaRef}
          className="overflow-hidden px-4 -mx-4"
        >
          <div className="flex gap-3 [touch-action:pan-y_pinch-zoom]">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="relative aspect-square w-[85vw] shrink-0 min-w-0 rounded-[2rem] overflow-hidden bg-brand-light"
              >
                {!!image.url && (
                  <Image
                    src={image.url}
                    priority={index === 0}
                    alt={`${product.title ?? "Product"} — ${index + 1}`}
                    fill
                    sizes="100vw"
                    draggable={false}
                    className="object-contain p-4"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        {images.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === selectedIndex
                    ? "w-6 bg-brand-dark"
                    : "w-1.5 bg-brand-dark/20"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: imagine mare + thumbnails */}
      <div className="hidden lg:flex flex-col gap-3 w-full max-w-[460px] mx-auto">
        <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] bg-brand-light img-zoom-wrapper">
          {!!main?.url && (
            <Image
              key={main.id}
              src={main.url}
              priority
              fetchPriority="high"
              alt={`${product.title ?? "Product"} — ${safeSelected + 1}`}
              fill
              sizes="(min-width: 1024px) 460px, 90vw"
              className="object-contain p-6"
            />
          )}
        </div>

        {images.length > 1 && (
          <div className="overflow-hidden" ref={thumbsRef}>
            <div className="flex gap-3">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => selectThumb(index)}
                  aria-label={`Vezi imaginea ${index + 1}`}
                  aria-current={index === safeSelected ? "true" : undefined}
                  className={`relative aspect-square flex-[0_0_calc(33.333%-0.5rem)] rounded-2xl overflow-hidden bg-brand-light transition-shadow ${
                    index === safeSelected
                      ? "ring-2 ring-brand-dark"
                      : "ring-1 ring-brand-dark/10 hover:ring-brand-dark/40"
                  }`}
                >
                  {!!image.url && (
                    <Image
                      src={image.url}
                      alt={`${product.title ?? "Product"} — miniatură ${index + 1}`}
                      fill
                      sizes="(min-width: 1024px) 150px, 30vw"
                      className="object-contain p-2"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default ImageGallery
