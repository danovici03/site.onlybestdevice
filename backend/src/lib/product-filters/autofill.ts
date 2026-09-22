import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { PRODUCT_FILTER_MODULE } from "../../modules/product-filter"
import type ProductFilterModuleService from "../../modules/product-filter/service"
import {
  attributesForCategories,
  loadFilterConfig,
  type FilterAttributeRow,
  type FilterValueRow,
} from "./config"
import { EXTRACTORS, foldSpecs, parseNumber } from "./extractors"
import { fold, matchKey, prettifyValue, slugify } from "./normalize"

/**
 * Completarea automată a filtrelor pe produse.
 *
 * Pentru fiecare produs se calculează filtrele categoriilor lui (plus cele
 * globale) și, pentru fiecare, valoarea din extractor sau din fișa tehnică.
 * Regulile:
 *
 *   - un filtru setat manual în admin nu se mai atinge;
 *   - rândurile `auto` se rescriu doar dacă s-a schimbat ceva, deci rularea
 *     repetată e ieftină și idempotentă;
 *   - un filtru care nu mai e al categoriei produsului (produs mutat) își
 *     pierde rândurile automate;
 *   - o valoare nouă din fișă devine valoare canonică nouă. Dublurile („Black"
 *     lângă „Negru") se unesc din admin, iar unirea adaugă alias-ul, ca
 *     valoarea să nu mai reapară.
 */

/** Valorile din fișă mai lungi de atât sunt fraze, nu valori de filtru. */
const MAX_VALUE_LEN = 40

type Existing = {
  id: string
  product_id: string
  attribute_id: string
  value_id: string | null
  value_number: number | null
  source: "auto" | "manual"
}

export type AutofillReport = {
  products: number
  rowsCreated: number
  rowsDeleted: number
  valuesCreated: number
}

/** Valorile brute ale unui atribut pentru un produs, înainte de potrivire. */
export function rawValuesFor(
  attr: FilterAttributeRow,
  title: string,
  specs: Record<string, string>
): string[] | number | null {
  if (attr.extractor && EXTRACTORS[attr.extractor]) {
    const out = EXTRACTORS[attr.extractor].run({ title, specs })
    if (out != null && (!Array.isArray(out) || out.length)) {
      if (attr.type === "number") {
        return typeof out === "number" ? out : parseNumber(out[0], attr.unit)
      }
      return Array.isArray(out) ? out : [String(out)]
    }
  }

  for (const label of attr.sources) {
    const raw = specs[fold(label).replace(/:$/, "")]
    if (!raw) continue
    if (attr.type === "number") {
      const n = parseNumber(raw, attr.unit)
      if (n != null) return n
      continue
    }
    const parts = (attr.is_multi ? raw.split(/[,;|]/) : [raw])
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s && s.length <= MAX_VALUE_LEN)
    if (parts.length) return parts
  }
  return null
}

