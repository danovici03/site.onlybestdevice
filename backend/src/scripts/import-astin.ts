import fs from "node:fs"
import path from "node:path"
import { parse } from "csv-parse/sync"

import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

import { ASTIN_PRODUCTS_CSV } from "./data/astin-products.csv"

/**
 * Imports the Astin product catalogue (60 products, ~384 variants) from a
 * Medusa-export-style CSV: one row per variant, with the first row of each
 * Product Handle carrying the product-level fields.
 *
 *   yarn medusa exec ./src/scripts/import-astin.ts              (uses embedded CSV)
 *   yarn medusa exec ./src/scripts/import-astin.ts <path-to-csv>
 *   DRY_RUN=true yarn medusa exec ./src/scripts/import-astin.ts
 *
 * The embedded CSV in ./data/astin-products.csv.ts is the default source —
 * production runs need no extra files. Pass a path to override.
 *
 * Defaults:
 *   - Prices: read from "Price EUR" column (zeros pass through)
 *   - manage_inventory: false on every variant (per user choice, 2026-05-18)
 *   - status: draft (CSV value passes through; only "published" is honoured)
 *
 * Idempotent: products whose handle already exists are skipped.
 *
 * Categories: the script maps each row's `Product Collection Handle` to one
 * of the seed-categories.ts handles under `camera-da-letto`. Run
 * `yarn medusa exec ./src/scripts/seed-categories.ts` first.
 */

type Row = Record<string, string>

const CSV_PATH = process.env.IMPORT_CSV
const CURRENCY = (process.env.IMPORT_CURRENCY || "eur").toLowerCase()
const DRY_RUN = process.env.DRY_RUN === "true"

// CSV `Product Collection Handle` → category handle in seed-categories.ts.
const COLLECTION_TO_CATEGORY: Record<string, string> = {
  "set-matrimoniali-lux": "set-matrimoniali",
  "set-matrimoniali": "set-matrimoniali",
  "set-singoli": "set-singoli",
  "materassi": "materassi",
  "topper": "topper",
  "reti-accessori": "reti-accessori-letto",
  "panche": "comodini-panche",
  "accessori": "comodini-panche",
  "cuscini-biancheria": "biancheria-cuscini",
}

const nonEmpty = (v: string | undefined): v is string =>
  typeof v === "string" && v.trim().length > 0

