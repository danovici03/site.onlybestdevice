import { questionsFor } from "./catalog"
import { sortPrices } from "./data"

/**
 * Ce vede site-ul despre un model. Fără prețurile de bază pe stocări (le
 * ascundem ca flip: clientul vede doar „până la” și oferta finală) și fără
 * prețul concurenței.
 */
export function publicDevice(d: any) {
  const priced = sortPrices((d.prices ?? []).filter((p: any) => p.base_price != null && p.base_price > 0))
  return {
    handle: d.handle as string,
    brand: d.brand as string,
    model: d.model as string,
    image_url: (d.image_url as string | null) ?? null,
    max_price: priced.length ? Math.max(...priced.map((p: any) => Number(p.base_price))) : null,
    storages: priced.map((p: any) => p.storage as string),
    colors: Array.isArray(d.colors) ? (d.colors as string[]) : [],
    questions: questionsFor(d.brand),
  }
}

/** Un model apare pe site doar dacă e activ și are cel puțin o stocare cu preț. */
export const isOffered = (d: ReturnType<typeof publicDevice>, active: boolean) =>
  active && d.storages.length > 0
