import { sdk } from "@lib/config"
import { getCacheOptions } from "./cookies"

export type BestSellerEntry = {
  product_id: string
  sold: number
}

export const listBestSellers = async ({
  categoryId,
  limit = 12,
}: {
  categoryId?: string
  limit?: number
}): Promise<BestSellerEntry[]> => {
  const next = {
    ...(await getCacheOptions("best-sellers")),
    revalidate: 300,
  }

  return sdk.client
    .fetch<{ best_sellers: BestSellerEntry[] }>("/store/best-sellers", {
      query: {
        limit,
        ...(categoryId ? { category_id: categoryId } : {}),
      },
      next,
      cache: "force-cache",
    })
    .then((r) => r.best_sellers ?? [])
    .catch(() => [])
}
