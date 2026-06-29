import fs from "node:fs"
import path from "node:path"
import ExcelJS from "exceljs"
import sharp from "sharp"

import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

const CURRENCY = (process.env.EXPORT_CURRENCY || "eur").toLowerCase()
const UPLOAD_TO_STORAGE = process.env.EXPORT_UPLOAD !== "false"
const LOCAL_OUTPUT_DIR = process.env.EXPORT_OUTPUT_DIR || "/tmp"
const KEEP_LOCAL_COPY = process.env.EXPORT_KEEP_LOCAL !== "false"
const THUMB_SIZE = 100

type ProductRow = {
  product_id: string
  handle: string
  title: string
  description: string
  status: string
  collection: string
  categories: string
  tags: string
  variant_id: string
  variant_sku: string
  variant_title: string
  image_url: string
  current_price: number | null
  thumbnail_buffer: Buffer | null
}

const safeText = (v: unknown): string => {
  if (v === undefined || v === null) return ""
  return String(v).replace(/\s+/g, " ").trim()
}

const truncate = (s: string, n = 300): string =>
  s.length <= n ? s : `${s.slice(0, n - 1)}…`

const fetchThumbnail = async (
  url: string | null | undefined,
  logger: { warn: (msg: string) => void }
): Promise<Buffer | null> => {
  if (!url) return null
  try {
    const res = await fetch(url, { redirect: "follow" })
    if (!res.ok) {
      logger.warn(`Image ${url}: HTTP ${res.status}`)
      return null
    }
    const arr = new Uint8Array(await res.arrayBuffer())
    return await sharp(arr)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
      .png()
      .toBuffer()
  } catch (err: any) {
    logger.warn(`Image ${url}: ${err.message ?? err}`)
    return null
  }
}

