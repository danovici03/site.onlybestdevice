/**
 * Extrage „specificațiile" filtrabile în metadata produselor, pentru filtrul
 * din magazin/categorii.
 *
 * Scrie în `product.metadata`:
 *   filter_brand      — marca (ex. "Apple", "Samsung") — pentru CÂT mai multe produse
 *   filter_storage    — stocarea (ex. "256GB", "1TB")  — DOAR telefoane (date curate)
 *   filter_ram        — memoria RAM (ex. "8GB")        — DOAR telefoane
 *   filter_color      — culoarea (ex. "Black")          — DOAR telefoane
 *   filter_color_hex  — hex pentru pastila de culoare   — DOAR telefoane
 *
 * De ce doar telefoanele pentru stocare/RAM/culoare: numele accesoriilor sunt
 * inconsistente și ar produce fațete-gunoi (ex. „layout germania", „22TB").
 * Telefoanele au denumiri regulate (vezi parserul din `link-phone-variants`).
 * Marca e suficient de curată ca să o punem pe tot catalogul.
 *
 * Nedistructiv, idempotent. Rulare:
 *   cd backend && yarn medusa exec ./src/scripts/extract-product-filters.ts
 *   Opțional: DRY_RUN=1
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { parsePhone } from "./link-phone-variants"

const DRY_RUN = !!process.env.DRY_RUN

// [cuvânt-cheie, Etichetă] — branduri „părinte"/sub-branduri întâi (iPhone→Apple,
// Galaxy→Samsung, Redmi/Poco→Xiaomi, Pixel→Google), apoi branduri de accesorii.
const BRANDS: [string, string][] = [
  ["apple", "Apple"], ["iphone", "Apple"], ["ipad", "Apple"], ["macbook", "Apple"], ["airpods", "Apple"],
  ["samsung", "Samsung"], ["galaxy", "Samsung"],
  ["xiaomi", "Xiaomi"], ["redmi", "Xiaomi"], ["poco", "Xiaomi"],
  ["google", "Google"], ["pixel", "Google"],
  ["motorola", "Motorola"], ["huawei", "Huawei"], ["honor", "Honor"],
  ["oneplus", "OnePlus"], ["nothing", "Nothing"], ["oppo", "OPPO"], ["vivo", "vivo"],
  ["realme", "realme"], ["nokia", "Nokia"], ["sony", "Sony"], ["blackview", "Blackview"],
  ["oukitel", "Oukitel"], ["ulefone", "Ulefone"], ["doogee", "Doogee"], ["infinix", "Infinix"],
  ["tecno", "Tecno"], ["asus", "Asus"], ["lenovo", "Lenovo"], ["tcl", "TCL"], ["zte", "ZTE"],
  ["uleway", "Uleway"],
  // accesorii
  ["benks", "Benks"], ["liavec", "Liavec"], ["spigen", "Spigen"], ["nillkin", "Nillkin"],
  ["ringke", "Ringke"], ["dux ducis", "Dux Ducis"], ["pitaka", "Pitaka"], ["baseus", "Baseus"],
  ["anker", "Anker"], ["ugreen", "Ugreen"], ["hoco", "Hoco"], ["joyroom", "Joyroom"],
  ["esr", "ESR"], ["rock", "Rock"],
]

function brandFromTitle(title: string): string | null {
  const t = " " + title.toLowerCase() + " "
  for (const [kw, label] of BRANDS) {
    const re = new RegExp("\\b" + kw.replace(/ /g, "\\s+") + "\\b", "i")
    if (re.test(t)) return label
  }
  return null
}

type DbProduct = {
  id: string
  handle: string
  title: string
  metadata: Record<string, unknown> | null
}

const FILTER_KEYS = [
  "filter_brand",
  "filter_storage",
  "filter_ram",
  "filter_color",
  "filter_color_hex",
]

export default async function extractProductFilters({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: all } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "metadata"],
    pagination: { take: 5000, skip: 0 },
  } as any)

  let updated = 0
  let unchanged = 0
  const facet = {
    brand: new Map<string, number>(),
    storage: new Map<string, number>(),
    ram: new Map<string, number>(),
    color: new Map<string, number>(),
  }
  const bump = (m: Map<string, number>, k: string | null) => {
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }

  // RAM realist (≤ 32GB); peste = de fapt stocare prinsă greșit.
  const cleanRam = (ram: string | null | undefined): string | null => {
    if (!ram) return null
    const n = parseFloat(ram)
    return Number.isFinite(n) && n > 0 && n <= 32 ? ram : null
  }
  // Culoare validă: fără cifre (exclude „45W", „Unisoc UMS9230") și nu prea lungă
  // (exclude descrieri gen „ușor de utilizat pentru seniori").
  const cleanColor = (color: string | null | undefined): string | null =>
    color && !/\d/.test(color) && color.length <= 22 ? color : null

  for (const p of all as DbProduct[]) {
    const parsed = parsePhone(p.title || "")
    // Normalizează marca prin lista de cuvinte-cheie (evită „SAMSUNG" vs „Samsung");
    // cade pe brandul parserului doar dacă nu e în listă.
    const brand = brandFromTitle(p.title || "") ?? parsed?.brand ?? null
    const storage = parsed?.storage ?? null
    const ram = cleanRam(parsed?.ram)
    const color = cleanColor(parsed?.color)
    const colorHex = color ? parsed?.color_hex ?? null : null

    bump(facet.brand, brand)
    bump(facet.storage, storage)
    bump(facet.ram, ram)
    bump(facet.color, color)

    const next: Record<string, unknown> = { ...(p.metadata ?? {}) }
    const setOrDelete = (k: string, v: unknown) => {
      if (v === null || v === undefined || v === "") delete next[k]
      else next[k] = v
    }
    setOrDelete("filter_brand", brand)
    setOrDelete("filter_storage", storage)
    setOrDelete("filter_ram", ram)
    setOrDelete("filter_color", color)
    setOrDelete("filter_color_hex", colorHex)

    const prev = (p.metadata ?? {}) as Record<string, unknown>
    const changed = FILTER_KEYS.some(
      (k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k])
    )
    if (!changed) {
      unchanged++
      continue
    }
    if (DRY_RUN) {
      updated++
      continue
    }
    await updateProductsWorkflow(container).run({
      input: { selector: { id: p.id }, update: { metadata: next } },
    })
    updated++
  }

  const top = (m: Map<string, number>, n = 30) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `${k}(${v})`)
      .join("  ")

  logger.info(
    `${DRY_RUN ? "[DRY_RUN] " : ""}Actualizate: ${updated}, neschimbate: ${unchanged} (din ${all.length}).`
  )
  logger.info(`Mărci (${facet.brand.size}): ${top(facet.brand)}`)
  logger.info(`Stocări (${facet.storage.size}): ${top(facet.storage)}`)
  logger.info(`RAM (${facet.ram.size}): ${top(facet.ram)}`)
  logger.info(`Culori (${facet.color.size}): ${top(facet.color, 40)}`)
}
