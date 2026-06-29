import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { PRODUCT_REVIEW_MODULE } from "../../../../modules/product-review"
import type ProductReviewModuleService from "../../../../modules/product-review/service"

const UpdateReviewSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  admin_response: z.string().max(2000).nullable().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(120).nullable().optional(),
  body: z.string().min(1).max(4000).optional(),
  is_verified_purchase: z.boolean().optional(),
})

const emitPublishChange = async (
  req: MedusaRequest,
  payload: {
    id: string
    product_id: string
    was_public: boolean
    is_public: boolean
  },
) => {
  if (payload.was_public === payload.is_public) return
  try {
    const eventBus = req.scope.resolve(Modules.EVENT_BUS)
    await eventBus.emit({
      name: payload.is_public
        ? "product-review.published"
        : "product-review.unpublished",
      data: { id: payload.id, product_id: payload.product_id },
    })
  } catch {
    // Best-effort — DB state is the source of truth
  }
}

const emitPublicEdit = async (
  req: MedusaRequest,
  payload: { id: string; product_id: string },
) => {
  try {
    const eventBus = req.scope.resolve(Modules.EVENT_BUS)
    await eventBus.emit({
      name: "product-review.published",
      data: payload,
    })
  } catch {}
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE,
  )
  const review = await service.retrieveProductReview(req.params.id)
  res.json({ review })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = UpdateReviewSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const service: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE,
  )

  // Capture pre-update state so we can detect status transitions and
  // emit the right event for cache invalidation.
  const before = (await service.retrieveProductReview(req.params.id)) as any

  const [review] = await service.updateProductReviews([
    { id: req.params.id, ...parsed.data },
  ])

  const wasPublic = before?.status === "approved"
  const isPublic = (review as any).status === "approved"

  if (wasPublic !== isPublic) {
    await emitPublishChange(req, {
      id: (review as any).id,
      product_id: (review as any).product_id,
      was_public: wasPublic,
      is_public: isPublic,
    })
  } else if (
    isPublic &&
    (parsed.data.rating !== undefined ||
      parsed.data.title !== undefined ||
      parsed.data.body !== undefined ||
      parsed.data.admin_response !== undefined)
  ) {
    // Content edit on a publicly visible review → revalidate storefront
    await emitPublicEdit(req, {
      id: (review as any).id,
      product_id: (review as any).product_id,
    })
  }

  res.json({ review })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const service: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE,
  )

  const before = (await service
    .retrieveProductReview(req.params.id)
    .catch(() => null)) as any

  await service.deleteProductReviews(req.params.id)

  if (before?.status === "approved") {
    await emitPublishChange(req, {
      id: before.id,
      product_id: before.product_id,
      was_public: true,
      is_public: false,
    })
  }

  res.json({ id: req.params.id, object: "product_review", deleted: true })
}
