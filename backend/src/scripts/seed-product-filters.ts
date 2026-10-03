/**
 * Filtrele de pornire ale magazinului, pe categorii, plus completarea lor pe
 * tot catalogul.
 *
 * Sursele (`sources`) sunt etichetele care apar cel mai des în fișele tehnice
 * (`metadata.specs`) ale fiecărei categorii — lista completă, cu numărul de
 * produse, e în pagina „Filtre" din admin (`GET /admin/product-filters/meta`).
 *
 * Idempotent: un filtru existent (după `key`) își păstrează ce a schimbat
 * operatorul în admin — eticheta, sursele, valorile. Scriptul doar adaugă ce
 * lipsește: filtre noi, legături noi cu categorii, valori canonice noi.
 *
 * Rulare:
 *   cd backend && yarn medusa exec ./src/scripts/seed-product-filters.ts
 *   DRY_RUN=1     — doar raportul, fără scriere
 *   NO_AUTOFILL=1 — fără completarea automată la final
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { PRODUCT_FILTER_MODULE } from "../modules/product-filter"
import type ProductFilterModuleService from "../modules/product-filter/service"
import { syncProductFilters } from "../lib/product-filters/autofill"
import { slugify } from "../lib/product-filters/normalize"
import { revalidateStorefront } from "../lib/storefront-revalidate"

const DRY_RUN = !!process.env.DRY_RUN
const NO_AUTOFILL = !!process.env.NO_AUTOFILL

type SeedValue = { value: string; hex?: string; aliases?: string[] }
type SeedAttribute = {
  key: string
  label: string
  type?: "select" | "number"
  display?: "chips" | "swatch"
  unit?: string
  is_global?: boolean
  is_multi?: boolean
  closed_values?: boolean
  extractor?: string
  sources?: string[]
  /** Handle-uri de categorie, în ordinea în care filtrul apare acolo. */
  categories?: string[]
  values?: SeedValue[]
}

const PHONES = "telefoane-mobile"
const TABLETS = "tablete"
const LAPTOPS = "laptop"
const WATCHES = "smartwatch-wearables"
const HEADPHONES = "casti"
const SPEAKERS = "boxe"
const CASES = "huse-telefoane"
const GLASS = "folii-de-protectie"
const PC = "desktop-pc-periferice"
const CONSOLES = "console-jocuri"

/**
 * Familii de culoare, nu nuanțe de marketing: clientul caută „negru", nu
 * „Titan Black" sau „Midnight". Alias-urile sunt cuvinte: orice culoare care le
 * conține intră în familie (vezi potrivirea pe familii din `autofill.ts`).
 */
const COLORS: SeedValue[] = [
  { value: "Negru", hex: "#1c1c1e", aliases: ["black", "neagra", "negru", "midnight", "obsidian", "onyx", "jet black", "jetblack", "carbon", "phantom black"] },
  { value: "Alb", hex: "#f4f4f2", aliases: ["white", "alba", "alb", "starlight", "cream", "ivory", "porcelain"] },
  { value: "Argintiu", hex: "#d9dada", aliases: ["silver", "argint", "argintie", "argintiu"] },
  { value: "Gri", hex: "#8e9196", aliases: ["gray", "grey", "gri", "graphite", "space grey", "space gray", "titan gray", "titanium gray"] },
  { value: "Titan natural", hex: "#b7ada0", aliases: ["natural titanium", "titan natural", "titanium", "titan"] },
  { value: "Albastru", hex: "#3b5b8c", aliases: ["blue", "albastra", "albastru", "navy", "ultramarine", "teal", "midnight blue", "deep blue", "sky blue", "ice blue", "icyblue", "skyblue", "mist blue"] },
  { value: "Verde", hex: "#5b8c6e", aliases: ["green", "verde", "mint", "sage", "olive"] },
  { value: "Roșu", hex: "#b23b3b", aliases: ["red", "rosu", "rosie", "product red"] },
  { value: "Roz", hex: "#f3c5cf", aliases: ["pink", "roz", "rose"] },
  { value: "Mov", hex: "#8e76c0", aliases: ["purple", "violet", "lavender", "lilac", "mov", "lila"] },
  { value: "Auriu", hex: "#e3cf9c", aliases: ["gold", "aurie", "auriu", "champagne"] },
  { value: "Galben", hex: "#e8cf6a", aliases: ["yellow", "galben", "galbena"] },
  { value: "Portocaliu", hex: "#e07b3c", aliases: ["orange", "portocaliu", "portocalie", "papaya"] },
  { value: "Bej", hex: "#d8ccb8", aliases: ["beige", "bej", "sand", "desert"] },
  { value: "Maro", hex: "#7a5a43", aliases: ["brown", "maro"] },
  { value: "Multicolor", hex: "#c9b8e8", aliases: ["multicolor", "multicolour", "rainbow"] },
  { value: "Transparent", hex: "#e8eef2", aliases: ["transparent", "transparenta", "clear"] },
]

