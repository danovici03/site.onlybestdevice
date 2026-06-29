"use server"

import { sdk } from "@lib/config"
import { getCacheOptions } from "./cookies"

export type FaqItemDTO = {
  id: string
  question: string
  answer: string
  display_order: number
}

export type FaqCategoryDTO = {
  id: string
  slug: string
  title: string
  description: string | null
  display_order: number
  items: FaqItemDTO[]
}

export const listFaq = async (): Promise<FaqCategoryDTO[]> => {
  const next = {
    ...(await getCacheOptions("faq")),
  }

  try {
    const { categories } = await sdk.client.fetch<{
      categories: FaqCategoryDTO[]
    }>(`/store/faq`, {
      method: "GET",
      next: { ...next, revalidate: 3600 },
      cache: "force-cache",
    })
    return categories ?? []
  } catch (err) {
    console.error("[listFaq] failed to fetch /store/faq", err)
    return []
  }
}
