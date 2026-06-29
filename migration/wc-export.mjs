#!/usr/bin/env node
/**
 * Export WooCommerce → JSON, pregătit pentru import în Medusa.
 *
 * Citește prin WooCommerce REST API v3 (read-only): categorii, produse și,
 * pentru produsele variabile, variațiile aferente. Scrie totul în
 * migration/data/wc-export.json.
 *
 * Necesită (în mediu sau migration/.env):
 *   WC_URL     = https://onlybestdevice.ro      (fără slash final)
 *   WC_KEY     = ck_xxx   (consumer key, Read)
 *   WC_SECRET  = cs_xxx   (consumer secret)
 *
 * Generare chei: WordPress Admin → WooCommerce → Settings → Advanced →
 * REST API → Add key (Permissions: Read).
 *
 * Rulare:  node migration/wc-export.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Încarcă migration/.env dacă există (fără dependențe externe).
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
  console.error(
    "Lipsesc WC_URL / WC_KEY / WC_SECRET. Setează-le în migration/.env sau în mediu."
  )
  process.exit(1)
}

const auth = "Basic " + Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64")
const PER_PAGE = 100

async function wc(endpoint, params = {}) {
  const url = new URL(`${WC_URL}/wp-json/wc/v3/${endpoint}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url, { headers: { Authorization: auth } })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`WC ${endpoint} ${res.status}: ${body.slice(0, 300)}`)
  }
  const total = Number(res.headers.get("x-wp-totalpages") || "1")
  const data = await res.json()
  return { data, totalPages: total }
}

async function fetchAll(endpoint, params = {}) {
  const out = []
  let page = 1
  let totalPages = 1
  do {
    const { data, totalPages: tp } = await wc(endpoint, {
      ...params,
      per_page: PER_PAGE,
      page,
    })
    totalPages = tp
    out.push(...data)
    process.stdout.write(`\r  ${endpoint}: ${out.length} (pagina ${page}/${totalPages})   `)
    page++
  } while (page <= totalPages)
  process.stdout.write("\n")
  return out
}

async function main() {
  console.log(`Export din ${WC_URL} …`)

  console.log("• categorii")
  const categories = await fetchAll("products/categories", { hide_empty: false })

  console.log("• produse")
  const products = await fetchAll("products", { status: "any" })

  console.log("• variații (pentru produse variabile)")
  const variations = {}
  const variableProducts = products.filter((p) => p.type === "variable")
  let i = 0
  for (const p of variableProducts) {
    variations[p.id] = await fetchAll(`products/${p.id}/variations`)
    i++
    process.stdout.write(`\r  variații: ${i}/${variableProducts.length} produse   `)
  }
  process.stdout.write("\n")

  const dataDir = path.join(__dirname, "data")
  fs.mkdirSync(dataDir, { recursive: true })
  const outPath = path.join(dataDir, "wc-export.json")
  fs.writeFileSync(
    outPath,
    JSON.stringify({ exportedFrom: WC_URL, categories, products, variations }, null, 2)
  )

  console.log(
    `\n✓ Export complet: ${products.length} produse, ${categories.length} categorii, ` +
      `${variableProducts.length} produse variabile.\n  → ${outPath}`
  )
}

main().catch((e) => {
  console.error("\nEroare export:", e.message)
  process.exit(1)
})
