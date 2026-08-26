"use client"

import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react"
import { HttpTypes } from "@medusajs/types"
import { ArrowLeft, ArrowRight, X } from "@phosphor-icons/react/dist/ssr"
import useEmblaCarousel from "embla-carousel-react"
import { Fragment, useCallback, useEffect } from "react"

import Image from "@modules/common/components/image"
import { useDotButton } from "@modules/common/components/carousel/embla-carousel-hooks"

type ImageLightboxProps = {
  images: HttpTypes.StoreProductImage[]
  /** Poza de la care se deschide galeria (indexul din `images`). */
  startIndex: number
  title: string
  isOpen: boolean
  close: () => void
  /** Ține galeria din pagină pe aceeași poză ca cea privită full-screen. */
  onIndexChange?: (index: number) => void
}

/**
 * Galerie full-screen peste pagina de produs: swipe pe mobil, săgeți + tastele
 * ←/→ pe desktop, miniaturi jos. Se închide cu Escape, cu butonul X sau cu un
 * clic pe suprafața pozei — panoul ocupă tot ecranul, deci „click outside" din
 * Headless UI n-ar avea unde să cadă; de la el rămân focus trap-ul și blocarea
 * scroll-ului paginii.
 *
 * Caruselul e Embla, ca restul site-ului — vezi `embla-carousel-hooks`. Cu
 * `loop: true` spațierea între slide-uri NU se face cu `gap` (Embla mută
 * slide-urile prin translate și gap-ul dispare peste cusătura buclei), ci prin
 * pattern-ul canonic `-ml-*` pe container + `pl-*` pe slide.
 */
const ImageLightbox = ({
  images,
  startIndex,
  title,
  isOpen,
  close,
  onIndexChange,
}: ImageLightboxProps) => {
  const loop = images.length > 1
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop, startIndex })
  const { selectedIndex } = useDotButton(emblaApi)

  const [thumbsRef, thumbsApi] = useEmblaCarousel({
    align: "center",
    containScroll: "keepSnaps",
    dragFree: true,
  })

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  // Panoul se remontează la fiecare deschidere, deci `startIndex` din opțiuni
  // ar fi de ajuns; sărim explicit (fără animație) ca să fim siguri că poza
  // apăsată e cea afișată, indiferent de ordinea în care se inițializează Embla.
  useEffect(() => {
    if (isOpen) {
      emblaApi?.scrollTo(startIndex, true)
      thumbsApi?.scrollTo(startIndex, true)
    }
  }, [isOpen, startIndex, emblaApi, thumbsApi])

  // Miniatura activă rămâne mereu în cadru.
  useEffect(() => {
    thumbsApi?.scrollTo(selectedIndex)
  }, [selectedIndex, thumbsApi])

  // Notificăm galeria din pagină, ca la închidere să rămână pe aceeași poză.
  // `startIndex` NU se rescrie din asta — altfel efectul de mai sus ar sări
  // înapoi la poza de start la fiecare navigare.
  useEffect(() => {
    if (isOpen) onIndexChange?.(selectedIndex)
  }, [isOpen, selectedIndex, onIndexChange])

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") scrollPrev()
      if (event.key === "ArrowRight") scrollNext()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, scrollPrev, scrollNext])

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[80]" onClose={close}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-brand-dark/95 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="flex h-full w-full flex-col">
              <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6">
                <span className="text-sm tabular-nums text-white/70">
                  {images.length > 1
                    ? `${selectedIndex + 1} / ${images.length}`
                    : title}
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Închide galeria"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="relative min-h-0 flex-1">
                <div ref={emblaRef} className="h-full overflow-hidden">
                  <div className="flex h-full -ml-4 [touch-action:pan-y_pinch-zoom]">
                    {images.map((image, index) => (
                      <div
                        key={image.id}
                        onClick={close}
                        role="presentation"
                        className="relative h-full w-full flex-none cursor-zoom-out pl-4"
                      >
                        {!!image.url && (
                          <Image
                            src={image.url}
                            alt={`${title} — ${index + 1}`}
                            fill
                            sizes="100vw"
                            draggable={false}
                            priority={index === startIndex}
                            className="object-contain p-4 sm:p-8"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={scrollPrev}
                      aria-label="Imaginea anterioară"
                      className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 sm:flex"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={scrollNext}
                      aria-label="Imaginea următoare"
                      className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 sm:flex"
                    >
                      <ArrowRight size={20} />
                    </button>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex justify-center px-4 py-4 sm:px-6">
                  <div ref={thumbsRef} className="overflow-hidden">
                    <div className="flex gap-3 [touch-action:pan-y_pinch-zoom]">
                      {images.map((image, index) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => emblaApi?.scrollTo(index)}
                          aria-label={`Vezi imaginea ${index + 1}`}
                          aria-current={
                            index === selectedIndex ? "true" : undefined
                          }
                          className={`relative aspect-square w-16 flex-none overflow-hidden rounded-xl bg-white transition-opacity sm:w-20 ${
                            index === selectedIndex
                              ? "ring-2 ring-white"
                              : "opacity-60 hover:opacity-100"
                          }`}
                        >
                          {!!image.url && (
                            <Image
                              src={image.url}
                              alt={`${title} — miniatură ${index + 1}`}
                              fill
                              sizes="80px"
                              draggable={false}
                              className="object-contain p-1.5"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}

export default ImageLightbox
