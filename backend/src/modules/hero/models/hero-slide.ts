import { model } from "@medusajs/framework/utils"

const HeroSlide = model
  .define("hero_slide", {
    id: model.id({ prefix: "hero" }).primaryKey(),
    image_url: model.text(),
    // Video opțional (mp4/webm). Când e setat, storefront-ul redă filmulețul
    // peste `image_url`, care rămâne poster/fallback (reduced-motion, erori de
    // rețea, primul cadru până se încarcă). Deci imaginea rămâne obligatorie.
    video_url: model.text().nullable(),
    // Varianta verticală, redată când ecranul e în picioare (telefon sau
    // tabletă în portret). Fără ea, un banner ultra-wide se vede pe mobil
    // doar cu fâșia din mijloc, mărită de câteva ori de `object-cover`.
    video_url_mobile: model.text().nullable(),
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
