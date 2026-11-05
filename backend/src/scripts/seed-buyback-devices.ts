import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { buybackService } from "../lib/buyback/data"
import { normalizeStorage } from "../lib/buyback/schema"
import { slugify } from "../lib/phone-group"

/**
 * Lista modelelor pentru preluare, luată din datele publice ale flip.ro/sell
 * (aceleași cereri pe care le face pagina lor pentru orice vizitator, fără
 * captcha): brandurile, modelele cu prețul maxim, stocările și culorile.
 *
 * Ce scrie:
 *   - modelele lipsă, cu stocările lor FĂRĂ preț (base_price null) — prețul de
 *     preluare îl pui tu din admin; nu copiem prețurile flip;
 *   - la toate: `competitor_price` (prețul maxim flip = stare perfectă, cea mai
 *     mare stocare) și data verificării, ca reper în admin;
 *   - stocările și culorile noi apărute la flip;
 *   - legătura cu catalogul nostru (`phone_group`) și poza din catalog, unde
 *     modelul se potrivește.
 *
 * Ce NU atinge: prețurile de bază, activ/inactiv, modelele adăugate manual.
 * Idempotent — se poate rula oricând pentru reîmprospătarea prețurilor flip.
 *
 * Rulare:  cd backend && yarn medusa exec ./src/scripts/seed-buyback-devices.ts
 *   DRY_RUN=1   doar raport
 *   FLIP_CACHE=…  fișierul în care se salvează răspunsurile flip (implicit în
 *               directorul temporar). O rulare întreruptă de limitarea lor
 *               (429) reia de unde a rămas; șterge fișierul pentru date noi.
 *   FLIP_DELAY_MS / FLIP_429_WAIT_MS — pauzele (implicit 2 s / 60 s). Flip
 *               blochează după ~15 cereri rapide, pentru mult timp; pentru o
 *               rulare completă: FLIP_DELAY_MS=90000 FLIP_429_WAIT_MS=900000
 *   FULL=1      citește din nou stocările/culorile și la modelele existente
 *               (implicit doar la cele noi — reîmprospătarea prețurilor flip
 *               costă atunci doar 4 cereri)
 */

const SELL_BFF = "https://sell-bff.flip.ro"
const BRANDS: Record<number, string> = { 1: "Apple", 3: "Samsung", 4: "Xiaomi", 2: "Huawei" }
/**
 * Flip limitează cererile (429 după câteva zeci pe minut, fără Retry-After).
 * Mergem încet — o cerere la 2 s — și la 429 așteptăm un minut întreg.
 */
const DELAY_MS = Number(process.env.FLIP_DELAY_MS) || 2000
const RATE_LIMIT_WAIT_MS = Number(process.env.FLIP_429_WAIT_MS) || 60_000
const UA = "Mozilla/5.0 (compatible; onlybestdevice-buyback-sync/1.0)"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const CACHE_PATH = process.env.FLIP_CACHE || join(tmpdir(), "buyback-flip-cache.json")
const cache: Record<string, any> = existsSync(CACHE_PATH)
  ? JSON.parse(readFileSync(CACHE_PATH, "utf8"))
  : {}

/** Cererea flip, din cache dacă am mai făcut-o. */
async function cachedJson(url: string): Promise<any> {
  if (cache[url]) return cache[url]
  const body = await getJson(url)
  cache[url] = body
  writeFileSync(CACHE_PATH, JSON.stringify(cache))
  await sleep(DELAY_MS)
  return body
}

async function getJson(url: string): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } })
    if (res.ok) return res.json()
    if (attempt >= 3) throw new Error(`${res.status} ${res.statusText} — ${url}`)
    await sleep(res.status === 429 ? RATE_LIMIT_WAIT_MS : 5000 * attempt)
  }
}

/**
 * Numele flip → numele nostru. Flip pune rețeaua în nume („Galaxy S25 Ultra 5G
 * Dual Sim”) și listează separat variantele single/dual SIM; noi le unim, ca
 * în catalog (`lib/phone-group.ts` scoate aceiași tokeni).
 */
