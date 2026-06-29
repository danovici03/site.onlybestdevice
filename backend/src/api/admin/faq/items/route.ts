import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { FAQ_MODULE } from "../../../../modules/faq"
import type FaqModuleService from "../../../../modules/faq/service"

const CreateItemSchema = z.object({
  category_id: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  display_order: z.number().int().nonnegative().optional(),
  is_published: z.boolean().optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const faqService: FaqModuleService = req.scope.resolve(FAQ_MODULE)
  const categoryId = (req.query as any).category_id as string | undefined

  const filters: Record<string, unknown> = {}
  if (categoryId) filters.category_id = categoryId

  const [items, count] = await faqService.listAndCountFaqItems(filters, {
    order: { display_order: "ASC" },
  })
  res.json({ items, count })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = CreateItemSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const faqService: FaqModuleService = req.scope.resolve(FAQ_MODULE)
  const { category_id, ...rest } = parsed.data
  const item = await faqService.createFaqItems({
    ...rest,
    category: category_id,
  } as any)
  res.status(201).json({ item })
}
