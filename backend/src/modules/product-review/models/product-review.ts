import { model } from "@medusajs/framework/utils"

const ProductReview = model
  .define("product_review", {
    id: model.id({ prefix: "prev" }).primaryKey(),
    product_id: model.text().searchable(),
    variant_id: model.text().nullable(),
    customer_id: model.text().nullable(),
    customer_name: model.text(),
    customer_email: model.text().nullable(),
    rating: model.number(),
    title: model.text().nullable(),
    body: model.text(),
    status: model.enum(["pending", "approved", "rejected"]).default("pending"),
    is_verified_purchase: model.boolean().default(false),
    admin_response: model.text().nullable(),
  })
  .indexes([
    { on: ["product_id"], where: "deleted_at IS NULL" },
    { on: ["customer_id"], where: "deleted_at IS NULL" },
    { on: ["status"], where: "deleted_at IS NULL" },
    {
      on: ["product_id", "customer_id"],
      unique: true,
      where: "deleted_at IS NULL AND customer_id IS NOT NULL",
    },
  ])

export default ProductReview
