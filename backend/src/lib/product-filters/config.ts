/**
 * Configurația filtrelor, citită direct din tabele (knex): o folosesc și ruta
 * de catalog la fiecare cerere, și completarea automată, și adminul. Tabelele
 * sunt mici (zeci de atribute, sute de valori), deci o citire completă e
 * mai ieftină decât orice cache de invalidat.
 */

export type FilterValueRow = {
  id: string
  attribute_id: string
  value: string
  slug: string
  hex: string | null
  aliases: string[]
  rank: number
}

export type FilterAttributeRow = {
  id: string
  key: string
  label: string
  type: "select" | "number"
  display: "chips" | "swatch"
  unit: string | null
  is_global: boolean
  is_multi: boolean
  closed_values: boolean
  sources: string[]
  excluded_values: string[]
  extractor: string | null
  rank: number
  /** category_id → poziția filtrului în categoria aceea. */
  categoryRanks: Map<string, number>
  values: FilterValueRow[]
}

export type FilterConfig = {
  attributes: FilterAttributeRow[]
  /** category_id → părintele lui (null la nivelul de top). */
  parentOf: Map<string, string | null>
}

export async function loadFilterConfig(knex: any): Promise<FilterConfig> {
  const [attrs, values, links, cats] = await Promise.all([
    knex("filter_attribute").whereNull("deleted_at").orderBy([{ column: "rank" }, { column: "label" }]),
    knex("filter_value").whereNull("deleted_at").orderBy([{ column: "rank" }, { column: "value" }]),
    knex("filter_attribute_category").whereNull("deleted_at"),
    knex("product_category").select("id", "parent_category_id").whereNull("deleted_at"),
  ])

  const byId = new Map<string, FilterAttributeRow>()
  for (const a of attrs) {
    byId.set(a.id, {
      id: a.id,
      key: a.key,
      label: a.label,
      type: a.type,
      display: a.display,
      unit: a.unit,
      is_global: a.is_global,
      is_multi: a.is_multi,
      closed_values: a.closed_values,
      sources: a.sources ?? [],
      excluded_values: a.excluded_values ?? [],
      extractor: a.extractor,
      rank: a.rank,
      categoryRanks: new Map(),
      values: [],
    })
  }
  for (const v of values) byId.get(v.attribute_id)?.values.push({ ...v, aliases: v.aliases ?? [] })
  for (const l of links) byId.get(l.attribute_id)?.categoryRanks.set(l.category_id, l.rank)

  return {
    attributes: [...byId.values()],
    parentOf: new Map(cats.map((c: any) => [c.id, c.parent_category_id])),
  }
}

/** Categoriile date plus toți strămoșii lor — subcategoriile moștenesc filtrele. */
export function withAncestors(categoryIds: Iterable<string>, parentOf: Map<string, string | null>): Set<string> {
  const out = new Set<string>()
  for (let id of categoryIds) {
    let guard = 0
    while (id && !out.has(id) && guard++ < 20) {
      out.add(id)
      id = parentOf.get(id) as string
    }
  }
  return out
}

/**
 * Filtrele care se aplică unui set de categorii, în ordinea de afișare:
 * întâi cele globale (marca), apoi cele de categorie după poziția aleasă în
 * admin. Fără categorii (magazinul întreg, căutarea) rămân doar cele globale —
 * „Memorie RAM" n-are sens peste căști și huse deodată.
 */
export function attributesForCategories(
  config: FilterConfig,
  categoryIds: Iterable<string>
): FilterAttributeRow[] {
  const cats = withAncestors(categoryIds, config.parentOf)
  const scored: { a: FilterAttributeRow; score: number }[] = []
  for (const a of config.attributes) {
    if (a.is_global) {
      scored.push({ a, score: -1000 + a.rank })
      continue
    }
    let best: number | null = null
    for (const [catId, rank] of a.categoryRanks) {
      if (cats.has(catId) && (best == null || rank < best)) best = rank
    }
    if (best != null) scored.push({ a, score: best })
  }
  return scored.sort((x, y) => x.score - y.score || x.a.label.localeCompare(y.a.label)).map((s) => s.a)
}
