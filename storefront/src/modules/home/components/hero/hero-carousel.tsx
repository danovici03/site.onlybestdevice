"use client"

import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr"
import Autoplay from "embla-carousel-autoplay"
import useEmblaCarousel from "embla-carousel-react"
import Image from "@modules/common/components/image"
import { useCallback, useEffect, useRef, useState } from "react"

import { unsplashLoader } from "@lib/util/unsplash-loader"
import {
  useDotButton,
  usePrevNextButtons,
} from "@modules/common/components/carousel/embla-carousel-hooks"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export type Slide = {
  image: string
  /** Video opțional (mp4/webm). `image` rămâne poster și fallback. */
  video?: string
  /** Varianta verticală, pentru ecranele ținute în picioare. */
  videoMobile?: string
  alt: string
  titleLine1: string
  titleLine2: string
  cta: string
  href: string
}

const AUTOPLAY_MS = 6000

// Cât ține intro-ul (voal 1.9s + titlu care intră la 1.15s și durează 1s).
// După el scoatem clasele de animație, ca `forwards`/`both` să nu blocheze
// opacitatea titlului pe primul slide când caruselul trece mai departe.
const INTRO_MS = 2300

// Cât rămâne ultimul cadru înghețat pe ecran după ce clipul s-a terminat.
// Fără pauza asta slide-ul ar fugi exact în clipa în care imaginea se oprește.
const VIDEO_HOLD_MS = 1200

// Trecerea de la imagine la video (și înapoi). Ținută mai lungă decât
// animația de glisare a caruselului, ca schimbul de cadru să nu se simtă.
const VIDEO_FADE_MS = 700

// Plasă de siguranță: dacă `ended` nu mai vine (fișier stricat, decodare
// blocată, autoplay refuzat târziu), nu lăsăm caruselul înțepenit pe slide.
const VIDEO_STUCK_MARGIN_MS = 4000
const VIDEO_STUCK_FALLBACK_MS = 20000

// Imaginile placeholder vin de pe Unsplash (au nevoie de loader-ul cu query
// params). Cele administrate din admin vin din storage-ul propriu (S3/local)
// și folosesc optimizatorul implicit Next.
const isUnsplash = (src: string) => src.includes("images.unsplash.com")

/**
 * Videoul unui slide, peste imaginea lui.
 *
 * Rulează o singură dată (fără `loop`) și rămâne înghețat pe ultimul cadru —
 * de acolo preia părintele și trece la slide-ul următor. Derularea la început
 * o facem la *activare*, nu la dezactivare: altfel, cât timp slide-ul iese din
 * cadru, s-ar vedea cum sare înapoi la primul cadru.
 *
 * Pe slide-urile inactive stă pe pauză, ca telefoanele să nu decodeze trei
 * clipuri în paralel.
 *
 * Cât timp nu redă efectiv, videoul e transparent și se vede imaginea de
 * dedesubt. Altfel se vedea cum poza slide-ului e înlocuită brusc de primul
 * cadru al clipului — două imagini diferite, schimbate dintr-o bucată. Apariția
 * o legăm de `playing` (primul cadru chiar desenat), nu de `play` (doar
 * intenția de redare, de dinainte să vină datele).
 */