function cleanModel(brand: string, name: string): string {
  let m = name
    .replace(/\s+(5g|4g|lte|dual\s*sim)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
  if (m.toLowerCase().startsWith(brand.toLowerCase() + " ")) m = m.slice(brand.length + 1)
  // „15”, „14T Pro” la Xiaomi — fără marcă nu înseamnă nimic.
  if (/^\d/.test(m)) m = `${brand} ${m}`
  return m
}

const handleOf = (brand: string, model: string) => {
  const full = model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`
  return slugify(full.replace(/\+/g, " plus "))
}

type FlipDevice = {
  brand: string
  model: string
  handle: string
  refs: number[]
  maxPrice: number
  storages: Set<string>
  colors: Set<string>
}

export default async function seedBuybackDevices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const service = buybackService(container)
  const dryRun = process.env.DRY_RUN === "1"

  // 1. Modelele flip, unite pe cheia noastră.
  const flip = new Map<string, FlipDevice>()
  for (const [brandId, brand] of Object.entries(BRANDS)) {
    const body = await cachedJson(
      `${SELL_BFF}/v2/flow/1/2?lang=RO&previousStepData=${brandId}&categories=SMARTPHONE`,
    )
    for (const m of body?.data?.data ?? []) {
      const model = cleanModel(brand, String(m.name))
      const handle = handleOf(brand, model)
      const cur = flip.get(handle)
      if (cur) {
        cur.refs.push(m.id)
        cur.maxPrice = Math.max(cur.maxPrice, Number(m.maxPrice) || 0)
      } else {
        flip.set(handle, {
          brand,
          model,
          handle,
          refs: [m.id],
          maxPrice: Number(m.maxPrice) || 0,
          storages: new Set(),
          colors: new Set(),
        })
      }
    }
  }
  logger.info(`flip: ${flip.size} modele unice (cache: ${CACHE_PATH})`)

  const existing = (await service.listBuybackDevices({}, { relations: ["prices"], take: 5000 })) as any[]
  const byHandle = new Map(existing.map((d) => [d.handle, d]))

  // 2. Stocările și culorile — o cerere pe model, doar pentru modelele noi
  //    (sau toate, cu FULL=1). Variantele single/dual SIM au aceleași stocări,
  //    deci ajunge prima. Un model care eșuează rămâne fără stocări: le adaugi
  //    din admin sau rulezi din nou.
  const full = process.env.FULL === "1"
  const toConfigure = [...flip.values()].filter((d) => full || !byHandle.get(d.handle)?.prices?.length)
  logger.info(`flip: citesc configurațiile pentru ${toConfigure.length} modele (~${Math.ceil((toConfigure.length * DELAY_MS) / 60000)} min)`)
  const failed: string[] = []
  let n = 0
  for (const d of toConfigure) {
    try {
      const body = await cachedJson(
        `${SELL_BFF}/v2/flow/1/3?lang=RO&previousStepData=${d.refs[0]}&categories=SMARTPHONE`,
      )
      const cfg = body?.data?.data ?? {}
      for (const s of cfg.storages ?? []) {
        const norm = normalizeStorage(String(s.name))
        if (norm) d.storages.add(norm)
      }
      for (const c of cfg.colors ?? []) if (c?.name) d.colors.add(String(c.name))
    } catch (e: any) {
      failed.push(`${d.brand} ${d.model}`)
      logger.warn(`flip: fără configurație pentru ${d.brand} ${d.model}: ${e.message}`)
      // Încă blocați după reîncercări: nu mai insistăm. Ce s-a citit e în cache.
      if (String(e.message).startsWith("429")) {
        logger.warn("flip: limitare 429 persistentă — opresc citirea; rulează din nou mai târziu")
        break
      }
    }
    if (++n % 25 === 0) logger.info(`flip: configurații ${n}/${toConfigure.length}`)
  }

  // 3. Catalogul nostru: grupurile de telefoane, pentru legătură și poză.
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "thumbnail", "metadata", "status"],
    filters: { status: "published" },
  })
  const ourGroups = new Map<string, string | null>()
  for (const p of products as any[]) {
    const g = p.metadata?.phone_group
    if (g && !ourGroups.get(g)) ourGroups.set(g, p.thumbnail ?? null)
  }

  // 4. Scriere.
  const now = new Date()
  const stats = { created: 0, updated: 0, storagesAdded: 0, linked: 0 }

  for (const d of flip.values()) {
    const linked = ourGroups.has(d.handle)
    if (linked) stats.linked++
    const colors = [...d.colors]
    const cur = byHandle.get(d.handle)

    if (!cur) {
      stats.created++
      stats.storagesAdded += d.storages.size
      if (dryRun) continue
      const created = await service.createBuybackDevices({
        brand: d.brand,
        model: d.model,
        handle: d.handle,
        phone_group: d.handle,
        image_url: ourGroups.get(d.handle) ?? null,
        colors: colors as any, // json în DML e tipat ca obiect; stocăm lista de nume
        rank: Math.round(d.maxPrice / 10),
        competitor_price: d.maxPrice || null,
        competitor_ref: d.refs.join(","),
        competitor_checked_at: now,
      })
      if (d.storages.size) {
        await service.createBuybackPrices(
          [...d.storages].map((storage) => ({ storage, base_price: null, device_id: created.id })),
        )
      }
      continue
    }

    stats.updated++
    const have = new Set((cur.prices ?? []).map((p: any) => p.storage))
    const fresh = [...d.storages].filter((s) => !have.has(s))
    stats.storagesAdded += fresh.length
    if (dryRun) continue
    const mergedColors = [...new Set([...((cur.colors as string[]) ?? []), ...colors])]
    await service.updateBuybackDevices({
      id: cur.id,
      colors: mergedColors as any,
      competitor_price: d.maxPrice || null,
      competitor_ref: d.refs.join(","),
      competitor_checked_at: now,
      ...(cur.image_url ? {} : { image_url: ourGroups.get(d.handle) ?? null }),
    })
    if (fresh.length) {
      await service.createBuybackPrices(
        fresh.map((storage) => ({ storage, base_price: null, device_id: cur.id })),
      )
    }
  }

  logger.info(
    `${dryRun ? "[DRY_RUN] " : ""}modele noi: ${stats.created}, actualizate: ${stats.updated}, ` +
      `stocări adăugate: ${stats.storagesAdded}, legate de catalogul nostru: ${stats.linked}`,
  )
  if (failed.length) logger.warn(`fără stocări (de rulat din nou): ${failed.join(", ")}`)
}
