import { PRODUCT_LISTS_TAG } from "./storefront-revalidate"

/**
 * Când un price list programat începe sau se termină, prețurile se schimbă fără
 * ca Medusa să emită vreun eveniment, deci storefront-ul rămâne pe cache-ul
 * vechi până la 12 ore. Jobul `price-list-revalidate` acoperă golul acesta.
 *
 * Fereastra are mai multe minute, deci jobul lovește aceeași margine de câteva
 * ori. E intenționat: o rulare ratată (restart de backend, storefront în deploy)
 * se recuperează la următoarea, iar o pagină regenerată chiar în clipa schimbării
 * nu rămâne cu prețul vechi. Marginile sunt rare, deci repetarea nu costă.
 */
export const BOUNDARY_WINDOW_MS = 3 * 60_000

/** Prețul apare și în meniu și în best-selleri, deci nu ajung doar listările. */
export const PRICE_LIST_BOUNDARY_TAGS = [
  "products",
  PRODUCT_LISTS_TAG,
  "best-sellers",
]

export type ScheduledPriceList = {
  title?: string | null
  status?: string | null
  starts_at?: string | Date | null
  ends_at?: string | Date | null
}

const crossed = (at: string | Date | null | undefined, now: number) => {
  if (!at) return false
  const time = new Date(at).getTime()
  return time <= now && time > now - BOUNDARY_WINDOW_MS
}

/** Descrierea fiecărei margini tocmai trecute, pentru log. Draft-urile nu conțin prețuri active. */
export const crossedBoundaries = (
  lists: ScheduledPriceList[],
  now: number
): string[] =>
  lists
    .filter((list) => list.status === "active")
    .flatMap((list) => [
      ...(crossed(list.starts_at, now) ? [`start „${list.title}”`] : []),
      ...(crossed(list.ends_at, now) ? [`final „${list.title}”`] : []),
    ])
