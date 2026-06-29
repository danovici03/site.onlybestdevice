import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { HERO_MODULE } from "../../../modules/hero"
import type HeroModuleService from "../../../modules/hero/service"

const CreateSlideSchema = z.object({
  image_url: z.string().min(1, "Imaginea este obligatorie"),
  alt: z.string().min(1, "Textul alternativ este obligatoriu"),
  title_line_1: z.string().min(1, "Primul rând al titlului este obligatoriu"),
  title_line_2: z.string().nullable().optional(),
  cta_text: z.string().nullable().optional(),
  cta_href: z.string().nullable().optional(),
  display_order: z.number().int().nonnegative().optional(),
  is_published: z.boolean().optional(),
})

async function emitChanged(req: MedusaRequest, id: string) {
  try {
    const eventBus: any = req.scope.resolve(Modules.EVENT_BUS)
    await eventBus.emit({ name: "hero-slide.changed", data: { id } })
  } catch {
    // Event bus optional in dev — revalidation falls back to time-based.
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const heroService: HeroModuleService = req.scope.resolve(HERO_MODULE)
  const [slides, count] = await heroService.listAndCountHeroSlides(
    {},
    { order: { display_order: "ASC" } }
  )
  res.json({ slides, count })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = CreateSlideSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const heroService: HeroModuleService = req.scope.resolve(HERO_MODULE)
  const slide = await heroService.createHeroSlides(parsed.data)
  await emitChanged(req, slide.id)
  res.status(201).json({ slide })
}
