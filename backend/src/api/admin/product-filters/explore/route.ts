import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { escapeLike, foldSql, foldTerm, searchTerms } from "../../../../lib/catalog-search"
import { badRequest, deps } from "../../../../lib/product-filters/admin"
import {
  attributesForCategories,
  loadFilterConfig,
  type FilterAttributeRow,
} from "../../../../lib/product-filters/config"
import { matchKey, numericSortKey } from "../../../../lib/product-filters/normalize"

/**
 * GET /admin/product-filters/explore
 *
 * Lista de produse a paginii „Filtrare produse" din admin: aceleași filtre ca
 * în magazin (modulul `product_filter`), plus criteriile care interesează doar
 * operatorul — stare (draft/publicat), produse ascunse, stoc epuizat și
 * produsele cărora le LIPSEȘTE o valoare de filtru.
 *
 * Lista nativă de produse din dashboard nu poate primi filtre noi (meniul
 * „Adaugă filtru" e fix în `@medusajs/dashboard`), de aici pagina separată.
 *
 * Spre deosebire de `/store/catalog`, nu restrângem la produsele publicate și
 * vizibile, nu ținem cont de canalul de vânzare, iar prețul e cel de bază (fără
 * listele de preț) — adminul vrea să vadă ce e în bază, nu ce vede clientul.
 *
 * Filtrele de atribut vin ca `f_<cheie>`: `?f_brand=apple&f_brand=samsung`,
 * `?f_diagonala=6-6.7`. Valoarea `__none` cere produsele fără valoare la acel
 * filtru — lista de curățenie după completarea automată.
 */

const NONE = "__none"
const FILTER_PREFIX = "f_"
const BRAND_KEY = "brand"
const CURRENCY = "ron"

const QuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    category_id: z.string().optional(),
    status: z.enum(["published", "draft", "proposed", "rejected"]).optional(),
    stock: z.enum(["in", "out"]).optional(),
    hidden: z.enum(["true", "false"]).optional(),
    tag: z
      .string()
      .trim()
      .max(64)
      .optional()
      .transform((v) => (v ? v.toLowerCase() : undefined)),
    price: z.string().optional(),
    sort: z
      .enum(["newest", "oldest", "title", "price_asc", "price_desc", "stock_asc", "stock_desc"])
      .default("newest"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .passthrough()

const queryValues = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v == null ? [] : [v])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)