const ATTRIBUTES: SeedAttribute[] = [
  {
    key: "brand",
    label: "Marcă",
    is_global: true,
    extractor: "brand",
    sources: ["Brand", "Marca", "Producator"],
  },
  {
    key: "model-compatibil",
    label: "Compatibil cu",
    is_multi: true,
    extractor: "compatible_model",
    sources: ["Compatibilitate", "Compatibil cu", "Model compatibil"],
    categories: [CASES, GLASS],
  },
  {
    key: "storage",
    label: "Stocare",
    extractor: "title_storage",
    sources: ["Memorie interna", "Capacitate stocare", "Stocare", "Capacitate SSD", "Capacitate HDD"],
    categories: [PHONES, TABLETS, LAPTOPS, CONSOLES],
  },
  {
    key: "ram",
    label: "Memorie RAM",
    extractor: "title_ram",
    sources: ["Memorie RAM", "RAM", "Capacitate memorie"],
    categories: [PHONES, TABLETS, LAPTOPS],
  },
  {
    key: "retea",
    label: "Rețea",
    extractor: "network_5g",
    categories: [PHONES, TABLETS],
    values: [{ value: "5G" }],
  },
  {
    key: "diagonala",
    label: "Diagonală ecran",
    type: "number",
    unit: "inch",
    extractor: "screen_inch",
    sources: ["Dimensiune ecran", "Diagonala display", "Diagonala", "Diagonala ecran"],
    categories: [PHONES, TABLETS, LAPTOPS],
  },
  {
    key: "procesor",
    label: "Procesor",
    extractor: "cpu_family",
    categories: [PHONES, TABLETS, LAPTOPS],
  },
  {
    key: "baterie",
    label: "Capacitate baterie",
    type: "number",
    unit: "mAh",
    sources: ["Capacitate baterie", "Baterie"],
    categories: [PHONES, TABLETS],
  },
  {
    key: "camera",
    label: "Cameră principală",
    type: "number",
    unit: "MP",
    sources: ["Rezolutie camera principala", "Camera principala"],
    categories: [PHONES],
  },
  {
    key: "sim",
    label: "Tip SIM",
    sources: ["Tip SIM"],
    categories: [PHONES],
  },
  {
    key: "os",
    label: "Sistem de operare",
    sources: ["Sistem de operare", "Sistem de operare compatibil"],
    categories: [PHONES, TABLETS, WATCHES, LAPTOPS],
  },
  {
    key: "conectivitate",
    label: "Conexiune date",
    closed_values: true,
    extractor: "cellular",
    categories: [TABLETS],
    values: [
      { value: "Wi-Fi + Cellular", aliases: ["cu sim", "cellular"] },
      { value: "Doar Wi-Fi", aliases: ["fara sim", "wifi"] },
    ],
  },
  {
    key: "an",
    label: "An apariție",
    sources: ["An aparitie", "An lansare"],
    categories: [PHONES],
  },
  {
    key: "tip-casti",
    label: "Tip căști",
    sources: ["Tip"],
    categories: [HEADPHONES],
    values: [
      { value: "In-ear", aliases: ["In ear", "Intraauricular"] },
      { value: "Over-ear", aliases: ["Over the ear", "Over-Ear", "Circumaural"] },
      { value: "On-ear", aliases: ["On the ear", "Supraauricular"] },
      { value: "Behind-the-neck", aliases: ["Over the neck", "Behind the neck"] },
    ],
  },
  {
    key: "true-wireless",
    label: "True Wireless",
    sources: ["True Wireless"],
    categories: [HEADPHONES],
  },
  {
    key: "autonomie",
    label: "Autonomie",
    type: "number",
    unit: "h",
    sources: ["Autonomie", "Autonomie baterie", "Durata de functionare"],
    categories: [HEADPHONES, SPEAKERS, WATCHES],
  },
  {
    key: "bluetooth",
    label: "Versiune Bluetooth",
    sources: ["Versiune Bluetooth"],
    categories: [HEADPHONES, SPEAKERS],
  },
  {
    key: "color",
    label: "Culoare",
    display: "swatch",
    closed_values: true,
    extractor: "phone_color",
    sources: ["Culoare"],
    categories: [PHONES, TABLETS, LAPTOPS, WATCHES, HEADPHONES, SPEAKERS, CASES, CONSOLES, PC],
    values: COLORS,
  },
]

