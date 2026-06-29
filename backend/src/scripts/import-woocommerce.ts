/**
 * Import WooCommerce → Medusa.
 *
 * Citește export-ul produs de `migration/wc-export.mjs`
 * (migration/data/wc-export.json) și creează în Medusa:
 *  - categoriile (mirror după WC: name + handle = slug WC + ierarhie parent)
 *  - produsele (status DRAFT, ca să le verifici înainte de publicare)
 *  - variantele (simple => 1 variantă; variabile => din WC variations)
 *  - prețuri în RON (unități majore, ex. 2999 = 2999 RON)
 *
 * Idempotent: sare peste produsele al căror handle există deja.
 * Rulare:  cd backend && yarn medusa exec ./src/scripts/import-woocommerce.ts
 *   Opțional: WC_EXPORT=/cale/altfel.json IMPORT_CURRENCY=ron PUBLISH=1
 */
import fs from "node:fs"
import path from "node:path"
import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

// Medusa exec rulează cu cwd = directorul `backend/`.
const EXPORT_PATH =
  process.env.WC_EXPORT ||
  path.join(process.cwd(), "../migration/data/wc-export.json")
const CURRENCY = (process.env.IMPORT_CURRENCY || "ron").toLowerCase()
// Implicit: păstrează statusul din WooCommerce (publish→published, restul→draft).
// PUBLISH=1 forțează tot ca published; DRAFT_ALL=1 forțează tot ca draft (pentru verificare).
const FORCE_PUBLISH = !!process.env.PUBLISH
const FORCE_DRAFT = !!process.env.DRAFT_ALL
const statusOf = (wcStatus?: string) =>
  FORCE_DRAFT
    ? ProductStatus.DRAFT
    : FORCE_PUBLISH || wcStatus === "publish"
      ? ProductStatus.PUBLISHED
      : ProductStatus.DRAFT
const BATCH = Number(process.env.IMPORT_BATCH || "50")

type WcImage = { src: string }
type WcAttr = { name: string; options?: string[]; variation?: boolean }
type WcCat = { id: number; name: string; slug: string; parent: number }
type WcProduct = {
  id: number
  name: string
  slug: string
  type: string
  status: string
  description?: string
  short_description?: string
  sku?: string
  regular_price?: string
  price?: string
  stock_quantity?: number | null
  images?: WcImage[]
  attributes?: WcAttr[]
  categories?: { id: number; slug: string }[]
}
type WcVariation = {
  id: number
  sku?: string
  regular_price?: string
  price?: string
  attributes?: { name: string; option: string }[]
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}

