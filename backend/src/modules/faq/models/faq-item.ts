import { model } from "@medusajs/framework/utils"
import FaqCategory from "./faq-category"

const FaqItem = model.define("faq_item", {
  id: model.id({ prefix: "faqitm" }).primaryKey(),
  question: model.text().searchable(),
  answer: model.text(),
  display_order: model.number().default(0),
  is_published: model.boolean().default(true),
  category: model.belongsTo(() => FaqCategory, { mappedBy: "items" }),
})

export default FaqItem
