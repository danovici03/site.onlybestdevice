/**
 * Curățenia arborelui de categorii după introducerea filtrelor:
 *
 *   1. Subcategoriile-marcă („Apple" sub Tablete, „Xiaomi" sub Telefoane) se
 *      desființează — marca e acum filtrul „Marcă". Produsele lor rămân în
 *      categoria-părinte, cu marca setată pe filtru, iar URL-ul vechi pleacă
 *      cu 308 spre `/categories/<părinte>?brand=<marcă>`.
 *   2. Dublurile goale din import („Smartatch si Wearables", „Incarcatoare &
 *      acccesorii", „Honor" de la rădăcină) se șterg.
 *   3. „Oferte" iese din arbore: ofertele sunt bifa „La ofertă" (tagul
 *      `oferta`), nu o categorie. Produsele ei primesc tagul, apoi se dezleagă
 *      de categorie — mai puțin cele care n-au altă categorie, care ar rămâne
 *      orfane; pentru ele categoria rămâne și apare în raport.
 *
 * NU se ating:
 *   - subcategoriile de tip („Casti", „Boxe", „Drona", „Suporturi auto") —
 *     spun ce e produsul, nu cine l-a făcut;
 *   - subcategoriile de model („iPhone 16", „iPhone 15 Pro") — apar în raport
 *     „de discutat": locul lor e filtrul „Compatibil cu", dar mutarea cere o
 *     decizie separată. Dacă stau sub o marcă desființată, urcă un nivel.
 *
 * Marca pe filtru: dacă produsul are deja o valoare (din titlu, completarea
 * automată), rămâne a lui — un conflict cu marca categoriei apare doar în
 * raport. Dacă n-are, primește marca categoriei cu `source: "manual"`: titlul
 * n-o conține, deci completarea automată ar șterge un rând `auto` chiar la
 * următoarea salvare a produsului. Categoria era singura sursă a mărcii;
 * `manual` o păstrează.
 *
 * Scrie și harta redirecturilor, `scripts/data/brand-category-redirects.json`,
 * plus copia din storefront (`storefront/src/lib/data/`), când repo-ul e
 * întreg (local). Harta se scrie și la DRY_RUN: e planul, se comite înainte de
 * a rula APPLY pe producție.
 *
 * Rulare:
 *   cd backend && yarn medusa exec ./src/scripts/cleanup-brand-categories.ts   (doar raport)
 *   APPLY=1 yarn medusa exec ./src/scripts/cleanup-brand-categories.ts          (scrie)
 */
import fs from "fs"
import path from "path"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  batchLinkProductsToCategoryWorkflow,
  deleteProductCategoriesWorkflow,
  updateProductCategoriesWorkflow,
} from "@medusajs/medusa/core-flows"

import { PRODUCT_FILTER_MODULE } from "../modules/product-filter"
import type ProductFilterModuleService from "../modules/product-filter/service"
import { BRANDS } from "../lib/product-filters/brands"
import { syncProductFilters } from "../lib/product-filters/autofill"
import { fold, slugify } from "../lib/product-filters/normalize"
import { revalidateStorefront } from "../lib/storefront-revalidate"
import { applyTagToProducts } from "./lib/product-tag-migration"

const APPLY = !!process.env.APPLY

/** Tagul bifei „La ofertă" — aliniat cu `SALE_TAG` din `/store/catalog`. */
const SALE_TAG = "oferta"
const OFFERS_HANDLE = "oferte"

/** Cuvinte care însoțesc o marcă în numele categoriei fără să schimbe marca. */
const BRAND_NOISE = new Set(["phone", "telefoane", "mobile", "smartphone"])

/** Aceeași regulă ca `categorySlug` din storefront (segmentul de URL). */
const categorySlug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

const levenshtein = (a: string, b: string): number => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
  return d[a.length][b.length]
}

type Category = {
  id: string
  name: string
  handle: string
  parent_category_id: string | null
}

type Redirect = {
  /** Categoria în care se ajunge (handle, unic). */
  parentHandle: string | null
  /** Calea canonică a destinației, în slug-uri (`telefoane-mobile`). */
  parentPath: string | null
  /** Calea canonică veche (`tablete/apple`) — în storefront, cheie alternativă. */
  path: string
  /** Marca din `?brand=`; null la dublurile fără marcă. */
  brandSlug: string | null
}

