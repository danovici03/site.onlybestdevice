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
    // Clasamentul vine din comenzi, iar nicio comandă nu revalidează tagul,
    // deci TTL-ul e singurul lucru care îl împrospătează. O oră, nu 5 minute:
    // TTL-ul fetch-ului devine TTL-ul paginii, iar fiecare expirare a unei
    // pagini vizitate e o regenerare facturată pe Vercel. Raftul apare doar pe
    // homepage, nu pe paginile de produs.
    revalidate: 3600,
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
