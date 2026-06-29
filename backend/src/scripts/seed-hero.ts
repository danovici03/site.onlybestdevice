import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { HERO_MODULE } from "../modules/hero"
import type HeroModuleService from "../modules/hero/service"

type SeedSlide = {
  image_url: string
  alt: string
  title_line_1: string
  title_line_2: string | null
  cta_text: string | null
  cta_href: string | null
}

// Slide-urile inițiale (aceleași folosite ca fallback în storefront). După seed,
// poți înlocui imaginile cu bannere reale onlybestdevice direct din
// admin → Hero → „Schimbă imaginea".
const SEED: SeedSlide[] = [
  {
    image_url:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80",
    alt: "Telefoane mobile noi — onlybestdevice",
    title_line_1: "CELE MAI NOI",
    title_line_2: "TELEFOANE MOBILE",
    cta_text: "Vezi telefoanele",
    cta_href: "/categories/telefoane-mobile",
  },
  {
    image_url:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80",
    alt: "Laptopuri — onlybestdevice",
    title_line_1: "PUTERE",
    title_line_2: "PENTRU ORICE TASK",
    cta_text: "Vezi laptopurile",
    cta_href: "/categories/laptop",
  },
  {
    image_url:
      "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80",
    alt: "TV, Audio-Video și Foto — onlybestdevice",
    title_line_1: "SUNET ȘI IMAGINE",
    title_line_2: "FĂRĂ COMPROMISURI",
    cta_text: "Vezi TV & Audio-Video",
    cta_href: "/categories/tv-audio-video-si-foto",
  },
]

export default async function seedHero({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const heroService = container.resolve(HERO_MODULE) as HeroModuleService

  const existing = await heroService.listHeroSlides({})
  if (existing.length > 0) {
    logger.info(
      `[seed-hero] Există deja ${existing.length} slide-uri — sar peste seed ca să nu dublez. ` +
        `Pentru a re-seed, șterge-le din admin → Hero și rulează din nou.`
    )
    return
  }

  const toCreate = SEED.map((slide, index) => ({
    ...slide,
    display_order: index,
    is_published: true,
  }))

  await heroService.createHeroSlides(toCreate)

  logger.info(`[seed-hero] Am creat ${toCreate.length} slide-uri hero.`)
}
