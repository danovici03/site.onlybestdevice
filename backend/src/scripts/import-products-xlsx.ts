import fs from "node:fs"
import path from "node:path"
import ExcelJS from "exceljs"

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { upsertVariantPricesWorkflow } from "@medusajs/medusa/core-flows"

const CURRENCY = (process.env.IMPORT_CURRENCY || "eur").toLowerCase()
const DRY_RUN = process.env.DRY_RUN === "true"

type ParsedRow = {
  rowNumber: number
  variant_id: string | null
  variant_sku: string | null
  handle: string | null
  current_price: number | null
  new_price: number | null
}

const parseEuro = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const str = String(value)
    .replace(/[€\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
  const n = Number(str)
  return Number.isFinite(n) ? n : null
}

const findFile = (args: string[]): string => {
  const fromArg = args[0]
  const candidate =
    fromArg ?? process.env.IMPORT_XLSX_PATH ?? "/tmp/arredovita-prezzi.xlsx"
  const resolved = path.resolve(candidate)
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `XLSX file not found: ${resolved}\n` +
        "Usage: yarn medusa exec ./src/scripts/import-products-xlsx.ts <path-to-file.xlsx>\n" +
        "       or set IMPORT_XLSX_PATH=/path/to/file.xlsx"
    )
  }
  return resolved
}

const readRows = async (filePath: string): Promise<ParsedRow[]> => {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath)
  const ws = wb.getWorksheet("Prodotti") ?? wb.worksheets[0]
  if (!ws) throw new Error("No worksheet found")

  const headerRow = ws.getRow(1).values as (string | undefined)[]
  const headerIndex = (name: string): number => {
    const idx = headerRow.findIndex(
      (h) =>
        typeof h === "string" &&
        h.toLowerCase().startsWith(name.toLowerCase())
    )
    if (idx < 1) throw new Error(`Missing column: "${name}"`)
    return idx
  }

  const idxVariantId = headerIndex("variant_id")
  const idxSku = headerIndex("SKU variante")
  const idxHandle = headerIndex("Handle")
  const idxCurrent = headerIndex("Prezzo attuale")
  const idxNew = headerIndex("Prezzo nuovo")

  const out: ParsedRow[] = []
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const cell = (i: number) => {
      const v = row.getCell(i).value
      if (v && typeof v === "object" && "result" in (v as any)) {
        return (v as any).result
      }
      return v
    }
    out.push({
      rowNumber,
      variant_id: cell(idxVariantId) ? String(cell(idxVariantId)) : null,
      variant_sku: cell(idxSku) ? String(cell(idxSku)) : null,
      handle: cell(idxHandle) ? String(cell(idxHandle)) : null,
      current_price: parseEuro(cell(idxCurrent)),
      new_price: parseEuro(cell(idxNew)),
    })
  })
  return out
}

export default async function importProductsXlsx({
  container,
  args,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const filePath = findFile(args)
  logger.info(`Reading ${filePath}…`)
  const rows = await readRows(filePath)
  logger.info(`Parsed ${rows.length} data rows.`)

  const withNewPrice = rows.filter(
    (r) =>
      r.new_price !== null &&
      r.new_price > 0 &&
      (r.variant_id || r.variant_sku)
  )

  if (!withNewPrice.length) {
    logger.warn(
      "No rows with a positive 'Prezzo nuovo' value. Nothing to update."
    )
    return
  }
  logger.info(`${withNewPrice.length} rows with a new price.`)

  const skuList = withNewPrice
    .filter((r) => !r.variant_id && r.variant_sku)
    .map((r) => r.variant_sku!)

  let skuToVariant = new Map<string, { variant_id: string; product_id: string }>()
  if (skuList.length) {
    const { data: variantsBySku } = await query.graph({
      entity: "product_variant",
      fields: ["id", "sku", "product_id"],
      filters: { sku: skuList },
    })
    for (const v of variantsBySku as any[]) {
      if (v.sku) skuToVariant.set(v.sku, { variant_id: v.id, product_id: v.product_id })
    }
  }

  const variantIdsAll = withNewPrice
    .map((r) => r.variant_id)
    .filter((id): id is string => !!id)
  const skuMatched = Array.from(skuToVariant.values()).map((v) => v.variant_id)
  const allVariantIds = Array.from(
    new Set([...variantIdsAll, ...skuMatched])
  )

  let variantById = new Map<string, { variant_id: string; product_id: string }>()
  if (allVariantIds.length) {
    const { data: variantsById } = await query.graph({
      entity: "product_variant",
      fields: ["id", "product_id"],
      filters: { id: allVariantIds },
    })
    for (const v of variantsById as any[]) {
      variantById.set(v.id, { variant_id: v.id, product_id: v.product_id })
    }
  }

  const updates: {
    variant_id: string
    product_id: string
    prices: { amount: number; currency_code: string }[]
  }[] = []
  const skipped: { row: number; reason: string }[] = []

  for (const r of withNewPrice) {
    let resolved =
      r.variant_id && variantById.get(r.variant_id)
        ? variantById.get(r.variant_id)!
        : null
    if (!resolved && r.variant_sku && skuToVariant.has(r.variant_sku)) {
      resolved = skuToVariant.get(r.variant_sku)!
    }
    if (!resolved) {
      skipped.push({
        row: r.rowNumber,
        reason: `variant not found (id=${r.variant_id ?? "—"}, sku=${
          r.variant_sku ?? "—"
        })`,
      })
      continue
    }
    updates.push({
      variant_id: resolved.variant_id,
      product_id: resolved.product_id,
      prices: [
        {
          amount: r.new_price!,
          currency_code: CURRENCY,
        },
      ],
    })
  }

  logger.info(
    `Resolved ${updates.length} variants; skipped ${skipped.length}.`
  )
  if (skipped.length) {
    for (const s of skipped.slice(0, 10)) {
      logger.warn(`row ${s.row}: ${s.reason}`)
    }
    if (skipped.length > 10) {
      logger.warn(`…and ${skipped.length - 10} more.`)
    }
  }

  if (!updates.length) {
    logger.warn("Nothing to write.")
    return
  }

  if (DRY_RUN) {
    logger.info("DRY_RUN=true — not writing prices.")
    for (const u of updates.slice(0, 20)) {
      logger.info(
        `would set ${u.variant_id} → ${u.prices[0].amount} ${CURRENCY.toUpperCase()}`
      )
    }
    return
  }

  await upsertVariantPricesWorkflow(container).run({
    input: {
      variantPrices: updates,
      previousVariantIds: updates.map((u) => u.variant_id),
    },
  })
  logger.info(`Updated prices on ${updates.length} variants.`)
}
