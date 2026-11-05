import type { MedusaRequest } from "@medusajs/framework/http"

/**
 * Limită pentru calculul ofertei — ca nimeni să nu ne poată descărca tot
 * tabelul de prețuri în câteva minute (exact ce face flip cu noi, cu 429).
 *
 * Cererile vin din server actions ale storefront-ului, deci `req.ip` e al
 * Vercel. Storefront-ul trimite IP-ul vizitatorului în `x-client-ip`; cine
 * sună backend-ul direct îl poate falsifica, de aceea există și plafonul
 * global. În memorie, pe instanță — ajunge pentru un singur container.
 */
const WINDOW_MS = 10 * 60_000
const PER_CLIENT = 40
const GLOBAL = 3000
const hits = new Map<string, number[]>()

const clientKey = (req: MedusaRequest) => {
  const h = req.headers["x-client-ip"]
  const ip = (Array.isArray(h) ? h[0] : h)?.split(",")[0]?.trim()
  return `ip:${ip || req.ip || "?"}`
}

const bump = (key: string, now: number, max: number) => {
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (list.length >= max) {
    hits.set(key, list)
    return false
  }
  list.push(now)
  hits.set(key, list)
  return true
}

const SUBMIT_PER_CLIENT = 10

/**
 * Trimiterea preluării are contorul ei. Cu același contor ca evaluările, un
 * client care a încercat multe combinații (sau mai mulți oameni în spatele
 * aceluiași IP de operator mobil) primea 429 exact când trimitea oferta
 * acceptată. Fără plafon global: trimiterea cere oricum un token semnat, deci
 * nu se poate folosi ca să descarci prețurile.
 */
export function allowSubmit(req: MedusaRequest, now = Date.now()): boolean {
  return bump(`submit:${clientKey(req)}`, now, SUBMIT_PER_CLIENT)
}

export function allowQuote(req: MedusaRequest, now = Date.now()): boolean {
  if (hits.size > 20_000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k)
  }
  // Întâi clientul: cererile respinse pe IP nu consumă din plafonul global,
  // altfel un singur client insistent ar bloca oferta pentru toată lumea.
  return bump(clientKey(req), now, PER_CLIENT) && bump("global", now, GLOBAL)
}
