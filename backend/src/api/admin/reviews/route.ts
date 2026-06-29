import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRODUCT_REVIEW_MODULE } from "../../../modules/product-review"
import type ProductReviewModuleService from "../../../modules/product-review/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE,
  )
  const q = req.query as Record<string, string | undefined>

  const filters: Record<string, unknown> = {}
  if (q.status && ["pending", "approved", "rejected"].includes(q.status)) {
    filters.status = q.status
  }
  if (q.product_id) filters.product_id = q.product_id

  const take = Math.min(Number(q.limit ?? 50) || 50, 200)
  const skip = Math.max(Number(q.offset ?? 0) || 0, 0)

  const [reviews, count] = await service.listAndCountProductReviews(filters, {
    take,
    skip,
    order: { created_at: "DESC" },
  })

  // Decorate with product title for the moderation queue
  const productIds = Array.from(
    new Set(reviews.map((r: any) => r.product_id).filter(Boolean)),
  )
  let productsById: Record<string, { id: string; title: string; handle?: string; thumbnail?: string | null }> = {}
  if (productIds.length > 0) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "title", "handle", "thumbnail"],
      filters: { id: productIds as string[] },
    })
    for (const p of products ?? []) {
      productsById[(p as any).id] = p as any
    }
  }

  res.json({
    reviews: reviews.map((r: any) => ({
      ...r,
      product: productsById[r.product_id] ?? null,
    })),
    count,
  })
}
