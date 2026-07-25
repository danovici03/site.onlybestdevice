import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  QueryContext,
} from "@medusajs/framework/utils"
import { z } from "zod"

/**
 * Catalog filtrat, cu fațete numărate în SQL.
 *
 * Înlocuiește tiparul „aduc tot catalogul în storefront și filtrez în memorie":
 * filtrarea și numărătoarea se fac în baza de date, iar peste rețea pleacă doar
 * pagina curentă de produse (hidratată cu prețurile calculate de Medusa) plus
 * contoarele fațetelor.
 *
 * GET /store/catalog?region_id=…&category_id=…&brand=Apple,Samsung&page=1
 *
 * Fațetele de marcă/stocare/RAM/culoare vin din `product.metadata`
 * (`filter_*`), scrise de scriptul `extract-product-filters.ts`.
 */

const csv = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  )

const QuerySchema = z.object({
  region_id: z.string().min(1),
  category_id: z.union([z.string(), z.array(z.string())]).optional(),
  collection_id: z.string().optional(),
  /** Categoria-părinte ale cărei fațete de sub-categorie le oferim; absent = nivelul de top. */
  facet_parent_id: z.string().optional(),
  category: csv,
  brand: csv,
  storage: csv,
  ram: csv,
  color: csv,
  /** Interval de preț „min-max"; capetele sunt opționale („-500", „100-"). */
  price: z.string().optional(),
  sort: z.enum(["created_at", "price_asc", "price_desc"]).default("created_at"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
})

/**
 * Catalogul are categorii duplicate din două valuri de import („Console, Jocuri"
 * / „console-jocuri", cu și fără diacritice) — le unim după numele normalizat.
 * Trebuie să rămână identică cu `normName` din storefront.
 */
const normName = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

/** Categorii-container care n-au sens ca valoare de filtru. */
const CATEGORY_FACET_BLOCKLIST = new Set(["fara categorie"])

const asArray = (v: string | string[] | undefined): string[] =>
  v == null ? [] : Array.isArray(v) ? v : [v]

const parsePrice = (raw?: string): { min: number | null; max: number | null } => {
  if (!raw) return { min: null, max: null }
  const [a, b] = raw.split("-")
  const num = (s?: string) => {
    if (s == null || s.trim() === "") return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  return { min: num(a), max: num(b) }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const parsed = QuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message ?? "Parametri invalizi" })
  }
  const q = parsed.data

  // Moneda regiunii — prețurile din fațete/filtru se citesc pe ea.
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
    filters: { id: q.region_id },
  })
  const currency = (regions?.[0] as any)?.currency_code
  if (!currency) {
    return res
      .status(400)
      .json({ message: `Regiunea ${q.region_id} nu există.` })
  }

  // Canalele de vânzare permise de publishable key (setate de middleware-ul
  // /store). Fără context, nu restricționăm.
  const channelIds: string[] =
    (req as any).publishable_key_context?.sales_channel_ids ?? []

  const categoryScopeIds = asArray(q.category_id)
  const price = parsePrice(q.price)

  /* ---------------- Categoriile (pentru fațetă + selecție) ---------------- */

  const categoryRows: { id: string; name: string; parent_category_id: string | null }[] =
    await knex("product_category")
      .select("id", "name", "parent_category_id")
      .whereNull("deleted_at")

  // Numele selectate în filtru → toate id-urile de categorie cu acel nume
  // normalizat (duplicatele din import trebuie să filtreze împreună).
  const wantedNames = new Set(q.category.map(normName))
  const selectedCategoryIds = categoryRows
    .filter((c) => wantedNames.has(normName(c.name)))
    .map((c) => c.id)

  /* ---------------- CTE-ul de scope ---------------- */

  // Bindings-urile trebuie împinse în ordinea în care apar `?`-urile în textul
  // SQL, nu în ordinea în care ne e comod să le calculăm: moneda e legată în
  // JOIN, care precedă WHERE-ul.
  const bindings: any[] = []
  const bind = (v: any) => {
    bindings.push(v)
    return "?"
  }

  const currencyPlaceholder = bind(currency)

  const scopeWhere: string[] = [
    "p.deleted_at IS NULL",
    "p.status = 'published'",
    "COALESCE(p.metadata->>'hidden','') <> 'true'",
  ]
  if (channelIds.length) {
    scopeWhere.push(
      `p.id IN (SELECT product_id FROM product_sales_channel WHERE sales_channel_id IN (${channelIds
        .map(bind)
        .join(",")}))`
    )
  }
  if (categoryScopeIds.length) {
    scopeWhere.push(
      `p.id IN (SELECT product_id FROM product_category_product WHERE product_category_id IN (${categoryScopeIds
        .map(bind)
        .join(",")}))`
    )
  }
  if (q.collection_id) {
    scopeWhere.push(`p.collection_id = ${bind(q.collection_id)}`)
  }

  const scopedCte = `
    scoped AS (
      SELECT p.id,
             p.created_at,
             p.metadata->>'filter_brand'     AS brand,
             p.metadata->>'filter_storage'   AS storage,
             p.metadata->>'filter_ram'       AS ram,
             p.metadata->>'filter_color'     AS color,
             p.metadata->>'filter_color_hex' AS color_hex,
             MIN(pr.amount) AS price
      FROM product p
      LEFT JOIN product_variant v ON v.product_id = p.id AND v.deleted_at IS NULL
      LEFT JOIN product_variant_price_set vps ON vps.variant_id = v.id
      LEFT JOIN price pr ON pr.price_set_id = vps.price_set_id
                        AND pr.deleted_at IS NULL
                        AND pr.price_list_id IS NULL
                        AND pr.currency_code = ${currencyPlaceholder}
      WHERE ${scopeWhere.join(" AND ")}
      GROUP BY p.id
    )`

  // Bindings acumulate până aici descriu scope-ul; fațetele și setul filtrat
  // pornesc amândouă de la el, deci fiecare query își reia prefixul.
  const scopeBindings = [...bindings]

  /* ---------------- Fațetele (peste scope, fără selecția curentă) ---------------- */

  const facetSql = `
    WITH ${scopedCte}
    SELECT 'brand'   AS facet, brand   AS value, NULL AS hex, COUNT(*)::int AS count FROM scoped WHERE brand   IS NOT NULL GROUP BY brand
    UNION ALL
    SELECT 'storage', storage, NULL, COUNT(*)::int FROM scoped WHERE storage IS NOT NULL GROUP BY storage
    UNION ALL
    SELECT 'ram',     ram,     NULL, COUNT(*)::int FROM scoped WHERE ram     IS NOT NULL GROUP BY ram
    UNION ALL
    SELECT 'color',   color,   MIN(color_hex), COUNT(*)::int FROM scoped WHERE color IS NOT NULL GROUP BY color`

  const priceSql = `
    WITH ${scopedCte}
    SELECT MIN(price)::float AS min, MAX(price)::float AS max FROM scoped WHERE price IS NOT NULL`

  const categoryFacetSql = `
    WITH ${scopedCte}
    SELECT c.name AS value, COUNT(DISTINCT s.id)::int AS count
    FROM scoped s
    JOIN product_category_product pcp ON pcp.product_id = s.id
    JOIN product_category c ON c.id = pcp.product_category_id AND c.deleted_at IS NULL
    WHERE c.parent_category_id IS NOT DISTINCT FROM ${
      q.facet_parent_id ? "?" : "NULL"
    }
    GROUP BY c.name`

  /* ---------------- Setul filtrat ---------------- */

  const filterWhere: string[] = []
  const filterBindings: any[] = []
  const fbind = (v: any) => {
    filterBindings.push(v)
    return "?"
  }
  const inList = (col: string, values: string[]) => {
    if (!values.length) return
    filterWhere.push(`${col} IN (${values.map(fbind).join(",")})`)
  }
  inList("brand", q.brand)
  inList("storage", q.storage)
  inList("ram", q.ram)
  if (q.color.length) {
    filterWhere.push(
      `LOWER(color) IN (${q.color.map((c) => fbind(c.toLowerCase())).join(",")})`
    )
  }
  if (selectedCategoryIds.length) {
    filterWhere.push(
      `id IN (SELECT product_id FROM product_category_product WHERE product_category_id IN (${selectedCategoryIds
        .map(fbind)
        .join(",")}))`
    )
  } else if (q.category.length) {
    // Nume cerut care nu corespunde niciunei categorii → set gol, nu „toate".
    filterWhere.push("FALSE")
  }
  if (price.min != null) filterWhere.push(`price >= ${fbind(price.min)}`)
  if (price.max != null) filterWhere.push(`price <= ${fbind(price.max)}`)
  // Un produs fără preț nu poate satisface un interval de preț.
  if (price.min != null || price.max != null)
    filterWhere.push("price IS NOT NULL")

  const filteredCte = `filtered AS (SELECT * FROM scoped${
    filterWhere.length ? ` WHERE ${filterWhere.join(" AND ")}` : ""
  })`

  // Importul în masă a dat același `created_at` la zeci de produse deodată, iar
  // și prețurile se repetă — fără `id` la coadă ordinea nu e totală și paginile
  // se suprapun între cereri (Postgres nu garantează stabilitatea la egalitate).
  const orderBy =
    q.sort === "price_asc"
      ? "price ASC NULLS LAST, created_at DESC, id DESC"
      : q.sort === "price_desc"
        ? "price DESC NULLS LAST, created_at DESC, id DESC"
        : "created_at DESC, id DESC"

  const offset = (q.page - 1) * q.limit
  const pageSql = `
    WITH ${scopedCte}, ${filteredCte}
    SELECT id, COUNT(*) OVER ()::int AS total
    FROM filtered
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?`

  /* ---------------- Execuție ---------------- */

  let facetRows: any[], priceRow: any, categoryRowsFacet: any[], pageRows: any[]
  try {
    const [f, pr, cf, pg] = await Promise.all([
      knex.raw(facetSql, scopeBindings),
      knex.raw(priceSql, scopeBindings),
      knex.raw(
        categoryFacetSql,
        q.facet_parent_id
          ? [...scopeBindings, q.facet_parent_id]
          : scopeBindings
      ),
      knex.raw(pageSql, [
        ...scopeBindings,
        ...filterBindings,
        q.limit,
        offset,
      ]),
    ])
    facetRows = f.rows
    priceRow = pr.rows[0]
    categoryRowsFacet = cf.rows
    pageRows = pg.rows
  } catch (e: any) {
    logger.error(`/store/catalog: interogare eșuată — ${e?.message}`)
    return res.status(500).json({ message: "Catalogul nu a putut fi filtrat." })
  }

  const count = pageRows[0]?.total ?? 0
  const pageIds: string[] = pageRows.map((r) => r.id)

  /* ---------------- Hidratarea paginii cu prețuri calculate ---------------- */

  let products: any[] = []
  if (pageIds.length) {
    const { data } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "handle",
        "thumbnail",
        "subtitle",
        "created_at",
        "metadata",
        "images.*",
        "tags.*",
        "options.*",
        "categories.id",
        "categories.name",
        "categories.parent_category_id",
        "variants.*",
        "variants.options.*",
        "variants.images.*",
        "variants.inventory_quantity",
        "variants.calculated_price.*",
      ],
      filters: { id: pageIds },
      context: {
        variants: {
          calculated_price: QueryContext({
            region_id: q.region_id,
            currency_code: currency,
          }),
        },
      },
    })
    // query.graph nu garantează ordinea din `filters.id` — o reimpunem.
    const byId = new Map(data.map((p: any) => [p.id, p]))
    products = pageIds.map((id) => byId.get(id)).filter(Boolean)
  }

  /* ---------------- Formatarea fațetelor ---------------- */

  const pick = (name: string) =>
    facetRows
      .filter((r) => r.facet === name)
      .map((r) => ({ value: r.value as string, count: r.count as number }))

  const storageGb = (label: string): number => {
    const n = parseFloat(label)
    if (!Number.isFinite(n)) return 0
    return /tb/i.test(label) ? n * 1024 : n
  }
  const byCountThenName = (a: any, b: any) =>
    b.count - a.count || a.value.localeCompare(b.value)

  const brand = pick("brand").sort(byCountThenName)
  const brandNames = new Set(brand.map((v) => normName(v.value)))

  // Categoriile duplicate din import se unesc după numele normalizat; cele
  // care coincid cu o marcă se scot, ca să nu dubleze fațeta „Marcă".
  const categoryMerged = new Map<string, { value: string; count: number }>()
  for (const r of categoryRowsFacet) {
    const key = normName(r.value)
    if (!key || CATEGORY_FACET_BLOCKLIST.has(key) || brandNames.has(key)) continue
    const e = categoryMerged.get(key) ?? { value: r.value, count: 0 }
    e.count += r.count
    categoryMerged.set(key, e)
  }

  const color = facetRows
    .filter((r) => r.facet === "color")
    .map((r) => ({ value: r.value as string, count: r.count as number, hex: r.hex }))
    .sort(byCountThenName)

  const facets = {
    category: Array.from(categoryMerged.values()).sort(byCountThenName),
    brand,
    storage: pick("storage").sort(
      (a, b) => storageGb(a.value) - storageGb(b.value)
    ),
    ram: pick("ram").sort((a, b) => parseFloat(a.value) - parseFloat(b.value)),
    color,
    priceRange:
      priceRow?.min != null && priceRow?.max != null && priceRow.max > priceRow.min
        ? { min: Math.floor(priceRow.min), max: Math.ceil(priceRow.max) }
        : null,
  }

  return res.json({ products, count, facets })
}
