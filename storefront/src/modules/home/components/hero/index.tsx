import { listHeroSlides } from "@lib/data/hero"
import HeroCarousel, { type Slide } from "./hero-carousel"

// Fallback folosit doar cât timp nu există slide-uri publicate în admin, ca
// pagina principală să nu rămână niciodată goală.
const FALLBACK_SLIDES: Slide[] = [
  {
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80",
    alt: "Telefoane mobile noi — onlybestdevice",
    titleLine1: "CELE MAI NOI",
    titleLine2: "TELEFOANE MOBILE",
    cta: "Vezi telefoanele",
    href: "/categories/telefoane-mobile",
  },
  {
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80",
    alt: "Laptopuri — onlybestdevice",
    titleLine1: "PUTERE",
    titleLine2: "PENTRU ORICE TASK",
    cta: "Vezi laptopurile",
    href: "/categories/laptop",
  },
  {
    image:
      "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80",
    alt: "TV, Audio-Video și Foto — onlybestdevice",
    titleLine1: "SUNET ȘI IMAGINE",
    titleLine2: "FĂRĂ COMPROMISURI",
    cta: "Vezi TV & Audio-Video",
    href: "/categories/tv-audio-video-si-foto",
  },
]

const Hero = async () => {
  const dbSlides = await listHeroSlides()

  const slides: Slide[] = dbSlides.length
    ? dbSlides.map((s) => ({
        image: s.image_url,
        alt: s.alt,
        titleLine1: s.title_line_1,
        titleLine2: s.title_line_2 ?? "",
        cta: s.cta_text ?? "",
        href: s.cta_href ?? "",
      }))
    : FALLBACK_SLIDES

  return <HeroCarousel slides={slides} />
}

export default Hero