const parsePrice = (raw: string | undefined): number => {
  if (!nonEmpty(raw)) return 0
  const n = Number(raw.replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

const parseStatus = (raw: string | undefined): ProductStatus =>
  raw?.trim().toLowerCase() === "published"
    ? ProductStatus.PUBLISHED
    : ProductStatus.DRAFT

export default async function importAstin({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const productService = container.resolve(Modules.PRODUCT)

  const overridePath = args[0] || CSV_PATH
  let raw: string
  if (overridePath) {
    const resolved = path.resolve(overridePath)
    if (!fs.existsSync(resolved)) {
      throw new Error(`CSV not found: ${resolved}`)
    }
    logger.info(`Reading ${resolved}`)
    raw = fs.readFileSync(resolved, "utf8")
  } else {
    logger.info(`Using embedded CSV (${ASTIN_PRODUCTS_CSV.length} bytes)`)
    raw = ASTIN_PRODUCTS_CSV
  }
  const rows: Row[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: false,
  })
  logger.info(`Parsed ${rows.length} rows`)

  // Group rows by Product Handle, preserving order.
  const byHandle = new Map<string, Row[]>()
  for (const row of rows) {
    const handle = row["Product Handle"]?.trim()
    if (!handle) continue
    if (!byHandle.has(handle)) byHandle.set(handle, [])
    byHandle.get(handle)!.push(row)
  }
  logger.info(`Grouped into ${byHandle.size} products`)

  // Skip products that already exist.
  const allHandles = [...byHandle.keys()]
  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: allHandles },
  })
  const existingHandles = new Set(
    (existing as Array<{ handle: string }>).map((p) => p.handle)
  )
  if (existingHandles.size) {
    logger.info(`Skipping ${existingHandles.size} existing products`)
  }

  // Resolve sales channel + shipping profile.
  // Prefer "Default Sales Channel", fall back to the first channel that exists
  // (production may have renamed it, e.g. "Arredo Vita").
  const channels = await salesChannelService.listSalesChannels()
  if (!channels.length) {
    throw new Error("No sales channels found. Run yarn seed or create one in admin.")
  }
  const defaultChannel =
    channels.find((c) => c.name === "Default Sales Channel") ?? channels[0]
  if (defaultChannel.name !== "Default Sales Channel") {
    logger.info(`Using sales channel "${defaultChannel.name}" (${defaultChannel.id})`)
  }
  const shippingProfiles = await fulfillmentService.listShippingProfiles()
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    throw new Error("No shipping profile found. Run yarn seed first.")
  }

  // Resolve target category ids by handle.
  const targetCategoryHandles = new Set(Object.values(COLLECTION_TO_CATEGORY))
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
    filters: { handle: [...targetCategoryHandles] },
  })
  const categoryByHandle = new Map<string, string>()
  for (const c of categories as Array<{ id: string; handle: string }>) {
    categoryByHandle.set(c.handle, c.id)
  }
  const missingCats = [...targetCategoryHandles].filter(
    (h) => !categoryByHandle.has(h)
  )
  if (missingCats.length) {
    throw new Error(
      `Missing categories: ${missingCats.join(", ")}. ` +
        `Run: yarn medusa exec ./src/scripts/seed-categories.ts`
    )
  }

  // Collect all distinct tag values across new products and ensure they exist.
  const allTagValues = new Set<string>()
  for (const [handle, prs] of byHandle) {
    if (existingHandles.has(handle)) continue
    const head = prs[0]
    for (const t of (head["Product Tags"] || "").split(",")) {
      const v = t.trim()
      if (v) allTagValues.add(v)
    }
  }
  const tagValueToId = new Map<string, string>()
  if (allTagValues.size) {
    const { data: existingTags } = await query.graph({
      entity: "product_tag",
      fields: ["id", "value"],
      filters: { value: [...allTagValues] },
    })
    for (const t of existingTags as Array<{ id: string; value: string }>) {
      tagValueToId.set(t.value, t.id)
    }
    const missing = [...allTagValues].filter((v) => !tagValueToId.has(v))
    if (missing.length) {
      logger.info(`Creating ${missing.length} new tags`)
      const created = await productService.createProductTags(
        missing.map((value) => ({ value }))
      )
      for (const t of created as Array<{ id: string; value: string }>) {
        tagValueToId.set(t.value, t.id)
      }
    }
  }

  // Build product inputs.
  const products: any[] = []
  const skipped: string[] = []
  let unknownCollection = 0

  for (const [handle, prs] of byHandle) {
    if (existingHandles.has(handle)) continue

    const head = prs[0]
    const title = head["Product Title"]?.trim()
    if (!title) {
      skipped.push(`${handle}: missing title`)
      continue
    }

    const collectionHandle = head["Product Collection Handle"]?.trim() || ""
    const categoryHandle = COLLECTION_TO_CATEGORY[collectionHandle]
    if (!categoryHandle) {
      unknownCollection++
      logger.warn(
        `Unknown collection "${collectionHandle}" for ${handle} — leaving uncategorized`
      )
    }

    const optionName =
      prs.find((r) => nonEmpty(r["Option 1 Name"]))?.["Option 1 Name"]?.trim() ||
      "Dimensione"

    const optionValues = Array.from(
      new Set(
        prs
          .map((r) => r["Option 1 Value"]?.trim())
          .filter((v): v is string => !!v)
      )
    )

    const variants = prs
      .map((r) => {
        const variantTitle = r["Variant Title"]?.trim()
        const optValue = r["Option 1 Value"]?.trim()
        if (!variantTitle || !optValue) return null
        return {
          title: variantTitle,
          sku: r["Variant SKU"]?.trim() || undefined,
          barcode: r["Variant Barcode"]?.trim() || undefined,
          manage_inventory: false,
          allow_backorder: false,
          options: { [optionName]: optValue },
          prices: [
            { amount: parsePrice(r["Price EUR"]), currency_code: CURRENCY },
          ],
        }
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)

    if (!variants.length) {
      skipped.push(`${handle}: no valid variants`)
      continue
    }

    const tagIds = (head["Product Tags"] || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((v) => tagValueToId.get(v))
      .filter((id): id is string => !!id)
      .map((id) => ({ id }))

    const images: { url: string }[] = []
    const seen = new Set<string>()
    for (const r of prs) {
      const url = r["Image 1 Url"]?.trim()
      if (url && !seen.has(url)) {
        images.push({ url })
        seen.add(url)
      }
    }

    const thumbnail = head["Product Thumbnail"]?.trim() || images[0]?.url

    products.push({
      title,
      handle,
      subtitle: head["Product Subtitle"]?.trim() || undefined,
      description: head["Product Description"]?.trim() || undefined,
      material: head["Product Material"]?.trim() || undefined,
      hs_code: head["Product HS Code"]?.trim() || undefined,
      origin_country: head["Product Origin Country"]?.trim() || undefined,
      mid_code: head["Product Mid Code"]?.trim() || undefined,
      status: parseStatus(head["Product Status"]),
      discountable: head["Product Discountable"]?.trim() !== "false",
      thumbnail,
      images,
      tags: tagIds.length ? tagIds : undefined,
      shipping_profile_id: shippingProfile.id,
      sales_channels: [{ id: defaultChannel.id }],
      category_ids: categoryHandle
        ? [categoryByHandle.get(categoryHandle)!]
        : undefined,
      options: [{ title: optionName, values: optionValues }],
      variants,
    })
  }

  if (skipped.length) {
    logger.warn(`Skipped ${skipped.length} products:`)
    for (const s of skipped) logger.warn(`  ${s}`)
  }
  if (unknownCollection) {
    logger.warn(`${unknownCollection} product(s) had unknown collection`)
  }
  if (!products.length) {
    logger.info("Nothing to import.")
    return
  }

  logger.info(
    `Ready to create ${products.length} products with ${products.reduce(
      (s, p) => s + p.variants.length,
      0
    )} variants`
  )

  if (DRY_RUN) {
    logger.info("DRY_RUN=true — not writing.")
    for (const p of products.slice(0, 5)) {
      logger.info(
        `  ${p.handle} (${p.variants.length}v) → category=${
          p.category_ids?.[0] ?? "—"
        } imgs=${p.images.length} tags=${p.tags?.length ?? 0}`
      )
    }
    if (products.length > 5) logger.info(`  …and ${products.length - 5} more`)
    return
  }

  const { result } = await createProductsWorkflow(container).run({
    input: { products: products as any },
  })
  logger.info(`Created ${result.length} products.`)
}