export default async function exportProductsXlsx({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info("Fetching products from Medusa…")

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "title",
      "description",
      "status",
      "thumbnail",
      "collection.title",
      "categories.name",
      "tags.value",
      "images.url",
      "variants.id",
      "variants.sku",
      "variants.title",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
  })

  if (!products?.length) {
    logger.warn("No products found. Nothing to export.")
    return
  }

  logger.info(`Found ${products.length} products. Building rows…`)

  const rows: ProductRow[] = []
  const thumbCache = new Map<string, Buffer | null>()

  for (const p of products as any[]) {
    const variants = p.variants?.length
      ? p.variants
      : [{ id: "", sku: "", title: "", prices: [] }]

    const collection = safeText(p.collection?.title)
    const categories = (p.categories ?? [])
      .map((c: any) => safeText(c?.name))
      .filter(Boolean)
      .join(", ")
    const tags = (p.tags ?? [])
      .map((t: any) => safeText(t?.value))
      .filter(Boolean)
      .join(", ")
    const description = truncate(safeText(p.description))
    const thumbUrl = p.thumbnail || p.images?.[0]?.url || null

    let thumb: Buffer | null = null
    if (thumbUrl) {
      if (!thumbCache.has(thumbUrl)) {
        thumbCache.set(thumbUrl, await fetchThumbnail(thumbUrl, logger))
      }
      thumb = thumbCache.get(thumbUrl) ?? null
    }

    let firstRow = true
    for (const v of variants) {
      const price = (v.prices ?? []).find(
        (pr: any) => pr.currency_code?.toLowerCase() === CURRENCY
      )
      rows.push({
        product_id: p.id,
        handle: p.handle ?? "",
        title: safeText(p.title),
        description: firstRow ? description : "",
        status: safeText(p.status),
        collection: firstRow ? collection : "",
        categories: firstRow ? categories : "",
        tags: firstRow ? tags : "",
        variant_id: v.id ?? "",
        variant_sku: safeText(v.sku),
        variant_title: safeText(v.title),
        image_url: firstRow ? thumbUrl ?? "" : "",
        current_price: price ? Number(price.amount) : null,
        thumbnail_buffer: firstRow ? thumb : null,
      })
      firstRow = false
    }
  }

  logger.info(`Generated ${rows.length} variant rows. Building workbook…`)

  const wb = new ExcelJS.Workbook()
  wb.creator = "Arredo Vita"
  wb.created = new Date()
  const ws = wb.addWorksheet("Prodotti", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  ws.columns = [
    { header: "Handle", key: "handle", width: 28 },
    { header: "Titolo", key: "title", width: 30 },
    { header: "Collezione", key: "collection", width: 18 },
    { header: "Categorie", key: "categories", width: 22 },
    { header: "Tag", key: "tags", width: 18 },
    { header: "SKU variante", key: "variant_sku", width: 18 },
    { header: "Variante", key: "variant_title", width: 18 },
    { header: "Foto", key: "thumb", width: 16 },
    { header: "URL foto", key: "image_url", width: 50 },
    {
      header: `Prezzo attuale (${CURRENCY.toUpperCase()})`,
      key: "current_price",
      width: 18,
    },
    {
      header: `Prezzo nuovo (${CURRENCY.toUpperCase()})`,
      key: "new_price",
      width: 18,
    },
    { header: "Note", key: "notes", width: 30 },
    { header: "Descrizione", key: "description", width: 60 },
    { header: "product_id", key: "product_id", width: 28 },
    { header: "variant_id", key: "variant_id", width: 28 },
    { header: "Stato", key: "status", width: 12 },
  ]

  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F1B16" },
  }
  headerRow.height = 22
  headerRow.alignment = { vertical: "middle", horizontal: "left" }

  const newPriceCol = ws.getColumn("new_price")
  newPriceCol.numFmt = '#,##0.00 "€"'
  ws.getColumn("current_price").numFmt = '#,##0.00 "€"'

  rows.forEach((r, idx) => {
    const row = ws.addRow({
      handle: r.handle,
      title: r.title,
      collection: r.collection,
      categories: r.categories,
      tags: r.tags,
      variant_sku: r.variant_sku,
      variant_title: r.variant_title,
      thumb: "",
      image_url: r.image_url,
      current_price: r.current_price,
      new_price: null,
      notes: "",
      description: r.description,
      product_id: r.product_id,
      variant_id: r.variant_id,
      status: r.status,
    })
    row.height = 78
    row.alignment = { vertical: "middle", wrapText: true }

    const newPriceCell = row.getCell("new_price")
    newPriceCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF3B0" },
    }
    newPriceCell.border = {
      top: { style: "thin", color: { argb: "FFE3C84B" } },
      left: { style: "thin", color: { argb: "FFE3C84B" } },
      bottom: { style: "thin", color: { argb: "FFE3C84B" } },
      right: { style: "thin", color: { argb: "FFE3C84B" } },
    }

    if (r.thumbnail_buffer) {
      const imageId = wb.addImage({
        buffer: r.thumbnail_buffer as any,
        extension: "png",
      })
      const colIdx = ws.getColumn("thumb").number! - 1
      const rowIdx = idx + 1
      ws.addImage(imageId, {
        tl: { col: colIdx + 0.1, row: rowIdx + 0.1 },
        ext: { width: THUMB_SIZE, height: THUMB_SIZE },
        editAs: "oneCell",
      })
    }
  })

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ws.columnCount },
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer())
  const stamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .replace(/\..+$/, "")
  const filename = `arredovita-prodotti-${stamp}.xlsx`

  let localPath: string | null = null
  if (KEEP_LOCAL_COPY) {
    fs.mkdirSync(LOCAL_OUTPUT_DIR, { recursive: true })
    localPath = path.join(LOCAL_OUTPUT_DIR, filename)
    fs.writeFileSync(localPath, buffer)
    logger.info(`Local copy: ${localPath}`)
  }

  if (UPLOAD_TO_STORAGE) {
    const fileService: any = container.resolve(Modules.FILE)
    const [uploaded] = await fileService.createFiles([
      {
        filename: `arredovita/exports/${filename}`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        content: buffer.toString("base64"),
        access: "private",
      },
    ])
    logger.info(`Uploaded to storage: ${uploaded.url}`)
    logger.info(`File id: ${uploaded.id}`)
  } else {
    logger.info(
      "EXPORT_UPLOAD=false — skipping upload to object storage."
    )
  }

  logger.info(
    `Done. ${products.length} products, ${rows.length} variant rows, ` +
      `${thumbCache.size} images fetched.`
  )
}