function stripHtml(html?: string): string | undefined {
  if (!html) return undefined
  const txt = html
    .replace(/<\/(p|div|li|br|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return txt.length ? txt : undefined
}

function toAmount(s?: string): number | null {
  if (!s) return null
  const n = Number(String(s).replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

export default async function importWoocommerce({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)

  if (!fs.existsSync(EXPORT_PATH)) {
    throw new Error(
      `Export negăsit: ${EXPORT_PATH}. Rulează întâi: node migration/wc-export.mjs`
    )
  }
  const exp = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8")) as {
    categories: WcCat[]
    products: WcProduct[]
    variations: Record<string, WcVariation[]>
  }
  logger.info(
    `Citit export: ${exp.products.length} produse, ${exp.categories.length} categorii.`
  )

  const [defaultChannel] = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultChannel) throw new Error("Lipsește 'Default Sales Channel'. Rulează seed-ul.")
  const [shippingProfile] = await fulfillmentService.listShippingProfiles()
  if (!shippingProfile) throw new Error("Lipsește shipping profile. Rulează seed-ul.")

  // ── Categorii: mirror după WC (handle = slug WC), idempotent, cu ierarhie ──
  const { data: existingCats } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  })
  const catHandleToId = new Map<string, string>(
    existingCats.map((c: any) => [c.handle, c.id])
  )
  const wcCatById = new Map(exp.categories.map((c) => [c.id, c]))
  const wcCatIdToSlug = new Map(exp.categories.map((c) => [c.id, c.slug]))
  const missingCats = exp.categories.filter((c) => !catHandleToId.has(c.slug))
  if (missingCats.length) {
    logger.info(`Creez ${missingCats.length} categorii noi…`)
    // Iterativ: la fiecare trecere creează categoriile al căror părinte e deja
    // disponibil (rădăcini sau părinte creat). Gestionează orice adâncime.
    let pending = [...missingCats]
    while (pending.length) {
      const ready = pending.filter((c) => {
        if (!c.parent) return true
        const parentSlug = wcCatById.get(c.parent)?.slug
        return parentSlug ? catHandleToId.has(parentSlug) : true
      })
      if (!ready.length) {
        // Părinți negăsiți (ciclu sau părinte absent din export) → creează ca rădăcini.
        logger.warn(`${pending.length} categorii fără părinte rezolvabil — creez ca rădăcini.`)
        ready.push(...pending)
      }
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: ready.map((c) => {
            const parentSlug = c.parent ? wcCatById.get(c.parent)?.slug : undefined
            const parent_category_id = parentSlug ? catHandleToId.get(parentSlug) : undefined
            return { name: decodeEntities(c.name), handle: c.slug, is_active: true, parent_category_id }
          }),
        },
      })
      for (const c of result) catHandleToId.set((c as any).handle, (c as any).id)
      const done = new Set(ready.map((c) => c.slug))
      pending = pending.filter((c) => !done.has(c.slug))
    }
  }

  // ── Produse: sare peste handle-uri existente ──
  // Handle = slug WC, sau generat din nume dacă slug-ul lipsește (păstrează cele 21 fără slug).
  const handleOf = (p: WcProduct) => (p.slug || slugify(p.name || "")).trim()
  const handles = exp.products.map(handleOf).filter(Boolean)
  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: handles },
    pagination: { take: handles.length + 100 },
  } as any)
  const existingHandles = new Set(existing.map((p: any) => p.handle))
  if (existingHandles.size) logger.info(`Sar peste ${existingHandles.size} produse existente.`)

  const toCreate: any[] = []
  let skipped = 0
  let noPrice = 0

  for (const p of exp.products) {
    const handle = handleOf(p)
    if (!handle || !p.name) {
      skipped++
      continue
    }
    if (existingHandles.has(handle)) continue

    const category_ids = (p.categories || [])
      .map((c) => catHandleToId.get(wcCatIdToSlug.get(c.id) || ""))
      .filter((id): id is string => !!id)

    const images = (p.images || []).map((im) => ({ url: im.src })).filter((i) => i.url)
    const thumbnail = images[0]?.url

    let options: { title: string; values: string[] }[]
    let variants: any[]

    if (p.type === "variable") {
      const variationAttrs = (p.attributes || []).filter((a) => a.variation && a.options?.length)
      options = variationAttrs.length
        ? variationAttrs.map((a) => ({ title: a.name, values: a.options! }))
        : [{ title: "Variantă", values: ["Standard"] }]

      const wcVars = exp.variations[String(p.id)] || []
      variants = wcVars.map((v) => {
        const optMap: Record<string, string> = {}
        for (const a of v.attributes || []) {
          // Dacă variația lasă atributul „Any", folosește prima valoare a opțiunii.
          const opt = options.find((o) => o.title === a.name)
          optMap[a.name] = a.option || opt?.values[0] || "Standard"
        }
        // Completează opțiunile lipsă cu prima valoare (Medusa cere toate opțiunile).
        for (const o of options) if (!(o.title in optMap)) optMap[o.title] = o.values[0]
        const amount = toAmount(v.price) ?? toAmount(v.regular_price)
        if (amount == null) noPrice++
        return {
          title: Object.values(optMap).join(" / ") || p.name,
          sku: v.sku || undefined,
          manage_inventory: false,
          options: optMap,
          prices: amount != null ? [{ amount, currency_code: CURRENCY }] : [],
        }
      })
      if (!variants.length) {
        // Produs variabil fără variații exportate → tratează ca simplu.
        options = [{ title: "Variantă", values: ["Standard"] }]
        const amount = toAmount(p.price) ?? toAmount(p.regular_price)
        if (amount == null) noPrice++
        variants = [
          {
            title: p.name,
            sku: p.sku || undefined,
            manage_inventory: false,
            options: { Variantă: "Standard" },
            prices: amount != null ? [{ amount, currency_code: CURRENCY }] : [],
          },
        ]
      }
    } else {
      options = [{ title: "Variantă", values: ["Standard"] }]
      const amount = toAmount(p.price) ?? toAmount(p.regular_price)
      if (amount == null) noPrice++
      variants = [
        {
          title: p.name,
          sku: p.sku || undefined,
          manage_inventory: false,
          options: { Variantă: "Standard" },
          prices: amount != null ? [{ amount, currency_code: CURRENCY }] : [],
        },
      ]
    }

    toCreate.push({
      title: p.name,
      handle,
      description: stripHtml(p.description) || stripHtml(p.short_description),
      status: statusOf(p.status),
      thumbnail,
      images,
      category_ids: category_ids.length ? category_ids : undefined,
      shipping_profile_id: shippingProfile.id,
      sales_channels: [{ id: defaultChannel.id }],
      options,
      variants,
    })
  }

  logger.info(
    `De creat: ${toCreate.length} produse (sărite fără slug/nume: ${skipped}; ` +
      `variante fără preț: ${noPrice}).`
  )
  if (noPrice) {
    logger.warn(
      `${noPrice} variante nu au preț în WooCommerce — importate fără preț, ` +
        `de completat în Admin înainte de publicare.`
    )
  }
  // Dedup pe handle (export-ul poate conține listări duplicate cu același slug).
  const seenHandle = new Set<string>()
  const deduped = toCreate.filter((p) => {
    if (seenHandle.has(p.handle)) return false
    seenHandle.add(p.handle)
    return true
  })
  const dupDropped = toCreate.length - deduped.length
  if (dupDropped) logger.warn(`${dupDropped} produse cu handle duplicat — păstrat primul.`)

  if (!deduped.length) {
    logger.info("Nimic de importat.")
    return
  }

  let created = 0
  let failed = 0
  for (let i = 0; i < deduped.length; i += BATCH) {
    const batch = deduped.slice(i, i + BATCH)
    try {
      const { result } = await createProductsWorkflow(container).run({
        input: { products: batch as any },
      })
      created += result.length
    } catch (e: any) {
      // Un produs problematic nu trebuie să oprească tot importul → reîncearcă individual.
      logger.warn(`Lot eșuat (${e?.message?.slice(0, 120)}). Reîncerc individual…`)
      for (const prod of batch) {
        try {
          await createProductsWorkflow(container).run({ input: { products: [prod] as any } })
          created++
        } catch (e2: any) {
          failed++
          logger.warn(`  sărit "${prod.handle}": ${e2?.message?.slice(0, 140)}`)
        }
      }
    }
    logger.info(`  importate ${created}/${deduped.length}…`)
  }
  logger.info(
    `✓ Import complet: ${created} produse create, ${failed} sărite (erori). ` +
      `Verifică în Admin.`
  )
}
