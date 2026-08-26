"use client"

import { HttpTypes } from "@medusajs/types"
import { useSearchParams } from "next/navigation"
import { ArrowsOutSimple } from "@phosphor-icons/react/dist/ssr"
import Image from "@modules/common/components/image"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import useEmblaCarousel from "embla-carousel-react"

import { useDotButton } from "@modules/common/components/carousel/embla-carousel-hooks"
import ImageLightbox from "./lightbox"

type ImageGalleryProps = {
  product: HttpTypes.StoreProduct
}

/**
 * `useSearchParams()` face bailout la prerender, iar galeria e imaginea LCP —
 * n-o putem ascunde sub un skeleton. De aceea hook-ul stă izolat aici, sub un
 * Suspense al cărui fallback e chiar galeria cu setul implicit de poze: la
 * build nu există `?v_id=` oricum, deci HTML-ul static e identic cu ce ar fi
 * randat hook-ul. Reactivitatea la v_id (schimbi culoarea → se filtrează
 * pozele) revine la hidratare.
 */
const ImageGallery = ({ product }: ImageGalleryProps) => (
  <Suspense fallback={<GalleryInner product={product} variantId={null} />}>
    <GalleryWithParams product={product} />
  </Suspense>
)

const GalleryWithParams = ({ product }: ImageGalleryProps) => {
  const variantId = useSearchParams().get("v_id")
  return <GalleryInner product={product} variantId={variantId} />
}

const GalleryInner = ({
  product,
  variantId,
}: ImageGalleryProps & { variantId: string | null }) => {
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

  // Galeria full-screen: se deschide la clic pe orice poză (mobil sau desktop).
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }, [])

  const syncToLightbox = useCallback(
    (index: number) => {
      selectThumb(index)
      emblaApi?.scrollTo(index, true)
    },
    [selectThumb, emblaApi]
  )

  if (!images.length) {
    return <div className="aspect-[5/4] w-full rounded-[2rem] bg-brand-light" />
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
              <button
                key={image.id}
                type="button"
                onClick={() => openLightbox(index)}
                aria-label={`Deschide imaginea ${index + 1} pe tot ecranul`}
                className="relative aspect-square w-[85vw] shrink-0 min-w-0 rounded-[2rem] overflow-hidden bg-white ring-1 ring-inset ring-brand-dark/[0.07]"
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
              </button>
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
        <button
          type="button"
          onClick={() => openLightbox(safeSelected)}
          aria-label="Deschide imaginea pe tot ecranul"
          className="group relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-[2rem] bg-white ring-1 ring-inset ring-brand-dark/[0.07] img-zoom-wrapper"
        >
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
          <span className="pointer-events-none absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-dark/70 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <ArrowsOutSimple size={18} />
          </span>
        </button>

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
                  className={`relative aspect-square flex-[0_0_calc(33.333%-0.5rem)] rounded-2xl overflow-hidden bg-white transition-shadow ${
                    index === safeSelected
                      ? "ring-2 ring-brand-dark"
                      : "ring-1 ring-brand-dark/10 hover:ring-brand-dark/40"
                  }`}
                >
                  {!!image.url && (
                    <Image
                      src={image.url}
                      alt={`${product.title ?? "Product"} — miniatură ${
                        index + 1
                      }`}
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

      <ImageLightbox
        images={images}
        startIndex={lightboxIndex}
        title={product.title ?? "Produs"}
        isOpen={lightboxOpen}
        close={() => setLightboxOpen(false)}
        onIndexChange={syncToLightbox}
      />
    </>
  )
}

export default ImageGallery