export default async function seedProductFilters({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const service: ProductFilterModuleService = container.resolve(PRODUCT_FILTER_MODULE)

  const categories: { id: string; handle: string }[] = await knex("product_category")
    .select("id", "handle")
    .whereNull("deleted_at")
  const categoryId = new Map(categories.map((c) => [c.handle, c.id]))

  let attrsCreated = 0
  let linksCreated = 0
  let valuesCreated = 0

  for (const [i, def] of ATTRIBUTES.entries()) {
    let attr = await knex("filter_attribute").where({ key: def.key }).whereNull("deleted_at").first()

    if (!attr) {
      attrsCreated++
      logger.info(`+ filtru „${def.label}" (${def.key})`)
      if (DRY_RUN) continue
      attr = await service.createFilterAttributes({
        key: def.key,
        label: def.label,
        type: def.type ?? "select",
        display: def.display ?? "chips",
        unit: def.unit ?? null,
        is_global: def.is_global ?? false,
        is_multi: def.is_multi ?? false,
        closed_values: def.closed_values ?? false,
        extractor: def.extractor ?? null,
        sources: def.sources ?? [],
        rank: i * 10,
      } as any)
    }

    // Categoriile: poziția filtrului e ordinea lui în lista ATTRIBUTES.
    for (const handle of def.categories ?? []) {
      const cid = categoryId.get(handle)
      if (!cid) {
        logger.warn(`  categoria „${handle}" nu există — sar peste ea`)
        continue
      }
      const exists = await knex("filter_attribute_category")
        .where({ attribute_id: attr.id, category_id: cid })
        .whereNull("deleted_at")
        .first()
      if (exists) continue
      linksCreated++
      if (!DRY_RUN) {
        await service.createFilterAttributeCategories({
          attribute_id: attr.id,
          category_id: cid,
          rank: i * 10,
        } as any)
      }
    }

    for (const [j, v] of (def.values ?? []).entries()) {
      const slug = slugify(v.value)
      const exists = await knex("filter_value")
        .where({ attribute_id: attr.id, slug })
        .whereNull("deleted_at")
        .first()
      if (exists) continue
      valuesCreated++
      if (!DRY_RUN) {
        await service.createFilterValues({
          attribute_id: attr.id,
          value: v.value,
          slug,
          hex: v.hex ?? null,
          aliases: v.aliases ?? [],
          rank: j + 1,
        } as any)
      }
    }
  }

  logger.info(
    `${DRY_RUN ? "[DRY_RUN] " : ""}Filtre noi: ${attrsCreated}, legături cu categorii: ${linksCreated}, valori canonice: ${valuesCreated}.`
  )

  if (DRY_RUN || NO_AUTOFILL) return

  const report = await syncProductFilters(container)
  logger.info(
    `Completare automată: ${report.products} produse, ${report.rowsCreated} valori scrise, ` +
      `${report.rowsDeleted} scoase, ${report.valuesCreated} valori canonice noi.`
  )
  await revalidateStorefront(logger, "product-filters.seed", ["products"])
}
