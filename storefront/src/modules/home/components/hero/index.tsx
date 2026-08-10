import { listHeroSlides } from "@lib/data/hero"
import HeroCarousel, { type Slide } from "./hero-carousel"

// Fallback folosit doar cât timp nu există slide-uri publicate în admin, ca
// pagina principală să nu rămână niciodată goală.
const FALLBACK_SLIDES: Slide[] = [
  {
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80",
    alt: "Telefoane mobile noi — onlybestdevice",
    titleLine1: "Cele mai noi",
    titleLine2: "telefoane mobile",
    cta: "Vezi telefoanele",
    href: "/categories/telefoane-mobile",
  },
  {
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80",
    alt: "Laptopuri — onlybestdevice",
    titleLine1: "Putere",
    titleLine2: "pentru orice task",
    cta: "Vezi laptopurile",
    href: "/categories/laptop",
  },
  {
    image:
      "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80",
    alt: "TV, Audio-Video și Foto — onlybestdevice",
    titleLine1: "Sunet și imagine",
    titleLine2: "fără compromisuri",
    cta: "Vezi TV & Audio-Video",
    href: "/categories/tv-audio-video-si-foto",
  },
]

// Titlurile introduse din admin ajung uneori scrise integral cu majuscule.
// Le readucem la formatul propoziției (doar prima literă mare) — dar *numai*
// dacă textul e all-caps, ca „iPhone 15 Pro" scris corect să rămână intact.
const isAllCaps = (text: string) =>
  text === text.toUpperCase() && text !== text.toLowerCase()

const sentenceCase = (text: string): string => {
  if (!isAllCaps(text)) {
    return text
  }

  // Prima literă a liniei, nu primul caracter — titlurile pot începe cu „«" etc.
  // Fără regex unicode (`\p{L}`), pentru că tsconfig țintește es5.
  const lower = text.toLowerCase()
  for (let i = 0; i < lower.length; i++) {
    const char = lower[i]
    if (char.toUpperCase() !== char) {
      return lower.slice(0, i) + char.toUpperCase() + lower.slice(i + 1)
    }
  }
  return lower
}

// A doua linie continuă propoziția începută pe prima („Cele mai noi” /
// „telefoane mobile”), deci rămâne cu literă mică.
const continuationCase = (text: string): string =>
  isAllCaps(text) ? text.toLowerCase() : text

const Hero = async () => {
  const dbSlides = await listHeroSlides()

  const slides: Slide[] = dbSlides.length
    ? dbSlides.map((s) => ({
        image: s.image_url,
        alt: s.alt,
        titleLine1: sentenceCase(s.title_line_1),
        titleLine2: continuationCase(s.title_line_2 ?? ""),
        cta: s.cta_text ?? "",
        href: s.cta_href ?? "",
      }))
    : FALLBACK_SLIDES

  return <HeroCarousel slides={slides} />
}

export default Hero
