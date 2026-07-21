"use client"

import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr"
import Autoplay from "embla-carousel-autoplay"
import useEmblaCarousel from "embla-carousel-react"
import Image from "next/image"

import { unsplashLoader } from "@lib/util/unsplash-loader"
import {
  useDotButton,
  usePrevNextButtons,
} from "@modules/common/components/carousel/embla-carousel-hooks"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export type Slide = {
  image: string
  alt: string
  titleLine1: string
  titleLine2: string
  cta: string
  href: string
}

const AUTOPLAY_MS = 6000

// Imaginile placeholder vin de pe Unsplash (au nevoie de loader-ul cu query
// params). Cele administrate din admin vin din storage-ul propriu (S3/local)
// și folosesc optimizatorul implicit Next.
const isUnsplash = (src: string) => src.includes("images.unsplash.com")

const HeroCarousel = ({ slides }: { slides: Slide[] }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center" },
    [Autoplay({ delay: AUTOPLAY_MS, stopOnInteraction: false })]
  )
  const { selectedIndex } = useDotButton(emblaApi)
  const { onPrevButtonClick, onNextButtonClick } = usePrevNextButtons(emblaApi)

  if (slides.length === 0) {
    return null
  }

  return (
    // -mt-20 ridică hero-ul sub header-ul sticky (h-20) ca să curgă în spatele
    // navului transparent. Bara de sus (TopBar) rămâne vizibilă deasupra.
    <section className="relative w-full -mt-20">
      <div ref={emblaRef} className="overflow-hidden">
        {/* Slide-uri full-bleed, lipite (fără gap) — loop:true e ok fără spacing. */}
        <div className="flex [touch-action:pan-y_pinch-zoom]">
          {slides.map((slide, index) => (
            <div key={index} className="flex-none w-full min-w-0">
              {/* Full-screen pe orice device: 100svh minus bara de sus, ca
                  slide-ul să se termine fix la marginea de jos a ecranului.
                  svh (nu vh) ca să nu sară la apariția barelor de browser mobil. */}
              <div className="relative h-[calc(100svh-var(--topbar-h))] min-h-[30rem] w-full isolate">
                <Image
                  loader={isUnsplash(slide.image) ? unsplashLoader : undefined}
                  src={slide.image}
                  alt={slide.alt}
                  fill
                  sizes="100vw"
                  priority={index === 0}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  draggable={false}
                  className="object-cover"
                />
                {/* Întunecare generală pentru lizibilitate */}
                <div className="absolute inset-0 bg-black/20" />
                {/* Gradient închis SUS — sub el se integrează meniul alb */}
                <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/75 via-black/30 to-transparent" />
                {/* Gradient JOS — pentru titlu + CTA */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                {/* Textul + CTA apar doar pe slide-ul activ (cel din mijloc) */}
                <div
                  className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-500 ${
                    index === selectedIndex
                      ? "opacity-100"
                      : "opacity-0 pointer-events-none"
                  }`}
                  aria-hidden={index !== selectedIndex}
                >
                  {/* Sub lg e vizibilă BottomNav-ul fix (~4.5rem + safe area),
                      deci titlul/CTA au nevoie de spațiu suplimentar dedesubt. */}
                  <div className="w-full max-w-[1920px] mx-auto px-6 sm:px-12 lg:px-20 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-28">
                    <h2 className="font-sans font-black uppercase text-4xl sm:text-6xl lg:text-7xl text-white leading-[1.05] tracking-tight mb-6 sm:mb-8 max-w-4xl">
                      {slide.titleLine1}
                      {slide.titleLine2 && (
                        <>
                          <br />
                          {slide.titleLine2}
                        </>
                      )}
                    </h2>
                    {slide.cta && slide.href && (
                      <LocalizedClientLink
                        href={slide.href}
                        draggable={false}
                        tabIndex={index === selectedIndex ? 0 : -1}
                        className="inline-block bg-white text-brand-dark px-6 py-3 sm:px-8 sm:py-4 rounded-full text-xs sm:text-sm font-bold hover:bg-brand-accent hover:text-white transition-all duration-300 transform hover:scale-105"
                      >
                        {slide.cta}
                      </LocalizedClientLink>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Săgeți — pe lateral, centrate vertical. Ascunse când e un singur slide. */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={onPrevButtonClick}
            aria-label="Slide precedent"
            className="hidden sm:flex absolute top-1/2 -translate-y-1/2 left-4 lg:left-8 z-30 h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm hover:bg-white/20 hover:text-white transition-colors"
          >
            <ArrowLeft size={24} weight="light" />
          </button>
          <button
            type="button"
            onClick={onNextButtonClick}
            aria-label="Slide următor"
            className="hidden sm:flex absolute top-1/2 -translate-y-1/2 right-4 lg:right-8 z-30 h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm hover:bg-white/20 hover:text-white transition-colors"
          >
            <ArrowRight size={24} weight="light" />
          </button>

          {/* Indicatori (dots) */}
          <div className="absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-8 left-1/2 -translate-x-1/2 flex gap-3 pointer-events-none z-30">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full border border-white transition-colors duration-300 ${
                  index === selectedIndex ? "bg-white" : "bg-transparent"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default HeroCarousel
