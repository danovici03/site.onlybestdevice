import { model } from "@medusajs/framework/utils"
import FaqItem from "./faq-item"

const FaqCategory = model
  .define("faq_category", {
    id: model.id({ prefix: "faqcat" }).primaryKey(),
    slug: model.text().searchable(),
    title: model.text().searchable(),
    description: model.text().nullable(),
    display_order: model.number().default(0),
    is_published: model.boolean().default(true),
    items: model.hasMany(() => FaqItem, { mappedBy: "category" }),
  })
  .cascades({
    delete: ["items"],
  })
  .indexes([
    {
      on: ["slug"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default FaqCategory
