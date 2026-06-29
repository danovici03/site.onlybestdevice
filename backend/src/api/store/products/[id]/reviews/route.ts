import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { z } from "zod"
import { PRODUCT_REVIEW_MODULE } from "../../../../../modules/product-review"
import type ProductReviewModuleService from "../../../../../modules/product-review/service"

const CreateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional().nullable(),
  body: z.string().min(10).max(4000),
  variant_id: z.string().optional().nullable(),
})

const SORT_VALUES = ["recent", "highest", "lowest", "helpful"] as const
type SortValue = (typeof SORT_VALUES)[number]

// Public listing — only approved reviews + aggregate stats. No auth required.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productId = req.params.id
  const limit = Math.min(Number(req.query.limit ?? 10) || 10, 50)
  const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0)
  const sortRaw = (req.query.sort as string | undefined) ?? "recent"
  const sort: SortValue = (SORT_VALUES as readonly string[]).includes(sortRaw)
    ? (sortRaw as SortValue)
    : "recent"

  const service: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE,
  )

  const order: Record<string, "ASC" | "DESC"> =
    sort === "highest"
      ? { rating: "DESC", created_at: "DESC" }
      : sort === "lowest"
        ? { rating: "ASC", created_at: "DESC" }
        : { created_at: "DESC" }

  const [reviews, count] = await service.listAndCountProductReviews(
    { product_id: productId, status: "approved" },
    { take: limit, skip: offset, order },
  )

  // Aggregate stats across ALL approved reviews (not just current page)
  const allApproved = await service.listProductReviews(
    { product_id: productId, status: "approved" },
    { select: ["rating"], take: 10000 },
  )

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  }
  let total = 0
  for (const r of allApproved) {
    const rating = Number((r as any).rating)
    if (rating >= 1 && rating <= 5) {
      distribution[rating as 1 | 2 | 3 | 4 | 5]++
      total += rating
    }
  }
  const totalCount = allApproved.length
  const average = totalCount > 0 ? total / totalCount : 0

  res.json({
    reviews: reviews.map((r: any) => ({
      id: r.id,
      product_id: r.product_id,
      variant_id: r.variant_id,
      customer_name: r.customer_name,
      rating: r.rating,
      title: r.title,
      body: r.body,
      is_verified_purchase: r.is_verified_purchase,
      admin_response: r.admin_response,
      created_at: r.created_at,
    })),
    count,
    limit,
    offset,
    stats: {
      average,
      total: totalCount,
      distribution,
    },
  })
}

// Authenticated submission. Requires customer Bearer token.
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Devi effettuare l'accesso per pubblicare una recensione",
    )
  }

  const productId = req.params.id
  const parsed = CreateReviewSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const service: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE,
  )
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Verify product exists
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title"],
    filters: { id: productId },
  })
  const product = products?.[0]
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Prodotto non trovato")
  }

  // Block duplicate review by same customer
  const existing = await service.listProductReviews(
    { product_id: productId, customer_id: customerId },
    { take: 1 },
  )
  if (existing.length > 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Hai già lasciato una recensione per questo prodotto",
    )
  }

  // Load customer for display name / email
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "first_name", "last_name", "email"],
    filters: { id: customerId },
  })
  const customer = customers?.[0]
  if (!customer) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Cliente non trovato")
  }

  // Detect verified purchase: customer has an order containing this product
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "items.product_id"],
    filters: { customer_id: customerId },
    pagination: { take: 200 },
  })
  const isVerifiedPurchase = (orders ?? []).some((o: any) =>
    (o.items ?? []).some((it: any) => it.product_id === productId),
  )

  // Use first name + last-name initial for privacy ("Matteo R.")
  const firstName = (customer as any).first_name?.trim() || ""
  const lastName = (customer as any).last_name?.trim() || ""
  const displayName =
    firstName && lastName
      ? `${firstName} ${lastName[0]}.`
      : firstName || (customer as any).email?.split("@")[0] || "Cliente"

  const created = await service.createProductReviews({
    product_id: productId,
    variant_id: parsed.data.variant_id ?? null,
    customer_id: customerId,
    customer_name: displayName,
    customer_email: (customer as any).email ?? null,
    rating: parsed.data.rating,
    title: parsed.data.title ?? null,
    body: parsed.data.body,
    is_verified_purchase: isVerifiedPurchase,
    // Verified purchases skip moderation queue
    status: isVerifiedPurchase ? "approved" : "pending",
  } as any)

  try {
    const eventBus = req.scope.resolve(Modules.EVENT_BUS)
    await eventBus.emit({
      name: "product-review.created",
      data: {
        id: (created as any).id,
        product_id: productId,
        is_verified_purchase: isVerifiedPurchase,
        auto_approved: isVerifiedPurchase,
      },
    })
    // Verified purchase reviews go live immediately; emit `published` so
    // the storefront cache invalidates the product's reviews tag.
    if (isVerifiedPurchase) {
      await eventBus.emit({
        name: "product-review.published",
        data: { id: (created as any).id, product_id: productId },
      })
    }
  } catch {
    // Event bus is best-effort — admin still sees the review in moderation UI
  }

  res.status(201).json({
    review: {
      id: (created as any).id,
      status: (created as any).status,
      is_verified_purchase: (created as any).is_verified_purchase,
    },
  })
}
