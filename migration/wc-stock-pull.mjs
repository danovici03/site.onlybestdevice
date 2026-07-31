#!/usr/bin/env node
/**
 * Trage stocul curent din WooCommerce și îl compară cu snapshot-ul anterior.
 *
 * Spre deosebire de `wc-export.mjs` (export complet, pentru migrare), ăsta ia
 * doar ce ne trebuie pentru sincronizarea stocului: id, slug, sku, nume, preț,
 * stock_status, stock_quantity, manage_stock. Nu atinge pozele — catalogul
 * rulează deja pe object storage (Hetzner S3), nu pe WordPress.
 *
 * Scrie migration/data/wc-stock-<YYYY-MM-DD>.json și tipărește diff-ul față de
 * snapshot-ul precedent (implicit wc-export.json, adică ultima tragere).
 *
 * Rulare:
 *   node migration/wc-stock-pull.mjs
 *   BASELINE=migration/data/wc-stock-2026-07-31.json node migration/wc-stock-pull.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const envPath = path.join(__dirname, ".env")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

const WC_URL = (process.env.WC_URL || "").replace(/\/$/, "")
const WC_KEY = process.env.WC_KEY || ""
const WC_SECRET = process.env.WC_SECRET || ""
if (!WC_URL || !WC_KEY || !WC_SECRET) {
  console.error("Lipsesc WC_URL / WC_KEY / WC_SECRET (migration/.env).")
  process.exit(1)
}

const auth = "Basic " + Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64")
const PER_PAGE = 100
const DATA_DIR = path.join(__dirname, "data")
/** Referința pentru diff: ultimul snapshot de stoc, altfel export-ul de migrare. */
function defaultBaseline() {
  const snaps = fs.existsSync(DATA_DIR)
    ? fs
        .readdirSync(DATA_DIR)
        .filter((f) => /^wc-stock-\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .sort()
    : []
  return snaps.length
    ? path.join(DATA_DIR, snaps[snaps.length - 1])
    : path.join(DATA_DIR, "wc-export.json")
}

const BASELINE = process.env.BASELINE
  ? path.resolve(process.cwd(), process.env.BASELINE)
  : defaultBaseline()

async function wc(endpoint, params = {}) {
  const url = new URL(`${WC_URL}/wp-json/wc/v3/${endpoint}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url, { headers: { Authorization: auth } })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`WC ${endpoint} ${res.status}: ${body.slice(0, 300)}`)
  }
  return { data: await res.json(), totalPages: Number(res.headers.get("x-wp-totalpages") || "1") }
}

async function fetchAll(endpoint, params = {}) {
  const out = []
  let page = 1
  let totalPages = 1
  do {
    const { data, totalPages: tp } = await wc(endpoint, { ...params, per_page: PER_PAGE, page })
    totalPages = tp
    out.push(...data)
    process.stdout.write(`\r  ${endpoint}: ${out.length} (pagina ${page}/${totalPages})   `)
    page++
  } while (page <= totalPages)
  process.stdout.write("\n")
  return out
}

/** Câmpurile care ne interesează, normalizate. */
const slim = (p) => ({
  id: p.id,
  slug: p.slug,
  sku: p.sku || "",
  name: p.name,
  type: p.type,
  status: p.status,
  catalog_visibility: p.catalog_visibility,
  price: p.price || "",
  regular_price: p.regular_price || "",
  sale_price: p.sale_price || "",
  manage_stock: !!p.manage_stock,
  stock_status: p.stock_status,
  stock_quantity: p.stock_quantity ?? null,
  date_modified: p.date_modified,
})

const isInStock = (p) => p.stock_status === "instock"
/** Cantitatea „utilă": dacă WC nu gestionează stoc, in-stock ⇒ nedeterminat (null). */
const qtyOf = (p) => (p.manage_stock ? (p.stock_quantity ?? 0) : null)

async function main() {
  console.log(`Trag stocul din ${WC_URL} …`)
  const raw = await fetchAll("products", { status: "any" })
  const products = raw.map(slim)

  // Produsele variabile au stoc pe variație — le luăm separat (dacă există).
  const variations = {}
  const variable = raw.filter((p) => p.type === "variable")
  if (variable.length) {
    console.log(`• variații pentru ${variable.length} produse variabile`)
    for (const p of variable) {
      const vs = await fetchAll(`products/${p.id}/variations`)
      variations[p.id] = vs.map((v) => ({
        id: v.id,
        sku: v.sku || "",
        price: v.price || "",
        regular_price: v.regular_price || "",
        manage_stock: !!v.manage_stock,
        stock_status: v.stock_status,
        stock_quantity: v.stock_quantity ?? null,
      }))
    }
  }

  fs.mkdirSync(DATA_DIR, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const outPath = path.join(DATA_DIR, `wc-stock-${stamp}.json`)
  fs.writeFileSync(
    outPath,
    JSON.stringify({ pulledFrom: WC_URL, pulledAt: new Date().toISOString(), products, variations }, null, 2)
  )
  console.log(`\n✓ Snapshot: ${products.length} produse → ${outPath}`)

  const inStockNow = products.filter(isInStock)
  console.log(
    `  acum în WooCommerce: ${inStockNow.length} in stock, ` +
      `${products.length - inStockNow.length} out of stock, ` +
      `${products.filter((p) => p.manage_stock).length} cu gestiune de stoc`
  )

  if (!fs.existsSync(BASELINE)) {
    console.log(`\n(Fără baseline la ${BASELINE} — sar peste diff.)`)
    return
  }

  const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"))
  const baseProducts = (base.products || []).map(slim)
  const byId = new Map(baseProducts.map((p) => [p.id, p]))
  const bySlug = new Map(baseProducts.map((p) => [p.slug, p]))
  const nowIds = new Set(products.map((p) => p.id))

  const changed = []
  const added = []
  for (const p of products) {
    const b = byId.get(p.id) || bySlug.get(p.slug)
    if (!b) {
      added.push(p)
      continue
    }
    const diffs = []
    if (b.stock_status !== p.stock_status) diffs.push(`stoc ${b.stock_status} → ${p.stock_status}`)
    const bq = qtyOf(b)
    const nq = qtyOf(p)
    if (bq !== nq) diffs.push(`cantitate ${bq ?? "—"} → ${nq ?? "—"}`)
    if (b.price !== p.price) diffs.push(`preț ${b.price || "—"} → ${p.price || "—"}`)
    if (b.status !== p.status) diffs.push(`status ${b.status} → ${p.status}`)
    if (diffs.length) changed.push({ p, b, diffs })
  }
  const removed = baseProducts.filter((b) => !nowIds.has(b.id) && !products.some((p) => p.slug === b.slug))

  const label = path.basename(BASELINE)
  console.log(`\n── Diff față de ${label} ──`)
  console.log(`produse noi: ${added.length} | dispărute: ${removed.length} | modificate: ${changed.length}`)

  const stockFlips = changed.filter((c) => c.diffs.some((d) => d.startsWith("stoc ")))
  const qtyOnly = changed.filter((c) => !c.diffs.some((d) => d.startsWith("stoc ")) && c.diffs.some((d) => d.startsWith("cantitate")))
  const priceChanges = changed.filter((c) => c.diffs.some((d) => d.startsWith("preț")))

  const show = (title, rows) => {
    if (!rows.length) return
    console.log(`\n${title} (${rows.length}):`)
    for (const c of rows) console.log(`  • ${c.p.name.slice(0, 60)} [${c.p.slug.slice(0, 45)}] — ${c.diffs.join("; ")}`)
  }
  show("Intrate/ieșite din stoc", stockFlips)
  show("Doar cantitate schimbată", qtyOnly)
  show("Preț schimbat", priceChanges)
  if (added.length) {
    console.log(`\nProduse noi în WooCommerce (${added.length}):`)
    for (const p of added) console.log(`  + ${p.name.slice(0, 60)} [${p.slug}] — ${p.stock_status}, ${qtyOf(p) ?? "—"} buc, ${p.price} lei`)
  }
  if (removed.length) {
    console.log(`\nProduse care nu mai există în WooCommerce (${removed.length}):`)
    for (const p of removed) console.log(`  - ${p.name.slice(0, 60)} [${p.slug}]`)
  }

  const reportPath = path.join(DATA_DIR, `wc-stock-diff-${stamp}.json`)
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ baseline: label, pulledAt: new Date().toISOString(), added, removed, changed }, null, 2)
  )
  console.log(`\n→ Raport diff: ${reportPath}`)
}

main().catch((e) => {
  console.error("\nEroare:", e.message)
  process.exit(1)
})