export default async function cleanupBrandCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const service: ProductFilterModuleService = container.resolve(PRODUCT_FILTER_MODULE)

  const categories: Category[] = await knex("product_category")
    .select("id", "name", "handle", "parent_category_id")
    .whereNull("deleted_at")
  const byId = new Map(categories.map((c) => [c.id, c]))
  const byHandle = new Map(categories.map((c) => [c.handle, c]))

  const links: { product_id: string; product_category_id: string }[] = await knex(
    "product_category_product"
  ).select("product_id", "product_category_id")
  const productsOf = new Map<string, string[]>()
  const categoriesOf = new Map<string, Set<string>>()
  for (const l of links) {
    productsOf.set(l.product_category_id, [...(productsOf.get(l.product_category_id) ?? []), l.product_id])
    const set = categoriesOf.get(l.product_id) ?? new Set()
    set.add(l.product_category_id)
    categoriesOf.set(l.product_id, set)
  }
  const childrenOf = (id: string) => categories.filter((c) => c.parent_category_id === id)

  const pathOf = (c: Category): string => {
    const segs: string[] = []
    const seen = new Set<string>()
    let cur: Category | undefined = c
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      segs.unshift(categorySlug(cur.name))
      cur = cur.parent_category_id ? byId.get(cur.parent_category_id) : undefined
    }
    return segs.join("/")
  }

  /* ---------------- Mărcile cunoscute ---------------- */

  const brandAttr = await knex("filter_attribute").where({ key: "brand" }).whereNull("deleted_at").first()
  if (!brandAttr) {
    logger.error("Filtrul „brand” nu există — rulează întâi seed-product-filters.ts.")
    return
  }
  const brandValues: { id: string; value: string; slug: string; aliases: string[] }[] = await knex(
    "filter_value"
  )
    .select("id", "value", "slug", "aliases")
    .where({ attribute_id: brandAttr.id })
    .whereNull("deleted_at")

  // Nume folded → eticheta canonică a mărcii.
  const brandLabel = new Map<string, string>()
  for (const [kw, label] of BRANDS) brandLabel.set(fold(kw), label)
  for (const v of brandValues) {
    for (const k of [v.value, v.slug, ...(v.aliases ?? [])]) brandLabel.set(fold(k), v.value)
  }

  /** Marca din numele categoriei, doar dacă numele E marca (plus zgomot). */
  const brandOfName = (name: string): string | null => {
    const words = fold(name)
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !BRAND_NOISE.has(w))
    return words.length ? brandLabel.get(words.join(" ")) ?? null : null
  }

  /** Subcategorie de model: marcă/serie urmată de un număr („iPhone 16"). */
  const isModelName = (name: string) => /\b(iphone|ipad|galaxy|pixel|redmi|note)\s*\d/i.test(name)

  /* ---------------- Clasificarea ---------------- */

  const brandSubs: { cat: Category; brand: string }[] = []
  const emptyDuplicates: { cat: Category; target: Category | null; brand: string | null; reason: string }[] = []
  const modelSubs: Category[] = []

  const topLevel = categories.filter((c) => !c.parent_category_id)

  for (const c of categories) {
    const count = productsOf.get(c.id)?.length ?? 0
    if (c.handle === OFFERS_HANDLE) continue

    if (c.parent_category_id) {
      if (isModelName(c.name)) {
        modelSubs.push(c)
        continue
      }
      const brand = brandOfName(c.name)
      if (brand) brandSubs.push({ cat: c, brand })
      continue
    }

    // Rădăcini goale: marcă rătăcită la rădăcină sau dublură cu typo.
    if (count > 0 || childrenOf(c.id).length) continue
    const brand = brandOfName(c.name)
    if (brand) {
      emptyDuplicates.push({ cat: c, target: null, brand, reason: "marcă la rădăcină, fără produse" })
      continue
    }
    // Legăturile („si", „&") se scot: „Smartatch si Wearables" și
    // „Smartwatch & Wearables" diferă altfel prin mai mult decât typo-ul.
    const bare = (name: string) =>
      categorySlug(name)
        .split("-")
        .filter((w) => w && !["si", "and", "de"].includes(w))
        .join("-")
    const key = bare(c.name)
    const twin = topLevel
      .filter((o) => o.id !== c.id && (productsOf.get(o.id)?.length ?? 0) > 0)
      .map((o) => ({ o, d: levenshtein(key, bare(o.name)) }))
      .sort((a, b) => a.d - b.d)[0]
    if (twin && twin.d <= 3) {
      emptyDuplicates.push({ cat: c, target: twin.o, brand: null, reason: `dublură a „${twin.o.name}"` })
    }
  }

  // Cele mai adânci întâi: o marcă sub altă marcă se rezolvă înaintea părintelui.
  const depth = (c: Category) => pathOf(c).split("/").length
  brandSubs.sort((a, b) => depth(b.cat) - depth(a.cat))

  /* ---------------- Marca pe produse ---------------- */

  const brandRows: { product_id: string; value: string }[] = await knex("product_filter_value as pfv")
    .join("filter_value as v", "v.id", "pfv.value_id")
    .select("pfv.product_id", "v.value")
    .where("pfv.attribute_id", brandAttr.id)
    .whereNull("pfv.deleted_at")
  const brandOfProduct = new Map(brandRows.map((r) => [r.product_id, r.value]))

  /* ---------------- Raportul + planul ---------------- */

  const redirects: Record<string, Redirect> = {}
  const lines: string[] = []
  const say = (s = "") => lines.push(s)

  say(`=== Curățenie categorii ${APPLY ? "(APPLY)" : "(DRY_RUN — nimic nu se scrie în baza de date)"} ===`)
  say()
  say(`Subcategorii-marcă de desființat: ${brandSubs.length}`)

  const brandPlan: {
    cat: Category
    parent: Category
    brandValue: string
    brandSlug: string
    addToParent: string[]
    setBrand: string[]
    conflicts: string[]
    products: string[]
    children: Category[]
  }[] = []

  for (const { cat, brand } of brandSubs) {
    const parent = byId.get(cat.parent_category_id!)!
    const products = productsOf.get(cat.id) ?? []
    const addToParent = products.filter((p) => !categoriesOf.get(p)?.has(parent.id))
    const setBrand = products.filter((p) => !brandOfProduct.has(p))
    const conflicts = products.filter((p) => brandOfProduct.has(p) && brandOfProduct.get(p) !== brand)
    // Rezervăm marca încă din plan: un produs legat de două subcategorii-marcă
    // (ex. Telefoane › Samsung și Tablete › Samsung) primea altfel câte un rând
    // manual per categorie — dublură, sau două mărci pe un filtru cu o valoare.
    // Planurile următoare îl văd acum ca având marcă (și raportează conflictul).
    for (const p of setBrand) brandOfProduct.set(p, brand)
    const existing = brandValues.find((v) => v.value === brand)
    const brandSlug = existing?.slug ?? slugify(brand)
    const children = childrenOf(cat.id)

    brandPlan.push({ cat, parent, brandValue: brand, brandSlug, addToParent, setBrand, conflicts, products, children })
    redirects[cat.handle] = {
      parentHandle: parent.handle,
      parentPath: pathOf(parent),
      path: pathOf(cat),
      brandSlug,
    }

    say(
      `  - ${pathOf(cat).padEnd(40)} (${cat.handle}) ${String(products.length).padStart(3)} produse → ` +
        `/categories/${pathOf(parent)}?brand=${brandSlug}`
    )
    if (addToParent.length) say(`      + ${addToParent.length} produse legate și de „${parent.name}" (lipseau din părinte)`)
    if (setBrand.length) say(`      + ${setBrand.length} produse primesc marca „${brand}" pe filtru (manual — titlul n-o conține)`)
    if (conflicts.length) {
      say(`      ! ${conflicts.length} produse au altă marcă pe filtru decât categoria — rămân pe cea din filtru:`)
      for (const p of conflicts.slice(0, 5)) say(`          ${p}: filtru „${brandOfProduct.get(p)}" ≠ categorie „${brand}"`)
    }
    for (const ch of children) say(`      ↑ subcategoria „${ch.name}" (${ch.handle}) urcă sub „${parent.name}"`)
  }

  say()
  say(`Dubluri goale de șters: ${emptyDuplicates.length}`)
  for (const d of emptyDuplicates) {
    const brandSlug = d.brand ? brandValues.find((v) => v.value === d.brand)?.slug ?? slugify(d.brand) : null
    // O marcă rătăcită la rădăcină („Honor", honor-2) merge unde era sora ei
    // cu produse (Telefoane mobile › Honor); fără soră, pe tot magazinul.
    if (d.brand && !d.target) {
      d.target = brandSubs.find((b) => b.brand === d.brand)
        ? byId.get(brandSubs.find((b) => b.brand === d.brand)!.cat.parent_category_id!) ?? null
        : null
    }
    redirects[d.cat.handle] = {
      parentHandle: d.target?.handle ?? null,
      parentPath: d.target ? pathOf(d.target) : null,
      path: pathOf(d.cat),
      brandSlug,
    }
    const dest = d.target ? `/categories/${pathOf(d.target)}` : "/store"
    say(`  - ${d.cat.name.padEnd(28)} (${d.cat.handle}) — ${d.reason} → ${dest}${brandSlug ? `?brand=${brandSlug}` : ""}`)
  }

  /* ---------------- Oferte ---------------- */

  const offers = byHandle.get(OFFERS_HANDLE)
  const offerProducts = offers ? productsOf.get(offers.id) ?? [] : []
  const orphans = offerProducts.filter((p) => (categoriesOf.get(p)?.size ?? 0) <= 1)
  const detachable = offerProducts.filter((p) => !orphans.includes(p))
  const taggedRows: { product_id: string }[] = offerProducts.length
    ? await knex("product_tags as pt")
        .join("product_tag as t", "t.id", "pt.product_tag_id")
        .select("pt.product_id")
        .whereNull("t.deleted_at")
        .whereRaw("LOWER(t.value) = ?", [SALE_TAG])
        .whereIn("pt.product_id", offerProducts)
    : []
  const tagged = new Set(taggedRows.map((r) => r.product_id))
  const needTag = offerProducts.filter((p) => !tagged.has(p))
  const deleteOffers = !!offers && orphans.length === 0

  say()
  say(`Categoria „Oferte": ${offerProducts.length} produse`)
  if (offers) {
    say(`  + ${needTag.length} produse primesc tagul „${SALE_TAG}" (au deja: ${tagged.size})`)
    say(`  - ${detachable.length} produse se dezleagă de „Oferte" (au și altă categorie)`)
    if (orphans.length) {
      const titles: { id: string; title: string }[] = await knex("product")
        .select("id", "title")
        .whereIn("id", orphans)
      say(`  ! ${orphans.length} produse au DOAR categoria „Oferte" — rămân legate, categoria NU se șterge:`)
      for (const t of titles) say(`      ${t.id}  ${t.title}`)
      say(`    Pune-le într-o categorie reală din admin și rulează din nou scriptul.`)
    } else {
      say(`  → categoria se șterge (/categories/oferte redirectează deja la /oferte)`)
    }
  }

  say()
  say(`Subcategorii de model — de discutat (nu se ating; candidate pentru filtrul „Compatibil cu"):`)
  for (const m of modelSubs) {
    const parent = m.parent_category_id ? byId.get(m.parent_category_id) : undefined
    const movesUp = parent && brandSubs.some((b) => b.cat.id === parent.id)
    say(
      `  - ${pathOf(m).padEnd(45)} (${m.handle}) ${String(productsOf.get(m.id)?.length ?? 0).padStart(3)} produse` +
        (movesUp ? `  [părintele „${parent!.name}" dispare → urcă un nivel]` : "")
    )
  }

  /* ---------------- Harta de redirecturi ---------------- */

  const json = JSON.stringify(redirects, null, 2) + "\n"
  const backendOut = path.resolve(process.cwd(), "src/scripts/data/brand-category-redirects.json")
  fs.mkdirSync(path.dirname(backendOut), { recursive: true })
  fs.writeFileSync(backendOut, json)
  const storefrontDir = path.resolve(process.cwd(), "../storefront/src/lib/data")
  const outs = [backendOut]
  if (fs.existsSync(storefrontDir)) {
    const sfOut = path.join(storefrontDir, "brand-category-redirects.json")
    fs.writeFileSync(sfOut, json)
    outs.push(sfOut)
  }
  say()
  say(`Harta de redirecturi (${Object.keys(redirects).length}) scrisă în:`)
  for (const o of outs) say(`  ${path.relative(process.cwd(), o)}`)

  for (const l of lines) logger.info(l)

  if (!APPLY) {
    logger.info("DRY_RUN: nimic scris în baza de date. Rulează cu APPLY=1 ca să aplici.")
    return
  }

  /* ---------------- Aplicarea ---------------- */

  const touched = new Set<string>()

  for (const plan of brandPlan) {
    // 1. Marca pe filtru, înainte ca legătura cu categoria (singura ei sursă) să dispară.
    if (plan.setBrand.length) {
      let value = await knex("filter_value")
        .where({ attribute_id: brandAttr.id, value: plan.brandValue })
        .whereNull("deleted_at")
        .first()
      if (!value) {
        value = await service.createFilterValues({
          attribute_id: brandAttr.id,
          value: plan.brandValue,
          slug: plan.brandSlug,
        } as any)
        brandValues.push({ id: value.id, value: plan.brandValue, slug: plan.brandSlug, aliases: [] })
      }
      await service.createProductFilterValues(
        plan.setBrand.map((product_id) => ({
          product_id,
          attribute_id: brandAttr.id,
          value_id: value.id,
          source: "manual",
        })) as any
      )
      for (const p of plan.setBrand) brandOfProduct.set(p, plan.brandValue)
    }

    // 2. Produsele rămân în părinte.
    if (plan.addToParent.length) {
      await batchLinkProductsToCategoryWorkflow(container).run({
        input: { id: plan.parent.id, add: plan.addToParent, remove: [] },
      })
    }

    // 3. Subcategoriile de model urcă un nivel.
    for (const ch of plan.children) {
      await updateProductCategoriesWorkflow(container).run({
        input: { selector: { id: ch.id }, update: { parent_category_id: plan.parent.id } },
      })
    }

    // 4. Dezlegare și ștergere.
    if (plan.products.length) {
      await batchLinkProductsToCategoryWorkflow(container).run({
        input: { id: plan.cat.id, add: [], remove: plan.products },
      })
    }
    await deleteProductCategoriesWorkflow(container).run({ input: [plan.cat.id] })
    plan.products.forEach((p) => touched.add(p))
    logger.info(`✓ ${pathOf(plan.cat)} desființată (${plan.products.length} produse)`)
  }

  if (emptyDuplicates.length) {
    await deleteProductCategoriesWorkflow(container).run({ input: emptyDuplicates.map((d) => d.cat.id) })
    logger.info(`✓ ${emptyDuplicates.length} dubluri goale șterse`)
  }

  if (offers) {
    if (needTag.length) {
      const n = await applyTagToProducts(container, { productIds: needTag, tagValue: SALE_TAG, mode: "add" })
      logger.info(`✓ tagul „${SALE_TAG}" pus pe ${n} produse`)
    }
    if (detachable.length) {
      await batchLinkProductsToCategoryWorkflow(container).run({
        input: { id: offers.id, add: [], remove: detachable },
      })
      detachable.forEach((p) => touched.add(p))
      logger.info(`✓ ${detachable.length} produse dezlegate de „Oferte"`)
    }
    if (deleteOffers) {
      await deleteProductCategoriesWorkflow(container).run({ input: [offers.id] })
      logger.info(`✓ categoria „Oferte" ștearsă`)
    }
  }

  // Filtrele categoriilor părinte se aplică acum și produselor mutate.
  if (touched.size) {
    const r = await syncProductFilters(container, [...touched])
    logger.info(`✓ filtre recalculate: ${r.rowsCreated} valori scrise, ${r.rowsDeleted} scoase`)
  }
  await revalidateStorefront(logger, "cleanup-brand-categories", ["categories", "products"])
  logger.info("Gata.")
}
