import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { HERO_MODULE } from "../../../modules/hero"
import type HeroModuleService from "../../../modules/hero/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const heroService: HeroModuleService = req.scope.resolve(HERO_MODULE)

  const slides = await heroService.listHeroSlides(
    { is_published: true },
    { order: { display_order: "ASC" } }
  )

  const data = slides.map((slide: any) => ({
    id: slide.id,
    image_url: slide.image_url,
    alt: slide.alt,
    title_line_1: slide.title_line_1,
    title_line_2: slide.title_line_2,
    cta_text: slide.cta_text,
    cta_href: slide.cta_href,
    display_order: slide.display_order,
  }))

  res.json({ slides: data })
}
