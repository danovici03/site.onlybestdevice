import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { FAQ_MODULE } from "../../../../../modules/faq"
import type FaqModuleService from "../../../../../modules/faq/service"

const UpdateItemSchema = z.object({
  category_id: z.string().min(1).optional(),
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  display_order: z.number().int().nonnegative().optional(),
  is_published: z.boolean().optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const id = req.params.id
  const faqService: FaqModuleService = req.scope.resolve(FAQ_MODULE)
  const item = await faqService.retrieveFaqItem(id)
  res.json({ item })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const id = req.params.id
  const parsed = UpdateItemSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const faqService: FaqModuleService = req.scope.resolve(FAQ_MODULE)
  const { category_id, ...rest } = parsed.data
  const updatePayload: Record<string, unknown> = { id, ...rest }
  if (category_id) updatePayload.category = category_id

  const [item] = await faqService.updateFaqItems([updatePayload as any])
  res.json({ item })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const id = req.params.id
  const faqService: FaqModuleService = req.scope.resolve(FAQ_MODULE)
  await faqService.deleteFaqItems(id)
  res.json({ id, object: "faq_item", deleted: true })
}
