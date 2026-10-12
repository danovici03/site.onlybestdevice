import type { Logger } from "@medusajs/framework/types"

/**
 * Invalidarea cache-ului Next.js al storefront-ului.
 *
 * Storefront-ul cere datele cu `force-cache` și fără TTL, deci o intrare de
 * cache trăiește până când cineva îi invalidează tagul. Apelul de aici e
 * singurul lucru care face ca o modificare din Admin să se vadă pe site.
 *
 * Logica stă într-un singur loc pentru că a fost copiată identic în trei
 * subscribere (produse, hero, recenzii), iar prima corectură reală — tăcerea de
 * mai jos — ar fi trebuit altfel aplicată în fiecare copie.
 */

/**
 * Configurația lipsă se anunță o singură dată per proces.
 *
 * Era pe `logger.debug`, adică invizibilă la nivelul implicit de log: pe
 * producție `REVALIDATE_SECRET` a rămas gol, subscriberele au ieșit tăcut la
 * fiecare salvare, iar prețurile promoționale n-au apărut pe site — fără nicio
 * linie care să spună de ce. Pe `warn` se vede. O singură dată, fiindcă o
 * migrare de catalog emite sute de evenimente și n-are rost să umple logul cu
 * același rând.
 */
let warnedMissingConfig = false

/** Același site, cu sau fără `www.` — singurul redirect pe care îl urmăm. */
const sameSite = (a: string, b: string) =>
  a.replace(/^www\./, "") === b.replace(/^www\./, "")

/**
 * POST cu secretul, urmând manual un redirect apex ↔ www.
 *
 * `fetch` din Node aruncă antetul `Authorization` la orice redirect către alt
 * host. Pe producție `STOREFRONT_REVALIDATE_URL` arăta spre
 * `onlybestdevice.ro`, care face 308 spre `www.` — cererea ajungea fără secret,
 * fiecare revalidare lua 401, iar site-ul a rămas pe date vechi (un iPhone nou
 * de 512GB nu apărea în selectorul fraților de 256GB).
 */
async function postWithAuth(url: string, secret: string, body: string) {
  const init: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body,
    redirect: "manual",
  }
  const res = await fetch(url, init)
  const location = res.headers.get("location")
  if (![301, 302, 307, 308].includes(res.status) || !location) return res

  const next = new URL(location, url)
  if (!sameSite(new URL(url).hostname, next.hostname)) return res
  return fetch(next, init)
}

/**
 * Întoarce `true` doar dacă storefront-ul a confirmat revalidarea (sau n-a
 * avut ce revalida). Configurația lipsă e `false`, ca și un răspuns de eroare.
 */
export const revalidateStorefront = async (
  logger: Logger,
  eventName: string,
  tags: string[]
): Promise<boolean> => {
  const url = process.env.STOREFRONT_REVALIDATE_URL
  const secret = process.env.REVALIDATE_SECRET

  if (!url || !secret) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true
      const missing = [
        !url && "STOREFRONT_REVALIDATE_URL",
        !secret && "REVALIDATE_SECRET",
      ].filter(Boolean)
      logger.warn(
        `Revalidarea storefront-ului e DEZACTIVATĂ: ${missing.join(" și ")} ` +
          `${missing.length > 1 ? "lipsesc" : "lipsește"} sau ${
            missing.length > 1 ? "sunt goale" : "e goală"
          }. ` +
          `Modificările din Admin nu vor apărea pe site până la următorul deploy ` +
          `de storefront. (Mesajul apare o singură dată per pornire.)`
      )
    }
    return false
  }

  if (!tags.length) return true

  try {
    const res = await postWithAuth(url, secret, JSON.stringify({ tags }))
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      logger.warn(
        `Storefront revalidate ${res.status} for ${eventName} (${tags.join(", ")}): ${text}`
      )
      return false
    }
    logger.info(`Revalidated storefront [${tags.join(", ")}] on ${eventName}`)
    return true
  } catch (e) {
    logger.warn(
      `Storefront revalidate failed for ${eventName}: ${(e as Error).message}`
    )
    return false
  }
}

/**
 * Tagurile pe care le revalidează o schimbare de stoc din gestiune.
 *
 * Stocul se schimbă la fiecare vânzare din magazin. Revalidarea tagului global
 * `products` la fiecare push invalida toate paginile site-ului, iar pe Vercel
 * fiecare pagină invalidată și apoi vizitată (de crawlere, zeci de ori pe zi)
 * e o regenerare facturată — ISR Writes era cea mai mare linie din factură.
 *
 * Acum: pagina fiecărui produs schimbat (`product-<id>`, `product-<handle>`),
 * coșurile, iar listările (`product-lists`) doar când un produs a intrat sau a
 * ieșit din stoc. Tagurile sunt definite în storefront, `lib/util/cache-tags.ts`.
 * Peste `MAX_TARGETED_PRODUCTS` (o resincronizare în masă) revenim la tagul
 * global: o singură invalidare în loc de sute de taguri.
 */
export const PRODUCT_LISTS_TAG = "product-lists"
export const productTag = (idOrHandle: string) => `product-${idOrHandle}`
export const MAX_TARGETED_PRODUCTS = 50

/** Tagurile de dinainte de revalidarea țintită, pentru un storefront vechi. */
export const GLOBAL_STOCK_TAGS = ["products", "carts"]

export const stockRevalidationTags = (
  products: Array<{
    id: string
    handle?: string | null
    availability_changed: boolean
  }>
): string[] => {
  if (!products.length) return []
  if (products.length > MAX_TARGETED_PRODUCTS) return [...GLOBAL_STOCK_TAGS]

  const tags = new Set<string>(["carts"])
  for (const p of products) {
    tags.add(productTag(p.id))
    if (p.handle) tags.add(productTag(p.handle))
    if (p.availability_changed) tags.add(PRODUCT_LISTS_TAG)
  }
  return [...tags]
}