const SlideVideo = ({
  slide,
  src,
  isActive,
  isFirst,
  onEnded,
  onFailed,
}: {
  slide: Slide
  src: string
  isActive: boolean
  isFirst: boolean
  /** Clipul s-a terminat — ultimul cadru rămâne pe ecran. */
  onEnded: () => void
  /** Nu poate fi redat (autoplay refuzat, fișier stricat, blocat la mijloc). */
  onFailed: () => void
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stuckRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // `true` abia din clipa în care clipul chiar desenează cadre.
  const [showing, setShowing] = useState(false)

  // Handlerele se schimbă la fiecare randare a părintelui; ținute în ref ca
  // efectul de mai jos să nu repornească videoul din cauza asta.
  const handlers = useRef({ onEnded, onFailed })
  handlers.current = { onEnded, onFailed }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // `play()` se poate rezolva după ce slide-ul a plecat deja — fără steagul
    // ăsta am arma un cronometru pe care curățarea nu-l mai prinde.
    let cancelled = false

    const clearStuck = () => {
      if (stuckRef.current) {
        clearTimeout(stuckRef.current)
        stuckRef.current = null
      }
    }

    // Cronometrul de avarie se armează pe cât a mai rămas din clip — durata o
    // știm abia după ce vin metadatele, până atunci mergem pe o valoare
    // generoasă. Se rearmează la fiecare repornire a redării, fiindcă orice
    // pauză (de exemplu tabul trecut în fundal, unde browserul oprește singur
    // videoul) ar face un termen absolut să expire degeaba.
    const armStuck = () => {
      clearStuck()
      if (cancelled) return
      const left =
        Number.isFinite(video.duration) && video.duration > 0
          ? (video.duration - video.currentTime) * 1000
          : VIDEO_STUCK_FALLBACK_MS
      stuckRef.current = setTimeout(
        () => handlers.current.onFailed(),
        left + VIDEO_STUCK_MARGIN_MS
      )
    }

    if (!isActive) {
      video.pause()
      clearStuck()
      // Ne stingem cât slide-ul iese din cadru, ca la următoarea intrare să
      // fim deja pe imagine — altfel s-ar vedea întâi ultimul cadru al
      // clipului trecut, apoi saltul înapoi la primul.
      setShowing(false)
      return
    }

    video.currentTime = 0
    armStuck()
    // `play()` întoarce o promisiune care e respinsă dacă browserul refuză
    // autoplay-ul (sau dacă slide-ul se schimbă între timp) — atunci rămâne
    // vizibilă imaginea slide-ului.
    video.play().catch(() => {
      if (!cancelled) handlers.current.onFailed()
    })

    const onPlayingEvent = () => {
      setShowing(true)
      armStuck()
    }
    const onEndedEvent = () => {
      clearStuck()
      handlers.current.onEnded()
    }
    const onErrorEvent = () => {
      clearStuck()
      handlers.current.onFailed()
    }

    video.addEventListener("playing", onPlayingEvent)
    video.addEventListener("pause", clearStuck)
    video.addEventListener("ended", onEndedEvent)
    video.addEventListener("error", onErrorEvent)

    return () => {
      cancelled = true
      clearStuck()
      video.removeEventListener("playing", onPlayingEvent)
      video.removeEventListener("pause", clearStuck)
      video.removeEventListener("ended", onEndedEvent)
      video.removeEventListener("error", onErrorEvent)
    }
    // `src` e în dependențe fiindcă rotirea telefonului schimbă fișierul: fără
    // el, varianta nou montată ar rămâne pe pauză până la următorul slide.
  }, [isActive, src])

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      playsInline
      // Fără `poster`: sub video stă deja aceeași imagine, trecută prin
      // optimizatorul Next. Atributul ar mai descărca o dată originalul, la
      // dimensiune întreagă, pentru un cadru care oricum nu se vede.
      //
      // Redarea o pornește efectul de mai sus, nu atributul `autoplay`: pe
      // primul slide clipul trebuie să înceapă *după* voalul de intro, altfel
      // s-ar consuma două secunde din el în spatele unui ecran negru.
      preload={isFirst ? "auto" : "metadata"}
      aria-label={slide.alt}
      style={{ transitionDuration: `${VIDEO_FADE_MS}ms` }}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity ${
        showing ? "opacity-100" : "opacity-0"
      }`}
    />
  )
}

/**
 * Fișierul potrivit orientării ecranului, cu retragere pe cel orizontal când
 * slide-ul n-are variantă verticală.
 *
 * Atenție: alegerea se face aici, în JS, nu cu `<source media="…">` — atributul
 * `media` merge doar în `<picture>`, iar browserele îl ignoră tăcut pe
 * `<source>`-urile dintr-un `<video>`, deci ar fi redat mereu prima sursă.
 */
const videoSrc = (slide: Slide, portrait: boolean): string | undefined =>
  (portrait && slide.videoMobile) || slide.video

const HeroCarousel = ({ slides }: { slides: Slide[] }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center" },
    [Autoplay({ delay: AUTOPLAY_MS, stopOnInteraction: false })]
  )
  const { selectedIndex } = useDotButton(emblaApi)
  const { onPrevButtonClick, onNextButtonClick } = usePrevNextButtons(emblaApi)
  const [intro, setIntro] = useState(true)
  // Cu „reduced motion" pornit nu redăm videoul deloc: slide-ul rămâne pe
  // imagine, care oricum e poster-ul lui. Pornim de la `true` ca randarea de
  // pe server (unde nu știm preferința) să nu insereze un `<video>` pe care
  // hidratarea l-ar scoate imediat.
  const [reducedMotion, setReducedMotion] = useState(true)
  // Alegem varianta verticală după *orientarea* ecranului, nu după lățime: un
  // desktop e mereu lat, iar o tabletă ținută în picioare are exact problema de
  // decupare pe care varianta verticală o rezolvă.
  const [portrait, setPortrait] = useState(false)

  // Trecerea amânată după terminarea unui clip.
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearAdvance = () => {
    if (advanceRef.current) {
      clearTimeout(advanceRef.current)
      advanceRef.current = null
    }
  }

  const slideHasVideo = useCallback(
    (index: number) => {
      const slide = slides[index]
      return !!slide && !reducedMotion && !!videoSrc(slide, portrait)
    },
    [slides, reducedMotion, portrait]
  )

  /**
   * Pe slide-urile cu video nu cronometrul fix de 6s hotărăște trecerea, ci
   * sfârșitul clipului — altfel un clip mai lung s-ar tăia la jumătate, iar
   * unul scurt ar sta degeaba pe ultimul cadru. Deci oprim autoplay-ul cât
   * rulează videoul și îl repornim pe slide-urile cu imagine.
   */
  useEffect(() => {
    // Cu un singur slide pluginul iese devreme din `init` și rămâne fără
    // tabelul de delay-uri: un `play()` pe el ar arunca.
    if (slides.length < 2) return
    const autoplay = emblaApi?.plugins()?.autoplay
    if (!autoplay) return

    const apply = () => {
      if (slideHasVideo(emblaApi.selectedScrollSnap())) autoplay.stop()
      else autoplay.play()
    }

    apply()
    // După o glisare pluginul își repornește singur cronometrul, chiar dacă am
    // rămas pe același slide cu video — de aceea reaplicăm și acolo.
    emblaApi.on("pointerUp", apply)
    return () => {
      emblaApi.off("pointerUp", apply)
    }
  }, [emblaApi, selectedIndex, slides, slideHasVideo])

  // Orice schimbare de slide (manuală sau automată) anulează avansul programat
  // de clipul precedent.
  useEffect(() => clearAdvance, [selectedIndex])

  /** Clipul s-a terminat: ultimul cadru mai stă o clipă, apoi mergem mai departe. */
  const handleVideoEnded = (index: number) => {
    // `ended` poate veni pentru un slide de pe care clientul a plecat deja.
    if (!emblaApi || emblaApi.selectedScrollSnap() !== index) return
    clearAdvance()
    advanceRef.current = setTimeout(() => emblaApi.scrollNext(), VIDEO_HOLD_MS)
  }

  /** Videoul nu poate fi redat: slide-ul rămâne pe imagine, cu ritmul normal. */
  const handleVideoFailed = (index: number) => {
    if (!emblaApi || emblaApi.selectedScrollSnap() !== index) return
    if (slides.length < 2) return
    emblaApi.plugins()?.autoplay?.play()
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIntro(false)
      return
    }

    setReducedMotion(false)

    const portraitQuery = window.matchMedia("(orientation: portrait)")
    setPortrait(portraitQuery.matches)
    const onOrientationChange = (e: MediaQueryListEvent) =>
      setPortrait(e.matches)
    portraitQuery.addEventListener("change", onOrientationChange)

    const timeout = setTimeout(() => {
      setIntro(false)
      // Repornim cronometrul de autoplay ca primul slide să fie vizibil 6s
      // *după* intro, nu 6s din care 2 au fost negre. Pe un slide cu video
      // autoplay-ul e deja oprit, iar `reset()` nu repornește ce e oprit.
    }, INTRO_MS)

    return () => {
      clearTimeout(timeout)
      portraitQuery.removeEventListener("change", onOrientationChange)
    }
  }, [emblaApi])

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
                {/* Imaginea rămâne mereu randată: e LCP-ul paginii și fundalul
                    de sub video cât timp acesta se încarcă (sau dacă browserul
                    refuză autoplay-ul). */}
                <Image
                  loader={isUnsplash(slide.image) ? unsplashLoader : undefined}
                  src={slide.image}
                  alt={slide.alt}
                  fill
                  sizes="100vw"
                  priority={index === 0}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  draggable={false}
                  className={`object-cover ${
                    intro && index === 0
                      ? "animate-hero-intro-zoom motion-reduce:animate-none"
                      : ""
                  }`}
                />
                {videoSrc(slide, portrait) && !reducedMotion && (
                  <SlideVideo
                    slide={slide}
                    src={videoSrc(slide, portrait)!}
                    // Cât ține intro-ul, videoul stă: ar rula în spatele
                    // voalului negru.
                    isActive={index === selectedIndex && !intro}
                    isFirst={index === 0}
                    onEnded={() => handleVideoEnded(index)}
                    onFailed={() => handleVideoFailed(index)}
                  />
                )}
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
                  } ${
                    intro && index === 0
                      ? "animate-hero-intro-title motion-reduce:animate-none"
                      : ""
                  }`}
                  aria-hidden={index !== selectedIndex}
                >
                  {/* Sub lg e vizibilă BottomNav-ul fix (~4.5rem + safe area),
                      deci titlul/CTA au nevoie de spațiu suplimentar dedesubt. */}
                  <div className="w-full max-w-[1920px] mx-auto px-6 sm:px-12 lg:px-20 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-28">
                    {/* Titlul se scrie ca o propoziție (doar prima literă mare)
                        — fără `uppercase`, ca blocul de text să respire. */}
                    <h2 className="font-sans font-black text-4xl sm:text-6xl lg:text-7xl text-white leading-[1.05] tracking-tight mb-6 sm:mb-8 max-w-4xl">
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

      {/* Voalul de intro — acoperă tot hero-ul (imagine, gradiente, săgeți) și
          se stinge peste ~2s, ca imaginea să pară că „se aprinde". z-40 ca să
          fie peste săgeți/dots (z-30); pointer-events-none ca să nu blocheze
          clickurile în timp ce se stinge. */}
      {intro && (
        <div
          aria-hidden
          className="absolute inset-0 z-40 bg-black pointer-events-none animate-hero-intro-veil motion-reduce:hidden"
        />
      )}

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
