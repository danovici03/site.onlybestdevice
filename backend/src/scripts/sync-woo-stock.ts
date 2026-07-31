/**
 * Sincronizează stocul WooCommerce → Medusa. UNEALTĂ DE MIGRARE, nu de rutină.
 *
 * ATENȚIE: sursa de adevăr pentru stoc este gestiunea Laravel, care împinge
 * cantitățile prin `POST /admin/erp/stock` (vezi src/lib/erp/README.md). Scriptul
 * ăsta e bootstrap-ul dinaintea ei: a pornit `manage_inventory` pe catalogul
 * migrat din WooCommerce și a adus cantitățile inițiale. Nu-l rula periodic —
 * ar suprascrie cifrele gestiunii, și cu o convenție diferită: ERP-ul scrie
 * `cantitate + reserved_quantity` (ca rezervările comenzilor neonorate să nu se
 * scadă de două ori), pe când aici scriem cantitatea plată din WooCommerce.
 * De folosit doar cât timp WooCommerce mai ține evidența unor produse.
 *
 * Citește snapshot-ul produs de `migration/wc-stock-pull.mjs`
 * (migration/data/wc-stock-<data>.json — implicit cel mai recent) și aliniază
 * disponibilitatea din Medusa cu cea din WooCommerce. Atinge DOAR inventarul:
 * pozele (deja pe object storage), prețurile, descrierile și categoriile rămân
 * neschimbate.
 *
 * Corespondența WC ↔ Medusa se face pe slug = handle, cu fallback pe SKU și,
 * pentru produsele WC fără slug, pe numele „slugificat" (exact cum a generat
 * handle-urile `import-woocommerce.ts`).
 *
 * Regulile de mapare, per produs:
 *   - WC cu gestiune de stoc (manage_stock=true)
 *       → manage_inventory=true, cantitate = stock_quantity (0 dacă e outofstock)
 *   - WC fără gestiune, dar „instock"
 *       → manage_inventory=false (mereu disponibil, ca până acum)
 *   - WC fără gestiune și „outofstock"
 *       → manage_inventory=true, cantitate 0 → storefront-ul arată „Stoc epuizat"
 *   - „onbackorder" în WC → manage_inventory=true, cantitate 0, allow_backorder=true
 *
 * Produsele din Medusa care nu există în snapshot (garanție extinsă, produse
 * create direct în Admin) sunt lăsate în pace.
 *
 * Produsele șterse din WooCommerce (existente în export-ul de referință, dar
 * absente din snapshot) sunt raportate; cu UNPUBLISH_MISSING=1 sunt trecute pe
 * `draft` în Medusa, ca să dispară din magazin fără să se piardă datele.
 *
 * Rulare (implicit DRY RUN — nu scrie nimic):
 *   yarn medusa exec ./src/scripts/sync-woo-stock.ts
 * Aplicare:
 *   APPLY=1 yarn medusa exec ./src/scripts/sync-woo-stock.ts
 * Opțional:
 *   WC_STOCK=/cale/wc-stock-2026-07-31.json
 *   WC_BASELINE=/cale/wc-export-2026-06-03.json   (implicit wc-export.json)
 *   UNPUBLISH_MISSING=1                            (produsele șterse din WC → draft)
 *   SYNC_PRICES=1                                  (aliniază și prețul RON după WC)
 */
import fs from "node:fs"
import path from "node:path"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"

const APPLY = !!process.env.APPLY
const UNPUBLISH_MISSING = !!process.env.UNPUBLISH_MISSING
const SYNC_PRICES = !!process.env.SYNC_PRICES
const CURRENCY = (process.env.SYNC_CURRENCY || "ron").toLowerCase()
/** Sub 0,5 lei diferența e rotunjire, nu schimbare de preț. */
const PRICE_EPSILON = 0.5
const DATA_DIR = path.join(process.cwd(), "../migration/data")

/** Identic cu slugify-ul din import-woocommerce.ts (handle-uri pentru produse fără slug). */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}

type WcStockProduct = {
  id: number
  slug: string
  sku: string
  name: string
  status: string
  price: string
  regular_price: string
  manage_stock: boolean
  stock_status: string
  stock_quantity: number | null
}

