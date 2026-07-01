"use server"

import { sdk } from "@lib/config"
import { revalidateTag } from "next/cache"
import { getAuthHeaders, getCacheOptions, getCacheTag } from "./cookies"

export type ReviewDTO = {
  id: string
  product_id: string
  variant_id: string | null
  customer_name: string
  rating: number
  title: string | null
  body: string
  is_verified_purchase: boolean
  admin_response: string | null
  created_at: string
}

export type OwnReviewDTO = {
  id: string
  rating: number
  title: string | null
  body: string
  status: "pending" | "approved" | "rejected"
  is_verified_purchase: boolean
  created_at: string
}

export type ReviewStatsDTO = {
  average: number
  total: number
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>
}

export type ReviewListDTO = {
  reviews: ReviewDTO[]
  count: number
  limit: number
  offset: number
  stats: ReviewStatsDTO
}

export type ReviewSort = "recent" | "highest" | "lowest"

export const listProductReviews = async (
  productId: string,
  opts: { limit?: number; offset?: number; sort?: ReviewSort } = {},
): Promise<ReviewListDTO> => {
  const next = { ...(await getCacheOptions(`reviews-${productId}`)) }

  const params = new URLSearchParams()
  if (opts.limit) params.set("limit", String(opts.limit))
  if (opts.offset) params.set("offset", String(opts.offset))
  if (opts.sort) params.set("sort", opts.sort)

  try {
    const data = await sdk.client.fetch<ReviewListDTO>(
      `/store/products/${productId}/reviews?${params.toString()}`,
      {
        method: "GET",
        next: { ...next, revalidate: 300 },
      },
    )
    return data
  } catch {
    return {
      reviews: [],
      count: 0,
      limit: opts.limit ?? 10,
      offset: opts.offset ?? 0,
      stats: {
        average: 0,
        total: 0,
        distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      },
    }
  }
}

export const retrieveOwnReview = async (
  productId: string,
): Promise<OwnReviewDTO | null> => {
  const authHeaders = await getAuthHeaders()
  if (!Object.keys(authHeaders).length) return null

  try {
    const { review } = await sdk.client.fetch<{ review: OwnReviewDTO | null }>(
      `/store/products/${productId}/reviews/me`,
      {
        method: "GET",
        headers: authHeaders,
        cache: "no-store",
      },
    )
    return review
  } catch {
    return null
  }
}

type SubmitState = {
  ok: boolean
  message: string | null
  status?: "pending" | "approved" | "rejected"
}

export async function submitProductReview(
  _state: SubmitState | null,
  formData: FormData,
): Promise<SubmitState> {
  const productId = formData.get("product_id") as string
  const rating = Number(formData.get("rating"))
  const title = (formData.get("title") as string | null) || null
  const body = (formData.get("body") as string) || ""
  const variantId = (formData.get("variant_id") as string | null) || null

  if (!productId) return { ok: false, message: "Produs lipsă" }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, message: "Selectează o notă de la 1 la 5 stele" }
  }
  if (body.trim().length < 10) {
    return {
      ok: false,
      message: "Scrie cel puțin 10 caractere pentru a-ți descrie experiența",
    }
  }

  const authHeaders = await getAuthHeaders()
  if (!Object.keys(authHeaders).length) {
    return {
      ok: false,
      message: "Trebuie să te autentifici în cont pentru a publica o recenzie",
    }
  }

  try {
    const { review } = await sdk.client.fetch<{
      review: { id: string; status: "pending" | "approved" | "rejected" }
    }>(`/store/products/${productId}/reviews`, {
      method: "POST",
      headers: authHeaders,
      body: { rating, title, body: body.trim(), variant_id: variantId },
    })

    const cacheTag = await getCacheTag(`reviews-${productId}`)
    if (cacheTag) revalidateTag(cacheTag)
    revalidateTag(`reviews-${productId}`)

    return {
      ok: true,
      message:
        review.status === "approved"
          ? "Mulțumim! Recenzia ta este publicată."
          : "Mulțumim! Recenzia ta va fi publicată după moderare.",
      status: review.status,
    }
  } catch (e: any) {
    const msg =
      typeof e?.message === "string"
        ? e.message
        : "Recenzia nu a putut fi publicată"
    // Try to surface backend's user-friendly message if present
    const cleaned = msg
      .replace(/^Error:\s*/, "")
      .replace(/^\d+\s+/, "")
      .trim()
    return { ok: false, message: cleaned || "Eroare la trimitere" }
  }
}
