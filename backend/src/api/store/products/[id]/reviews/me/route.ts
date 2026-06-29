import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { PRODUCT_REVIEW_MODULE } from "../../../../../../modules/product-review"
import type ProductReviewModuleService from "../../../../../../modules/product-review/service"

// Returns the current customer's own review for this product (any status),
// so the storefront can show "your review is pending" / "you already reviewed"
// instead of the submission form.
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.json({ review: null })
  }

  const service: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE,
  )
  const [review] = await service.listProductReviews(
    { product_id: req.params.id, customer_id: customerId },
    { take: 1 },
  )

  if (!review) {
    return res.json({ review: null })
  }

  res.json({
    review: {
      id: (review as any).id,
      rating: (review as any).rating,
      title: (review as any).title,
      body: (review as any).body,
      status: (review as any).status,
      is_verified_purchase: (review as any).is_verified_purchase,
      created_at: (review as any).created_at,
    },
  })
}
