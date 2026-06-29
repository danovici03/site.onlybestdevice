import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { FAQ_MODULE } from "../../../../../modules/faq"
import type FaqModuleService from "../../../../../modules/faq/service"

const UpdateCategorySchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  display_order: z.number().int().nonnegative().optional(),
  is_published: z.boolean().optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const id = req.params.id
  const faqService: FaqModuleService = req.scope.resolve(FAQ_MODULE)
  const category = await faqService.retrieveFaqCategory(id, {
    relations: ["items"],
  })
  res.json({ category })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const id = req.params.id
  const parsed = UpdateCategorySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const faqService: FaqModuleService = req.scope.resolve(FAQ_MODULE)
  const [category] = await faqService.updateFaqCategories([
    { id, ...parsed.data },
  ])
  res.json({ category })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const id = req.params.id
  const faqService: FaqModuleService = req.scope.resolve(FAQ_MODULE)
  await faqService.deleteFaqCategories(id)
  res.json({ id, object: "faq_category", deleted: true })
}
