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

type Row = Record<string, string>

const CSV_PATH =
  process.env.IMPORT_CSV ||
  "/Users/daniel/Code/www/arredovita/import/medusa-import-uploaded.csv"
const DEFAULT_PRICE_CENTS = Number(process.env.IMPORT_DEFAULT_PRICE_CENTS ?? "0")
const CURRENCY = (process.env.IMPORT_CURRENCY || "eur").toLowerCase()

function nonEmpty(v: string | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0
}

function pickImages(row: Row): string[] {
  const urls: string[] = []
  for (let i = 1; i <= 6; i++) {
    const u = row[`Product Image ${i} Url`]
    if (nonEmpty(u)) urls.push(u.trim())
  }
  return urls
}

function pickTags(row: Row): string[] {
  const tags: string[] = []
  for (let i = 1; i <= 6; i++) {
    const t = row[`Product Tag ${i}`]
    if (nonEmpty(t)) tags.push(t.trim())
  }
  return tags
}

function priceFor(row: Row): number {
  const raw = row["Variant Price EUR"]
  if (!nonEmpty(raw)) return DEFAULT_PRICE_CENTS
  const n = Number(raw.replace(",", "."))
  if (!Number.isFinite(n)) return DEFAULT_PRICE_CENTS
  return Math.round(n * 100)
}

export default async function importProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const productService = container.resolve(Modules.PRODUCT)

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`)
  }

  const raw = fs.readFileSync(CSV_PATH, "utf8")
  const rows: Row[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: false,
  })
  logger.info(`Parsed ${rows.length} rows from ${path.basename(CSV_PATH)}`)

  const [defaultChannel] = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultChannel) {
    throw new Error(
      "No 'Default Sales Channel' found. Run yarn seed first or create one in admin."
    )
  }

  const shippingProfiles = await fulfillmentService.listShippingProfiles()
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    throw new Error(
      "No shipping profile found. Run yarn seed first or create one in admin."
    )
  }

  const handles = rows.map((r) => r["Product Handle"]).filter(nonEmpty)
  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: handles },
  })
  const existingHandles = new Set(existing.map((p: { handle: string }) => p.handle))
  if (existingHandles.size) {
    logger.info(`Skipping ${existingHandles.size} products that already exist`)
  }

  // Pre-create tags so createProductsWorkflow can attach them by id.
  const allTagValues = new Set<string>()
  for (const row of rows) {
    if (existingHandles.has(row["Product Handle"]?.trim() || "")) continue
    for (const v of pickTags(row)) allTagValues.add(v)
  }
  const tagValueToId = new Map<string, string>()
  if (allTagValues.size) {
    const { data: existingTags } = await query.graph({
      entity: "product_tag",
      fields: ["id", "value"],
      filters: { value: [...allTagValues] },
    })
    for (const t of existingTags as { id: string; value: string }[]) {
      tagValueToId.set(t.value, t.id)
    }
    const missing = [...allTagValues].filter((v) => !tagValueToId.has(v))
    if (missing.length) {
      logger.info(`Creating ${missing.length} new product tags`)
      const created = await productService.createProductTags(
        missing.map((value) => ({ value }))
      )
      for (const t of created as { id: string; value: string }[]) {
        tagValueToId.set(t.value, t.id)
      }
    }
    logger.info(`Tag map: ${tagValueToId.size} tags ready`)
  }

  const products: any[] = []
  let skippedNoTitle = 0
  let pricedFromDefault = 0

  for (const row of rows) {
    const handle = row["Product Handle"]?.trim()
    const title = row["Product Title"]?.trim()
    if (!handle || !title) {
      skippedNoTitle++
      continue
    }
    if (existingHandles.has(handle)) continue

    const optionName = row["Variant Option 1 Name"]?.trim() || "Modello"
    const optionValue = row["Variant Option 1 Value"]?.trim() || "Default"
    const variantTitle = row["Variant Title"]?.trim() || optionValue
    const sku = row["Variant SKU"]?.trim() || undefined
    const material = row["Product Material"]?.trim() || undefined
    const thumbnail = row["Product Thumbnail"]?.trim() || undefined
    const description = row["Product Description"]?.trim() || undefined

    const images = pickImages(row).map((url) => ({ url }))
    const tagValues = pickTags(row)

    const priceCents = priceFor(row)
    if (priceCents === DEFAULT_PRICE_CENTS && DEFAULT_PRICE_CENTS === 0) {
      pricedFromDefault++
    }

    products.push({
      title,
      handle,
      description,
      material,
      thumbnail,
      status: ProductStatus.DRAFT,
      shipping_profile_id: shippingProfile.id,
      images,
      tags: tagValues.length
        ? tagValues
            .map((value) => tagValueToId.get(value))
            .filter((id): id is string => !!id)
            .map((id) => ({ id }))
        : undefined,
      sales_channels: [{ id: defaultChannel.id }],
      options: [{ title: optionName, values: [optionValue] }],
      variants: [
        {
          title: variantTitle,
          sku,
          manage_inventory: false,
          allow_backorder: false,
          options: { [optionName]: optionValue },
          prices: [{ amount: priceCents, currency_code: CURRENCY }],
        },
      ],
    })
  }

  if (skippedNoTitle) {
    logger.warn(`Skipped ${skippedNoTitle} rows without title/handle`)
  }
  if (pricedFromDefault) {
    logger.warn(
      `${pricedFromDefault} variants imported with price 0 ${CURRENCY.toUpperCase()} ` +
        `(CSV had no price). Set IMPORT_DEFAULT_PRICE_CENTS or update prices in admin.`
    )
  }

  if (!products.length) {
    logger.info("Nothing to import.")
    return
  }

  logger.info(`Creating ${products.length} products…`)
  const { result } = await createProductsWorkflow(container).run({
    input: { products: products as any },
  })
  logger.info(`Created ${result.length} products.`)
}
