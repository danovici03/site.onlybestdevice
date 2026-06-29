import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { HERO_MODULE } from "../../../../modules/hero"
import type HeroModuleService from "../../../../modules/hero/service"

const UpdateSlideSchema = z.object({
  image_url: z.string().min(1).optional(),
  alt: z.string().min(1).optional(),
  title_line_1: z.string().min(1).optional(),
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

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const id = req.params.id
  const parsed = UpdateSlideSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const heroService: HeroModuleService = req.scope.resolve(HERO_MODULE)
  const [slide] = await heroService.updateHeroSlides([{ id, ...parsed.data }])
  await emitChanged(req, id)
  res.json({ slide })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const id = req.params.id
  const heroService: HeroModuleService = req.scope.resolve(HERO_MODULE)
  await heroService.deleteHeroSlides(id)
  await emitChanged(req, id)
  res.json({ id, object: "hero_slide", deleted: true })
}