const wcPrice = (p: WcStockProduct): number | null => {
  const n = Number(String(p.price || p.regular_price || "").replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Cel mai recent wc-stock-*.json, dacă nu e dat explicit prin WC_STOCK. */
function resolveSnapshot(): string {
  if (process.env.WC_STOCK) return path.resolve(process.cwd(), process.env.WC_STOCK)
  const files = fs.existsSync(DATA_DIR)
    ? fs.readdirSync(DATA_DIR).filter((f) => /^wc-stock-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
    : []
  if (!files.length) {
    throw new Error(
      `Nu găsesc niciun snapshot în ${DATA_DIR}. Rulează întâi: node migration/wc-stock-pull.mjs`
    )
  }
  return path.join(DATA_DIR, files[files.length - 1])
}

type Target = { manage_inventory: boolean; quantity: number; allow_backorder: boolean }

function targetFor(p: WcStockProduct): Target {
  if (p.stock_status === "onbackorder") {
    return { manage_inventory: true, quantity: 0, allow_backorder: true }
  }
  if (p.stock_status === "outofstock") {
    return { manage_inventory: true, quantity: 0, allow_backorder: false }
  }
  // instock
  if (p.manage_stock) {
    return {
      manage_inventory: true,
      quantity: Math.max(0, p.stock_quantity ?? 0),
      allow_backorder: false,
    }
  }
  return { manage_inventory: false, quantity: 0, allow_backorder: false }
}

export default async function syncWooStock({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const snapshotPath = resolveSnapshot()
  const snap = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as {
    pulledAt?: string
    products: WcStockProduct[]
  }
  logger.info(
    `Snapshot: ${path.basename(snapshotPath)} (${snap.products.length} produse, tras ${
      snap.pulledAt?.slice(0, 16) ?? "?"
    }). APPLY=${APPLY}`
  )

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  if (!stockLocations?.length) {
    logger.error("Nicio stock location. Creează una întâi (seed).")
    return
  }
  const location = stockLocations[0]

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "title",
      "status",
      "variants.id",
      "variants.sku",
      "variants.manage_inventory",
      "variants.allow_backorder",
      "variants.inventory_items.inventory.id",
      "variants.inventory_items.inventory.location_levels.id",
      "variants.inventory_items.inventory.location_levels.location_id",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
      "variants.inventory_items.inventory.location_levels.reserved_quantity",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
    pagination: { take: 5000 },
  } as any)

  const byHandle = new Map<string, any>()
  const bySku = new Map<string, any>()
  for (const p of products as any[]) {
    byHandle.set(p.handle, p)
    for (const v of p.variants ?? []) if (v.sku) bySku.set(v.sku, p)
  }

  type Plan = {
    handle: string
    name: string
    variant_id: string
    sku: string | null
    inventory_item_id: string | null
    level_id: string | null
    current_qty: number | null
    reserved: number
    cur_manage: boolean
    cur_backorder: boolean
    target: Target
  }

  const plans: Plan[] = []
  const unmatched: WcStockProduct[] = []
  const priceChanges: Array<{ variant_id: string; handle: string; from: number | null; to: number }> = []
  let multiVariant = 0

  const matchedHandles = new Set<string>()

  // WooCommerce are listări duplicate (același produs, una fără slug). Ținem o
  // singură potrivire per produs Medusa, pe cea mai sigură: slug > SKU > nume.
  const best = new Map<string, { prod: any; wp: WcStockProduct; rank: number }>()
  let collisions = 0

  for (const wp of snap.products) {
    let prod: any
    let rank = 0
    if (wp.slug && byHandle.has(wp.slug)) {
      prod = byHandle.get(wp.slug)
      rank = 3
    } else if (wp.sku && bySku.has(wp.sku)) {
      prod = bySku.get(wp.sku)
      rank = 2
    } else {
      const generated = slugify(wp.name || "")
      if (generated && byHandle.has(generated)) {
        prod = byHandle.get(generated)
        rank = 1
      }
    }
    if (!prod) {
      unmatched.push(wp)
      continue
    }
    matchedHandles.add(prod.handle)
    const current = best.get(prod.id)
    if (current) {
      collisions++
      if (rank <= current.rank) continue
    }
    best.set(prod.id, { prod, wp, rank })
  }
  if (collisions) {
    logger.warn(
      `${collisions} listări WooCommerce duplicate (același produs Medusa) — păstrez potrivirea pe slug.`
    )
  }

  for (const { prod, wp } of best.values()) {
    const variants = prod.variants ?? []
    if (variants.length > 1) multiVariant++
    const target = targetFor(wp)
    for (const v of variants) {
      const inv = v.inventory_items?.[0]?.inventory
      const level = inv?.location_levels?.find((l: any) => l.location_id === location.id)
      plans.push({
        handle: prod.handle,
        name: wp.name,
        variant_id: v.id,
        sku: v.sku ?? null,
        inventory_item_id: inv?.id ?? null,
        level_id: level?.id ?? null,
        current_qty: level?.stocked_quantity ?? null,
        reserved: level?.reserved_quantity ?? 0,
        cur_manage: !!v.manage_inventory,
        cur_backorder: !!v.allow_backorder,
        target,
      })

      if (SYNC_PRICES) {
        const wanted = wcPrice(wp)
        const current = (v.prices ?? []).find(
          (pr: any) => pr.currency_code?.toLowerCase() === CURRENCY
        )?.amount
        const cur = current == null ? null : Number(current)
        if (wanted != null && (cur == null || Math.abs(cur - wanted) > PRICE_EPSILON)) {
          priceChanges.push({ variant_id: v.id, handle: prod.handle, from: cur, to: wanted })
        }
      }
    }
  }

  // Ce se schimbă efectiv.
  const changed = plans.filter(
    (p) =>
      p.cur_manage !== p.target.manage_inventory ||
      p.cur_backorder !== p.target.allow_backorder ||
      (p.target.manage_inventory && p.current_qty !== p.target.quantity)
  )
  const goingOut = changed.filter((p) => p.target.manage_inventory && p.target.quantity === 0 && !p.target.allow_backorder)
  const stocked = plans.filter((p) => p.target.manage_inventory && p.target.quantity > 0)
  const alwaysOn = plans.filter((p) => !p.target.manage_inventory)

  logger.info(
    `Potrivite ${plans.length} variante (${snap.products.length - unmatched.length}/${snap.products.length} produse WC). ` +
      `Nepotrivite: ${unmatched.length}. Produse cu >1 variantă: ${multiVariant}.`
  )
  logger.info(
    `Țintă: ${stocked.length} cu stoc numeric, ${goingOut.length} „stoc epuizat", ` +
      `${alwaysOn.length} mereu disponibile (WC fără gestiune de stoc).`
  )
  logger.info(`De modificat: ${changed.length} variante.`)
  if (SYNC_PRICES) {
    logger.info(`Prețuri de aliniat după WooCommerce: ${priceChanges.length}.`)
    for (const c of priceChanges.slice(0, 40)) {
      logger.info(`  ${c.handle.slice(0, 55)}: ${c.from ?? "—"} → ${c.to} ${CURRENCY.toUpperCase()}`)
    }
    if (priceChanges.length > 40) logger.info(`  … și încă ${priceChanges.length - 40}.`)
  }

  if (unmatched.length) {
    logger.warn(`Produse WC fără corespondent în Medusa (${unmatched.length}):`)
    for (const u of unmatched.slice(0, 20)) logger.warn(`   ${u.slug || "(fără slug)"} — ${u.name.slice(0, 60)}`)
  }

  // Avertisment: stoc rezervat mai mare decât noua cantitate.
  const conflicting = changed.filter((p) => p.reserved > p.target.quantity && p.reserved > 0)
  if (conflicting.length) {
    logger.warn(`${conflicting.length} variante au rezervări peste noua cantitate — verifică manual.`)
  }

  // ── Produse care erau în WooCommerce la import, dar au dispărut între timp ──
  // (șterse / mutate la coș). Le identificăm față de export-ul de referință, ca
  // să nu atingem produsele create direct în Medusa (garanție extinsă etc.).
  const baselinePath = process.env.WC_BASELINE
    ? path.resolve(process.cwd(), process.env.WC_BASELINE)
    : path.join(DATA_DIR, "wc-export.json")
  const missing: Array<{ id: string; handle: string; title: string }> = []
  if (fs.existsSync(baselinePath)) {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")) as {
      products: Array<{ slug?: string; name?: string }>
    }
    const fromWoo = new Set(
      baseline.products.map((p) => (p.slug || slugify(p.name || "")).trim()).filter(Boolean)
    )
    for (const p of products as any[]) {
      if (p.status !== "published") continue
      if (!fromWoo.has(p.handle)) continue
      if (matchedHandles.has(p.handle)) continue
      missing.push({ id: p.id, handle: p.handle, title: p.title })
    }
    if (missing.length) {
      logger.warn(
        `${missing.length} produse publicate în Medusa nu mai există în WooCommerce ` +
          `(referință: ${path.basename(baselinePath)})` +
          (UNPUBLISH_MISSING ? " — le trec pe draft." : " — rulează cu UNPUBLISH_MISSING=1 ca să le treci pe draft.")
      )
      for (const m of missing.slice(0, 15)) logger.warn(`   ${m.handle.slice(0, 70)}`)
      if (missing.length > 15) logger.warn(`   … și încă ${missing.length - 15}.`)
    }
  } else {
    logger.warn(`Fără export de referință la ${baselinePath} — sar peste verificarea produselor șterse.`)
  }

  if (!APPLY) {
    for (const p of changed.slice(0, 60)) {
      logger.info(
        `  ${p.handle.slice(0, 50)} → manage ${p.cur_manage}→${p.target.manage_inventory}, ` +
          `qty ${p.current_qty ?? "—"}→${p.target.manage_inventory ? p.target.quantity : "—"}` +
          (p.target.allow_backorder ? ", backorder" : "")
      )
    }
    if (changed.length > 60) logger.info(`  … și încă ${changed.length - 60}.`)
    logger.info("DRY RUN — nimic scris. Rulează cu APPLY=1 ca să aplici.")
    return
  }

  // ── Faza 1: manage_inventory / allow_backorder ──
  const patches = changed
    .filter((p) => p.cur_manage !== p.target.manage_inventory || p.cur_backorder !== p.target.allow_backorder)
    .map((p) => ({
      id: p.variant_id,
      manage_inventory: p.target.manage_inventory,
      allow_backorder: p.target.allow_backorder,
    }))
  for (let i = 0; i < patches.length; i += 100) {
    const batch = patches.slice(i, i + 100)
    await updateProductVariantsWorkflow(container).run({ input: { product_variants: batch } })
    logger.info(`  variante actualizate ${Math.min(i + 100, patches.length)}/${patches.length}`)
  }

  // ── Faza 2: inventory_item + link, pentru variantele care intră în gestiune ──
  const needItemAll = changed.filter((p) => p.target.manage_inventory && !p.inventory_item_id)
  const skuFor = (p: Plan) => p.sku || `wc-${p.handle}`

  // Un articol de inventar poate exista deja, orfan (varianta a fost scoasă
  // cândva din gestiune, ceea ce șterge doar legătura). Îl refolosim, altfel
  // crearea pică pe SKU duplicat.
  const orphans = new Map<string, { id: string; level_id: string | null; qty: number | null }>()
  if (needItemAll.length) {
    const { data: existingItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "sku", "location_levels.id", "location_levels.location_id", "location_levels.stocked_quantity"],
      filters: { sku: needItemAll.map(skuFor) },
      pagination: { take: needItemAll.length + 100 },
    } as any)
    for (const it of (existingItems ?? []) as any[]) {
      if (!it.sku) continue
      const level = it.location_levels?.find((l: any) => l.location_id === location.id)
      orphans.set(it.sku, {
        id: it.id,
        level_id: level?.id ?? null,
        qty: level?.stocked_quantity ?? null,
      })
    }
    if (orphans.size) {
      logger.info(`${orphans.size} inventory_item existente (orfane) — le relegăm în loc să le recreez.`)
      for (const p of needItemAll) {
        const found = orphans.get(skuFor(p))
        if (!found) continue
        p.inventory_item_id = found.id
        p.level_id = found.level_id
        p.current_qty = found.qty
      }
      const relinks = needItemAll
        .filter((p) => orphans.has(skuFor(p)))
        .map((p) => ({
          [Modules.PRODUCT]: { variant_id: p.variant_id },
          [Modules.INVENTORY]: { inventory_item_id: p.inventory_item_id! },
        }))
      if (relinks.length) await link.create(relinks)
    }
  }

  const needItem = needItemAll.filter((p) => !p.inventory_item_id)
  if (needItem.length) {
    logger.info(`Creez ${needItem.length} inventory_item…`)
    for (let i = 0; i < needItem.length; i += 100) {
      const batch = needItem.slice(i, i + 100)
      const { result: created } = await createInventoryItemsWorkflow(container).run({
        input: {
          items: batch.map((p) => ({
            sku: skuFor(p),
            title: p.name.slice(0, 120),
            location_levels: [{ location_id: location.id, stocked_quantity: p.target.quantity }],
          })),
        },
      })
      const idBySku = new Map<string, string>()
      for (const it of created as any[]) if (it.sku) idBySku.set(it.sku, it.id)
      const links = batch
        .map((p) => {
          const itemId = idBySku.get(skuFor(p))
          if (!itemId) return null
          return {
            [Modules.PRODUCT]: { variant_id: p.variant_id },
            [Modules.INVENTORY]: { inventory_item_id: itemId },
          }
        })
        .filter((l): l is NonNullable<typeof l> => !!l)
      if (links.length) await link.create(links)
      logger.info(`  inventory_item ${Math.min(i + 100, needItem.length)}/${needItem.length}`)
    }
  }

  // ── Faza 3: niveluri pentru variantele care aveau deja inventory_item ──
  const withItem = changed.filter((p) => p.target.manage_inventory && p.inventory_item_id)
  const toCreate = withItem
    .filter((p) => !p.level_id)
    .map((p) => ({
      inventory_item_id: p.inventory_item_id!,
      location_id: location.id,
      stocked_quantity: p.target.quantity,
    }))
  const toUpdate = withItem
    .filter((p) => p.level_id && p.current_qty !== p.target.quantity)
    .map((p) => ({
      id: p.level_id!,
      inventory_item_id: p.inventory_item_id!,
      location_id: location.id,
      stocked_quantity: p.target.quantity,
    }))
  if (toCreate.length) {
    logger.info(`Creez ${toCreate.length} niveluri de stoc…`)
    for (let i = 0; i < toCreate.length; i += 200) {
      await createInventoryLevelsWorkflow(container).run({
        input: { inventory_levels: toCreate.slice(i, i + 200) },
      })
    }
  }
  if (toUpdate.length) {
    logger.info(`Actualizez ${toUpdate.length} niveluri de stoc…`)
    for (let i = 0; i < toUpdate.length; i += 200) {
      await updateInventoryLevelsWorkflow(container).run({
        input: { updates: toUpdate.slice(i, i + 200) },
      })
    }
  }

  // ── Faza 4: prețuri aliniate după WooCommerce ──
  if (SYNC_PRICES && priceChanges.length) {
    logger.info(`Aliniez ${priceChanges.length} prețuri…`)
    for (let i = 0; i < priceChanges.length; i += 50) {
      await updateProductVariantsWorkflow(container).run({
        input: {
          product_variants: priceChanges.slice(i, i + 50).map((c) => ({
            id: c.variant_id,
            prices: [{ amount: c.to, currency_code: CURRENCY }],
          })),
        },
      })
      logger.info(`  prețuri ${Math.min(i + 50, priceChanges.length)}/${priceChanges.length}`)
    }
  }

  // ── Faza 5: produsele șterse din WooCommerce → draft ──
  if (UNPUBLISH_MISSING && missing.length) {
    logger.info(`Trec ${missing.length} produse dispărute din WooCommerce pe draft…`)
    for (let i = 0; i < missing.length; i += 100) {
      await updateProductsWorkflow(container).run({
        input: {
          selector: { id: missing.slice(i, i + 100).map((m) => m.id) },
          update: { status: "draft" as any },
        },
      })
    }
  }

  logger.info(
    `✓ Sincronizare completă: ${changed.length} variante aliniate cu WooCommerce ` +
      `(${goingOut.length} marcate „stoc epuizat")` +
      (SYNC_PRICES && priceChanges.length ? `, ${priceChanges.length} prețuri aliniate` : "") +
      (UNPUBLISH_MISSING && missing.length ? `, ${missing.length} produse trecute pe draft` : "") +
      `. Revalidează cache-ul storefront-ului.`
  )
}
