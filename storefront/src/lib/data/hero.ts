"use server"

import { sdk } from "@lib/config"
import { getCacheOptions } from "./cookies"

export type HeroSlideDTO = {
  id: string
  image_url: string
  alt: string
  title_line_1: string
  title_line_2: string | null
  cta_text: string | null
  cta_href: string | null
  display_order: number
}

export const listHeroSlides = async (): Promise<HeroSlideDTO[]> => {
  const next = {
    ...(await getCacheOptions("hero")),
  }

  try {
    const { slides } = await sdk.client.fetch<{
      slides: HeroSlideDTO[]
    }>(`/store/hero-slides`, {
      method: "GET",
      next: { ...next, revalidate: 3600 },
      cache: "force-cache",
    })
    return slides ?? []
  } catch (err) {
    console.error("[listHeroSlides] failed to fetch /store/hero-slides", err)
    return []
  }
}
