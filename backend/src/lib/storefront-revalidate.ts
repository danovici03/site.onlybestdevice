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

export const revalidateStorefront = async (
  logger: Logger,
  eventName: string,
  tags: string[]
): Promise<void> => {
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
    return
  }

  if (!tags.length) return

  try {
    const res = await postWithAuth(url, secret, JSON.stringify({ tags }))
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      logger.warn(
        `Storefront revalidate ${res.status} for ${eventName} (${tags.join(", ")}): ${text}`
      )
    } else {
      logger.info(`Revalidated storefront [${tags.join(", ")}] on ${eventName}`)
    }
  } catch (e) {
    logger.warn(
      `Storefront revalidate failed for ${eventName}: ${(e as Error).message}`
    )
  }
}
