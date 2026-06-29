"use client"

import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr"
import useEmblaCarousel from "embla-carousel-react"
import Image from "next/image"
import { useEffect, useRef } from "react"

import { unsplashLoader } from "@lib/util/unsplash-loader"
import { usePrevNextButtons } from "@modules/common/components/carousel/embla-carousel-hooks"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Room = {
  href: string
  title: string
  description: string
  image: string
  alt: string
  variant: "dark" | "light"
  // Base color for the soft colored pedestal behind the product cut-out.
  // The card stays white — only the product backdrop is tinted.
  tint?: string
}

const ROOMS: Room[] = [
  {
    href: "/store",
    title: "Tot catalogul",
    description: "Descoperă toate produsele",
    image:
      "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80",
    alt: "Tot catalogul",
    variant: "dark",
  },
  {
    href: "/categories/telefoane-mobile",
    title: "Telefoane mobile",
    description: "Smartphone-uri noi, cu garanție",
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80",
    alt: "Telefoane mobile",
    variant: "light",
    tint: "#3B82F6",
  },
  {
    href: "/categories/laptop",
    title: "Laptopuri",
    description: "Pentru muncă și gaming",
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80",
    alt: "Laptopuri",
    variant: "light",
    tint: "#8B5CF6",
  },
  {
    href: "/categories/tablete",
    title: "Tablete",
    description: "Productivitate și divertisment",
    image:
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80",
    alt: "Tablete",
    variant: "light",
    tint: "#F59E0B",
  },
  {
    href: "/categories/smartatch-si-wearables",
    title: "Smartwatch & Wearables",
    description: "Ceasuri smart și brățări fitness",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80",
    alt: "Smartwatch & Wearables",
    variant: "light",
    tint: "#10B981",
  },
  {
    href: "/categories/tv-audio-video-si-foto",
    title: "TV, Audio-Video și Foto",
    description: "Sunet și imagine de calitate",
    image:
      "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80",
    alt: "TV, Audio-Video și Foto",
    variant: "light",
    tint: "#F43F5E",
  },
]

const Rooms = () => {
  const rootRef = useRef<HTMLElement | null>(null)
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
  })
  const { onPrevButtonClick, onNextButtonClick } = usePrevNextButtons(emblaApi)

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
      className="py-12 px-4 sm:px-8 max-w-[1800px] mx-auto overflow-hidden"
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 sm:mb-12 reveal-up">
        <div className="max-w-xl">
          <h2 className="font-serif text-4xl sm:text-5xl text-brand-dark mb-4">
            Cumpără pe categorii.
          </h2>
          <p className="text-brand-dark/60 font-medium">
            Explorează gama noastră de device-uri, organizată pe categorii ca
            să găsești rapid ce ai nevoie.
          </p>
        </div>

        <div className="flex items-center gap-4 mt-6 md:mt-0">
          <button
            type="button"
            onClick={onPrevButtonClick}
            aria-label="Derulează la stânga"
            className="w-12 h-12 rounded-full border border-brand-dark/20 flex items-center justify-center hover:bg-brand-dark hover:text-white transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            onClick={onNextButtonClick}
            aria-label="Derulează la dreapta"
            className="w-12 h-12 rounded-full bg-brand-dark text-white flex items-center justify-center hover:bg-brand-accent transition-all"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div
        ref={emblaRef}
        className="overflow-hidden -mx-4 px-4 sm:mx-0 sm:px-0 cursor-grab active:cursor-grabbing"
      >
        <div className="flex gap-4 sm:gap-6 pb-8 select-none [touch-action:pan-y_pinch-zoom]">
        {ROOMS.map((room, index) => {
          const isDark = room.variant === "dark"
          return (
            <LocalizedClientLink
              key={room.href}
              href={room.href}
              draggable={false}
              className={`group relative flex-none w-[210px] sm:w-[360px] h-[340px] sm:h-[480px] rounded-[1.75rem] sm:rounded-[2.5rem] overflow-hidden reveal-up ${
                isDark
                  ? "img-zoom-wrapper"
                  : "bg-white border border-brand-dark/5 hover:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.18)] transition-all duration-500 flex flex-col"
              }`}
              style={{ transitionDelay: `${(index + 1) * 100}ms` }}
            >
              {isDark ? (
                <>
                  <Image
                    loader={unsplashLoader}
                    src={room.image}
                    alt={room.alt}
                    fill
                    sizes="(min-width: 640px) 360px, 280px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors duration-500" />
                  <div className="absolute bottom-5 left-5 right-5 sm:bottom-8 sm:left-8 sm:right-8 flex justify-between items-end text-white">
                    <div>
                      <h3 className="font-bold text-xl sm:text-3xl">
                        {room.title}
                      </h3>
                      <p className="text-white/80 mt-1.5 sm:mt-2 text-xs sm:text-sm">
                        {room.description}
                      </p>
                    </div>
                    <ArrowRight
                      size={22}
                      className="group-hover:translate-x-2 transition-transform mb-1 shrink-0"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Product stage — white card with a soft colored pedestal
                      behind the floating product cut-out. */}
                  <div className="relative flex-1 flex items-center justify-center px-5 pt-5 sm:px-8 sm:pt-8 overflow-hidden">
                    {room.tint ? (
                      <div
                        aria-hidden
                        className="absolute inset-x-6 top-1/2 -translate-y-[55%] h-[70%] opacity-70 group-hover:opacity-100 transition-opacity duration-700"
                        style={{
                          backgroundImage: `radial-gradient(58% 50% at 50% 50%, ${room.tint}33 0%, ${room.tint}14 45%, transparent 72%)`,
                        }}
                      />
                    ) : null}
                    <div className="relative w-[82%] h-[80%]">
                      <Image
                        loader={unsplashLoader}
                        src={room.image}
                        alt={room.alt}
                        fill
                        sizes="(min-width: 640px) 360px, 280px"
                        className="object-contain drop-shadow-[0_26px_30px_rgba(0,0,0,0.22)] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06] group-hover:-translate-y-1"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-end p-4 sm:p-8 pt-0 sm:pt-0">
                    <div>
                      <h3 className="font-bold text-lg sm:text-2xl text-brand-dark">
                        {room.title}
                      </h3>
                      <p className="text-brand-dark/60 text-xs sm:text-sm mt-1">
                        {room.description}
                      </p>
                    </div>
                    <ArrowRight
                      size={18}
                      className="text-brand-dark group-hover:translate-x-2 transition-transform mb-1 shrink-0"
                    />
                  </div>
                </>
              )}
            </LocalizedClientLink>
          )
        })}
        </div>
      </div>
    </section>
  )
}

export default Rooms