const parseRange = (raw?: string): { min: number | null; max: number | null } => {
  if (!raw) return { min: null, max: null }
  const [a, b] = raw.split("-")
  const num = (s?: string) => {
    if (s == null || s.trim() === "") return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  return { min: num(a), max: num(b) }
}

/** Categoria aleasă plus toate subcategoriile ei — ca în magazin, părintele le cuprinde. */
const withDescendants = (rootId: string, parentOf: Map<string, string | null>): string[] => {
  const children = new Map<string, string[]>()
  for (const [id, parent] of parentOf) {
    if (!parent) continue
    const list = children.get(parent) ?? []
    list.push(id)
    children.set(parent, list)
  }
  const out = new Set<string>()
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    if (out.has(id)) continue
    out.add(id)
    stack.push(...(children.get(id) ?? []))
  }
  return [...out]
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { knex, logger } = deps(req)

  const parsed = QuerySchema.safeParse(req.query)
  if (!parsed.success) return badRequest(res, parsed.error)
  const q = parsed.data
  const rawQuery = req.query as Record<string, unknown>

  const config = await loadFilterConfig(knex)
  // Cu o categorie aleasă: filtrele ei, ca în magazin. Fără categorie, toate —
  // în magazin „Memorie RAM" peste tot catalogul n-ar avea sens, dar în admin e
  // exact căutarea „ce produse n-au RAM completat", oriunde s-ar afla.
  const applicable = q.category_id
    ? attributesForCategories(config, [q.category_id])
    : [...config.attributes].sort(
        (a, b) => Number(b.is_global) - Number(a.is_global) || a.rank - b.rank
      )
  const brandAttr = config.attributes.find((a) => a.key === BRAND_KEY)
  const price = parseRange(q.price)

  /* ---------------- Selecția pe filtre ---------------- */

  type Sel = {
    attr: FilterAttributeRow
    none: boolean
    valueIds: string[]
    min: number | null
    max: number | null
  }
  const selections = new Map<string, Sel>()

  for (const attr of applicable) {
    const raw = queryValues(rawQuery[FILTER_PREFIX + attr.key])
    if (!raw.length) continue
    const none = raw.includes(NONE)
    const rest = raw.filter((r) => r !== NONE)

    if (attr.type === "number") {
      const r = parseRange(rest[0])
      if (none || r.min != null || r.max != null) {
        selections.set(attr.key, { attr, none, valueIds: [], ...r })
      }
      continue
    }

    const byKey = new Map<string, string>()
    for (const v of attr.values) {
      for (const k of [v.slug, v.value, ...v.aliases]) {
        const mk = matchKey(k)
        if (mk && !byKey.has(mk)) byKey.set(mk, v.id)
      }
    }
    const valueIds = [
      ...new Set(rest.map((r) => byKey.get(matchKey(r))).filter(Boolean) as string[]),
    ]
    if (none || valueIds.length) {
      selections.set(attr.key, { attr, none, valueIds, min: null, max: null })
    }
  }

  /* ---------------- Scope ---------------- */

  const b: Record<string, any> = { currency: CURRENCY }
  let seq = 0
  const bind = (v: any, prefix = "p") => {
    const key = `${prefix}_${seq++}`
    b[key] = v
    return `:${key}`
  }
  const bindList = (values: any[], prefix: string) => values.map((v) => bind(v, prefix)).join(",")

  const scopeWhere: string[] = ["p.deleted_at IS NULL"]

  if (q.category_id) {
    const ids = withDescendants(q.category_id, config.parentOf)
    scopeWhere.push(
      `p.id IN (SELECT product_id FROM product_category_product WHERE product_category_id IN (${bindList(
        ids,
        "cat"
      )}))`
    )
  }
  if (q.hidden === "true") scopeWhere.push("COALESCE(p.metadata->>'hidden','') = 'true'")
  if (q.hidden === "false") scopeWhere.push("COALESCE(p.metadata->>'hidden','') <> 'true'")
  if (q.tag) {
    scopeWhere.push(
      `p.id IN (
        SELECT pt.product_id
        FROM product_tags pt
        JOIN product_tag t ON t.id = pt.product_tag_id AND t.deleted_at IS NULL
        WHERE LOWER(t.value) = ${bind(q.tag, "tag")}
      )`
    )
  }

  // Aceeași căutare ca în magazin, plus id-ul exact (lipit din URL-ul produsului).
  for (const term of searchTerms(q.q).map(foldTerm)) {
    const t = bind(`%${escapeLike(term)}%`, "q")
    scopeWhere.push(`(
      LOWER(p.id) = ${bind(term, "qid")}
      OR ${foldSql("p.title")} LIKE ${t}
      OR ${foldSql("p.handle")} LIKE ${t}
      OR EXISTS (
        SELECT 1 FROM product_variant pv
        WHERE pv.product_id = p.id AND pv.deleted_at IS NULL
          AND (${foldSql("pv.title")} LIKE ${t} OR ${foldSql("pv.sku")} LIKE ${t})
      )
    )`)
  }

  /**
   * Stocul pe toate locațiile (adminul nu are canal de vânzare). „În stoc" are
   * regula din card: variantă fără inventar gestionat, cu backorder sau cu
   * cantitate disponibilă; `stock_qty` e suma disponibilă pe variantele gestionate.
   */
  const scopedCte = `
    scoped AS (
      SELECT p.id,
             p.title,
             p.status,
             p.created_at,
             MIN(bp.amount)::float AS price,
             SUM(CASE WHEN v.manage_inventory THEN COALESCE(inv.qty, 0) END)::int AS stock_qty,
             (COUNT(v.id) = 0 OR BOOL_OR(
               NOT v.manage_inventory OR v.allow_backorder OR COALESCE(inv.qty, 0) > 0
             )) AS in_stock
      FROM product p
      LEFT JOIN product_variant v ON v.product_id = p.id AND v.deleted_at IS NULL
      LEFT JOIN product_variant_price_set vps ON vps.variant_id = v.id
      LEFT JOIN LATERAL (
        SELECT MIN(pr.amount) AS amount
        FROM price pr
        WHERE pr.price_set_id = vps.price_set_id
          AND pr.deleted_at IS NULL
          AND pr.price_list_id IS NULL
          AND pr.currency_code = :currency
      ) bp ON TRUE
      LEFT JOIN LATERAL (
        SELECT SUM(il.stocked_quantity - il.reserved_quantity) AS qty
        FROM product_variant_inventory_item pvi
        JOIN inventory_level il ON il.inventory_item_id = pvi.inventory_item_id
                               AND il.deleted_at IS NULL
        WHERE pvi.variant_id = v.id AND pvi.deleted_at IS NULL
      ) inv ON TRUE
      WHERE ${scopeWhere.join(" AND ")}
      GROUP BY p.id
    )`

  /* ---------------- Clauzele (fiecare fațetă le ignoră pe ale ei) ---------------- */

  const hasValueSql = (attr: FilterAttributeRow, idExpr: string) =>
    `EXISTS (SELECT 1 FROM product_filter_value x
             WHERE x.product_id = ${idExpr} AND x.deleted_at IS NULL
               AND x.attribute_id = ${bind(attr.id, "ha")}
               AND x.${attr.type === "number" ? "value_number" : "value_id"} IS NOT NULL)`

  const filterClauses = (exclude?: string): string[] => {
    const out: string[] = []
    for (const [key, sel] of selections) {
      if (exclude === `attr:${key}`) continue
      const ors: string[] = []
      if (sel.none) ors.push(`NOT ${hasValueSql(sel.attr, "id")}`)
      if (sel.attr.type === "number" && (sel.min != null || sel.max != null)) {
        const conds = [
          "deleted_at IS NULL",
          `attribute_id = ${bind(sel.attr.id, "ra")}`,
          "value_number IS NOT NULL",
        ]
        // `value_number` e `real`: 6.1 stă ca 6.0999999 — vezi /store/catalog.
        if (sel.min != null) conds.push(`ROUND(value_number::numeric, 2) >= ${bind(sel.min, "rmin")}`)
        if (sel.max != null) conds.push(`ROUND(value_number::numeric, 2) <= ${bind(sel.max, "rmax")}`)
        ors.push(`id IN (SELECT product_id FROM product_filter_value WHERE ${conds.join(" AND ")})`)
      }
      if (sel.valueIds.length) {
        ors.push(
          `id IN (SELECT product_id FROM product_filter_value WHERE deleted_at IS NULL AND attribute_id = ${bind(
            sel.attr.id,
            "fa"
          )} AND value_id IN (${bindList(sel.valueIds, "fv")}))`
        )
      }
      if (ors.length) out.push(`(${ors.join(" OR ")})`)
    }
    if (exclude !== "status" && q.status) out.push(`status = ${bind(q.status, "st")}`)
    if (exclude !== "stock" && q.stock) out.push(q.stock === "in" ? "in_stock" : "NOT in_stock")
    if (exclude !== "price") {
      if (price.min != null) out.push(`price >= ${bind(price.min, "pmin")}`)
      if (price.max != null) out.push(`price <= ${bind(price.max, "pmax")}`)
      if (price.min != null || price.max != null) out.push("price IS NOT NULL")
    }
    return out
  }

  const facetCte = (name: string, exclude?: string) => {
    const clauses = filterClauses(exclude)
    return `${name} AS (SELECT * FROM scoped${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""})`
  }

  /* ---------------- Fațetele ---------------- */

  const selectAttrs = applicable.filter((a) => a.type === "select")
  const numberAttrs = applicable.filter((a) => a.type === "number")

  // Pe fiecare filtru: numărul pe valori și câte produse n-au nicio valoare.
  const selectFacetSql = selectAttrs.length
    ? `
    WITH ${scopedCte},
      ${selectAttrs.map((a, i) => facetCte(`fs_${i}`, `attr:${a.key}`)).join(",\n      ")}
    ${selectAttrs
      .map(
        (a, i) => `SELECT ${bind(a.key, "fk")}::text AS key, pfv.value_id, COUNT(DISTINCT s.id)::int AS count
      FROM fs_${i} s
      JOIN product_filter_value pfv ON pfv.product_id = s.id AND pfv.deleted_at IS NULL
      WHERE pfv.attribute_id = ${bind(a.id, "fa")} AND pfv.value_id IS NOT NULL
      GROUP BY pfv.value_id
    UNION ALL
    SELECT ${bind(a.key, "fk")}::text, NULL, COUNT(*)::int
      FROM fs_${i} s WHERE NOT ${hasValueSql(a, "s.id")}`
      )
      .join("\n    UNION ALL\n    ")}`
    : null

  const numberFacetSql = numberAttrs.length
    ? `
    WITH ${scopedCte},
      ${numberAttrs.map((a, i) => facetCte(`fn_${i}`, `attr:${a.key}`)).join(",\n      ")}
    ${numberAttrs
      .map(
        (a, i) => `SELECT ${bind(a.key, "fk")}::text AS key,
             (SELECT ROUND(MIN(pfv.value_number)::numeric, 2)::float
                FROM fn_${i} s JOIN product_filter_value pfv ON pfv.product_id = s.id AND pfv.deleted_at IS NULL
               WHERE pfv.attribute_id = ${bind(a.id, "fa")}) AS min,
             (SELECT ROUND(MAX(pfv.value_number)::numeric, 2)::float
                FROM fn_${i} s JOIN product_filter_value pfv ON pfv.product_id = s.id AND pfv.deleted_at IS NULL
               WHERE pfv.attribute_id = ${bind(a.id, "fa")}) AS max,
             (SELECT COUNT(*)::int FROM fn_${i} s WHERE ${hasValueSql(a, "s.id")}) AS count,
             (SELECT COUNT(*)::int FROM fn_${i} s WHERE NOT ${hasValueSql(a, "s.id")}) AS none`
      )
      .join("\n    UNION ALL\n    ")}`
    : null

  const summarySql = `
    WITH ${scopedCte}, ${facetCte("filtered")}, ${facetCte("f_status", "status")},
         ${facetCte("f_stock", "stock")}, ${facetCte("f_price", "price")}
    SELECT (SELECT COUNT(*)::int FROM filtered) AS total,
           (SELECT COALESCE(JSON_OBJECT_AGG(status, n), '{}'::json)
              FROM (SELECT status, COUNT(*)::int AS n FROM f_status GROUP BY status) x) AS status,
           (SELECT COUNT(*)::int FROM f_stock WHERE in_stock) AS stock_in,
           (SELECT COUNT(*)::int FROM f_stock WHERE NOT in_stock) AS stock_out,
           (SELECT MIN(price)::float FROM f_price) AS price_min,
           (SELECT MAX(price)::float FROM f_price) AS price_max`

  const orderBy = {
    newest: "id DESC",
    oldest: "id ASC",
    title: "title ASC, id DESC",
    price_asc: "price ASC NULLS LAST, id DESC",
    price_desc: "price DESC NULLS LAST, id DESC",
    stock_asc: "COALESCE(stock_qty, 0) ASC, id DESC",
    stock_desc: "COALESCE(stock_qty, 0) DESC, id DESC",
  }[q.sort]

  const pageSql = `
    WITH ${scopedCte}, ${facetCte("filtered")},
      pg AS (
        SELECT *, ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS rn
        FROM filtered
        ORDER BY ${orderBy}
        LIMIT ${bind(q.limit, "lim")} OFFSET ${bind((q.page - 1) * q.limit, "off")}
      )
    SELECT pg.id, pg.title, pg.status, pg.price, pg.stock_qty, pg.in_stock,
           p.handle, p.thumbnail,
           COALESCE(p.metadata->>'hidden', '') = 'true' AS hidden,
           (SELECT COUNT(*)::int FROM product_variant pv
             WHERE pv.product_id = pg.id AND pv.deleted_at IS NULL) AS variants,
           (SELECT STRING_AGG(pc.name, ', ' ORDER BY pc.name)
              FROM product_category_product pcp
              JOIN product_category pc ON pc.id = pcp.product_category_id AND pc.deleted_at IS NULL
             WHERE pcp.product_id = pg.id) AS categories,
           (SELECT STRING_AGG(fv.value, ', ' ORDER BY fv.value)
              FROM product_filter_value pfv
              JOIN filter_value fv ON fv.id = pfv.value_id AND fv.deleted_at IS NULL
             WHERE pfv.product_id = pg.id AND pfv.deleted_at IS NULL
               AND pfv.attribute_id = ${bind(brandAttr?.id ?? "", "brand")}) AS brand
    FROM pg
    JOIN product p ON p.id = pg.id
    ORDER BY pg.rn`

  let selectRows: any[], numberRows: any[], summary: any, products: any[]
  try {
    const empty = Promise.resolve({ rows: [] as any[] })
    const [sf, nf, sm, pg] = await Promise.all([
      selectFacetSql ? knex.raw(selectFacetSql, b) : empty,
      numberFacetSql ? knex.raw(numberFacetSql, b) : empty,
      knex.raw(summarySql, b),
      knex.raw(pageSql, b),
    ])
    selectRows = sf.rows
    numberRows = nf.rows
    summary = sm.rows[0] ?? {}
    products = pg.rows
  } catch (e: any) {
    logger.error(`/admin/product-filters/explore: interogare eșuată — ${e?.message}`)
    return res.status(500).json({ message: "Produsele nu au putut fi filtrate." })
  }

  /* ---------------- Formatarea ---------------- */

  const byCountThenName = (a: any, b: any) => b.count - a.count || a.value.localeCompare(b.value)

  const attributes = applicable.map((attr) => {
    const base = {
      key: attr.key,
      label: attr.label,
      type: attr.type,
      display: attr.display,
      unit: attr.unit,
    }
    const sel = selections.get(attr.key)

    if (attr.type === "number") {
      const row = numberRows.find((r) => r.key === attr.key)
      return {
        ...base,
        values: [],
        range: row?.min != null && row?.max != null ? { min: row.min, max: row.max } : null,
        with_value: row?.count ?? 0,
        none: row?.none ?? 0,
        selected: {
          values: [],
          none: !!sel?.none,
          min: sel?.min ?? null,
          max: sel?.max ?? null,
        },
      }
    }

    const rows = selectRows.filter((r) => r.key === attr.key)
    const counts = new Map<string, number>(
      rows.filter((r) => r.value_id).map((r) => [r.value_id, r.count])
    )
    const selectedIds = new Set(sel?.valueIds ?? [])
    const values = attr.values
      .filter((v) => counts.has(v.id) || selectedIds.has(v.id))
      .map((v) => ({ value: v.value, slug: v.slug, hex: v.hex, count: counts.get(v.id) ?? 0, rank: v.rank }))

    if (values.some((v) => v.rank > 0)) {
      values.sort((a, b) => a.rank - b.rank || byCountThenName(a, b))
    } else if (values.every((v) => numericSortKey(v.value) != null)) {
      values.sort((a, b) => numericSortKey(a.value)! - numericSortKey(b.value)!)
    } else {
      values.sort(byCountThenName)
    }

    return {
      ...base,
      values: values.map(({ rank: _rank, ...v }) => v),
      range: null,
      with_value: [...counts.values()].reduce((s, n) => s + n, 0),
      none: rows.find((r) => r.value_id == null)?.count ?? 0,
      selected: {
        values: attr.values.filter((v) => selectedIds.has(v.id)).map((v) => v.slug),
        none: !!sel?.none,
        min: null,
        max: null,
      },
    }
  })

  res.json({
    products,
    count: summary.total ?? 0,
    page: q.page,
    limit: q.limit,
    facets: {
      status: summary.status ?? {},
      stock: { in: summary.stock_in ?? 0, out: summary.stock_out ?? 0 },
      price:
        summary.price_min != null && summary.price_max != null
          ? { min: Math.floor(summary.price_min), max: Math.ceil(summary.price_max) }
          : null,
      attributes,
    },
  })
}
