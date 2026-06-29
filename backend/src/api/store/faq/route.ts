import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FAQ_MODULE } from "../../../modules/faq"
import type FaqModuleService from "../../../modules/faq/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const faqService: FaqModuleService = req.scope.resolve(FAQ_MODULE)

  const categories = await faqService.listFaqCategories(
    { is_published: true },
    {
      relations: ["items"],
      order: { display_order: "ASC" },
    }
  )

  const data = categories.map((cat: any) => ({
    id: cat.id,
    slug: cat.slug,
    title: cat.title,
    description: cat.description,
    display_order: cat.display_order,
    items: (cat.items ?? [])
      .filter((item: any) => item.is_published)
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((item: any) => ({
        id: item.id,
        question: item.question,
        answer: item.answer,
        display_order: item.display_order,
      })),
  }))

  res.json({ categories: data })
}
