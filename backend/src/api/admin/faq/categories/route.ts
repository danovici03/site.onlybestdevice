import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { FAQ_MODULE } from "../../../../modules/faq"
import type FaqModuleService from "../../../../modules/faq/service"

const CreateCategorySchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug deve contenere solo lettere minuscole, numeri e trattini"),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  display_order: z.number().int().nonnegative().optional(),
  is_published: z.boolean().optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const faqService: FaqModuleService = req.scope.resolve(FAQ_MODULE)
  const [categories, count] = await faqService.listAndCountFaqCategories(
    {},
    {
      relations: ["items"],
      order: { display_order: "ASC" },
    }
  )
  res.json({ categories, count })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = CreateCategorySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const faqService: FaqModuleService = req.scope.resolve(FAQ_MODULE)
  const category = await faqService.createFaqCategories(parsed.data)
  res.status(201).json({ category })
}
