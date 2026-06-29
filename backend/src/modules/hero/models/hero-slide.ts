import { model } from "@medusajs/framework/utils"

const HeroSlide = model
  .define("hero_slide", {
    id: model.id({ prefix: "hero" }).primaryKey(),
    image_url: model.text(),
    alt: model.text(),
    title_line_1: model.text(),
    title_line_2: model.text().nullable(),
    cta_text: model.text().nullable(),
    cta_href: model.text().nullable(),
    display_order: model.number().default(0),
    is_published: model.boolean().default(true),
  })
  .indexes([
    {
      on: ["display_order"],
      where: "deleted_at IS NULL",
    },
  ])

export default HeroSlide