export async function syncProductFilters(
  container: any,
  productIds?: string[],
  opts: { attributeIds?: string[] } = {}
): Promise<AutofillReport> {
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const service: ProductFilterModuleService = container.resolve(PRODUCT_FILTER_MODULE)

  const report: AutofillReport = { products: 0, rowsCreated: 0, rowsDeleted: 0, valuesCreated: 0 }
  const config = await loadFilterConfig(knex)
  if (!config.attributes.length) return report

  const onlyAttrs = opts.attributeIds?.length ? new Set(opts.attributeIds) : null

  const productQuery = knex("product").select("id", "title", "metadata").whereNull("deleted_at")
  if (productIds?.length) productQuery.whereIn("id", productIds)
  const products: { id: string; title: string; metadata: any }[] = await productQuery
  if (!products.length) return report
  const ids = products.map((p) => p.id)

  const [catRows, existingRows] = await Promise.all([
    knex("product_category_product").select("product_id", "product_category_id").whereIn("product_id", ids),
    knex("product_filter_value")
      .select("id", "product_id", "attribute_id", "value_id", "value_number", "source")
      .whereNull("deleted_at")
      .whereIn("product_id", ids),
  ])

  const catsOf = new Map<string, string[]>()
  for (const r of catRows) {
    const list = catsOf.get(r.product_id) ?? []
    list.push(r.product_category_id)
    catsOf.set(r.product_id, list)
  }
  const existingOf = new Map<string, Existing[]>()
  for (const r of existingRows as Existing[]) {
    const key = `${r.product_id}:${r.attribute_id}`
    const list = existingOf.get(key) ?? []
    list.push(r)
    existingOf.set(key, list)
  }

  // Indexul valorilor canonice, per atribut: cheie de potrivire → valoare.
  // Include alias-urile și slug-ul, ca „8GB", „8 GB" și „8-gb" să dea același rând.
  const valueIndex = new Map<string, Map<string, FilterValueRow>>()
  for (const a of config.attributes) {
    const idx = new Map<string, FilterValueRow>()
    for (const v of a.values) {
      for (const k of [v.value, v.slug, ...v.aliases]) {
        const mk = matchKey(k)
        if (mk && !idx.has(mk)) idx.set(mk, v)
      }
    }
    valueIndex.set(a.id, idx)
  }

  const resolveValue = async (attr: FilterAttributeRow, raw: string): Promise<string | null> => {
    const idx = valueIndex.get(attr.id)!
    const mk = matchKey(raw)
    if (!mk) return null
    const hit = idx.get(mk)
    if (hit) return hit.id
    if (attr.excluded_values.includes(mk)) return null

    if (attr.closed_values) {
      // Pe o listă închisă valorile sunt familii, iar alias-urile sunt cuvinte:
      // „Titan Black", „Midnight Black" și „neagră" intră toate la „Negru"
      // pentru că familia are alias-urile „black" și „neagra". Cel mai lung
      // alias câștigă, ca „space grey" să bată „grey".
      const hay = ` ${fold(raw).replace(/[^a-z0-9]+/g, " ")} `
      const candidates = attr.values
        .flatMap((v) => [v.value, ...v.aliases].map((a) => ({ v, a: fold(a).replace(/[^a-z0-9]+/g, " ").trim() })))
        .filter((c) => c.a)
        .sort((x, y) => y.a.length - x.a.length)
      const family = candidates.find((c) => hay.includes(` ${c.a} `))
      if (family) {
        idx.set(mk, family.v)
        return family.v.id
      }
      // Ce nu intră în nicio familie e aproape mereu o bucată de titlu
      // („Layout Germania", „Aluminum Enclosure"). Valorile noi se adaugă din admin.
      return null
    }

    const value = prettifyValue(raw)
    const slug = slugify(value)
    if (!slug) return null
    let created: { id: string }
    try {
      created = await service.createFilterValues({
        attribute_id: attr.id,
        value,
        slug,
        aliases: raw !== value ? [raw] : [],
      } as any)
    } catch (e) {
      // Două salvări simultane (un push din ERP emite zeci de
      // `product.updated` deodată) pot crea aceeași valoare nouă; a doua lovește
      // indexul unic (atribut, slug). Luăm rândul scris de cealaltă, în loc să
      // abandonăm filtrele produsului până la următoarea lui salvare.
      const existing = await knex("filter_value")
        .select("id")
        .where({ attribute_id: attr.id, slug })
        .whereNull("deleted_at")
        .first()
      if (!existing) throw e
      created = existing
    }
    const row: FilterValueRow = {
      id: created.id,
      attribute_id: attr.id,
      value,
      slug,
      hex: (created as any).hex ?? null,
      aliases: [],
      rank: 0,
    }
    attr.values.push(row)
    idx.set(mk, row)
    idx.set(matchKey(slug), row)
    report.valuesCreated++
    return row.id
  }

  const toCreate: Record<string, unknown>[] = []
  const toDelete: string[] = []

  for (const p of products) {
    report.products++
    const specs = foldSpecs(p.metadata?.specs)
    const title = p.title ?? ""
    const applicable = attributesForCategories(config, catsOf.get(p.id) ?? [])
    const applicableIds = new Set(applicable.map((a) => a.id))

    for (const attr of config.attributes) {
      if (onlyAttrs && !onlyAttrs.has(attr.id)) continue
      const existing = existingOf.get(`${p.id}:${attr.id}`) ?? []
      if (existing.some((e) => e.source === "manual")) continue

      if (!applicableIds.has(attr.id)) {
        toDelete.push(...existing.map((e) => e.id))
        continue
      }

      const raw = rawValuesFor(attr, title, specs)

      if (attr.type === "number") {
        const n = typeof raw === "number" ? raw : null
        const current = existing[0]?.value_number ?? null
        const same =
          existing.length === (n == null ? 0 : 1) &&
          (n == null || (current != null && Math.abs(current - n) < 0.005))
        if (same) continue
        toDelete.push(...existing.map((e) => e.id))
        if (n != null) {
          toCreate.push({ product_id: p.id, attribute_id: attr.id, value_number: n, source: "auto" })
        }
        continue
      }

      const wanted = new Set<string>()
      for (const r of Array.isArray(raw) ? raw : []) {
        const id = await resolveValue(attr, r)
        if (id) wanted.add(id)
        if (!attr.is_multi) break
      }
      const have = new Set(existing.map((e) => e.value_id).filter(Boolean) as string[])
      const same = have.size === wanted.size && [...wanted].every((id) => have.has(id))
      if (same && existing.length === have.size) continue
      toDelete.push(...existing.map((e) => e.id))
      for (const value_id of wanted) {
        toCreate.push({ product_id: p.id, attribute_id: attr.id, value_id, source: "auto" })
      }
    }
  }

  // Hard delete: rândurile automate n-au istoric de păstrat, iar cele șterse
  // soft ar umfla tabelul la fiecare salvare de produs.
  for (let i = 0; i < toDelete.length; i += 500) {
    await knex("product_filter_value").whereIn("id", toDelete.slice(i, i + 500)).delete()
  }
  for (let i = 0; i < toCreate.length; i += 200) {
    await service.createProductFilterValues(toCreate.slice(i, i + 200) as any)
  }
  report.rowsDeleted = toDelete.length
  report.rowsCreated = toCreate.length
  return report
}
