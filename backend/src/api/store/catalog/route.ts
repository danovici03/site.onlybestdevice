import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  QueryContext,
  getTotalVariantAvailability,
  getVariantAvailability,
} from "@medusajs/framework/utils"
import { z } from "zod"

import {
  attributesForCategories,
  loadFilterConfig,
  type FilterAttributeRow,
} from "../../../lib/product-filters/config"
import { matchKey, numericSortKey } from "../../../lib/product-filters/normalize"
import { escapeLike, foldSql, foldTerm, searchTerms } from "../../../lib/catalog-search"

/**
 * Catalog filtrat, cu fațete numărate în SQL.
 *
 * Înlocuiește tiparul „aduc tot catalogul în storefront și filtrez în memorie":
 * filtrarea și numărătoarea se fac în baza de date, iar peste rețea pleacă doar
 * pagina curentă de produse (hidratată cu prețurile calculate de Medusa) plus
 * contoarele fațetelor.
 *
 * GET /store/catalog?region_id=…&category_id=…&brand=Apple&brand=Samsung&page=1
 *
 * Fațetele de atribut (marcă, RAM, diagonală, …) vin din modulul
 * `product_filter`: filtrele aplicabile se aleg după categoriile din scope și
 * cele bifate, iar parametrul din URL e cheia filtrului (`?ram=8-gb`,
 * `?diagonala=6-6.7`). Vezi `lib/product-filters/`.
 */

/**
 * Fațetă cu selecție multiplă: o apariție a parametrului per valoare.
 *
 * NU e o listă separată prin virgulă — numele de categorii o conțin („Console,
 * Jocuri", „Tv, Audio-Video si Foto"), iar split-ul pe virgulă le rupea în
 * bucăți care nu corespundeau niciunei categorii, deci clauza devenea `FALSE`
 * și catalogul se golea. `qs` (Express) păstrează array-ul intact chiar și
 * pentru o singură valoare.
 */
const multi = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    (v == null ? [] : Array.isArray(v) ? v : [v])
      .map((s) => s.trim())
      .filter(Boolean)
  )

const QuerySchema = z.object({
  region_id: z.string().min(1),
  /** Căutare liberă: fiecare cuvânt trebuie să apară undeva în produs. */
  q: z.string().trim().max(120).optional(),
  category_id: z.union([z.string(), z.array(z.string())]).optional(),
  collection_id: z.string().optional(),
  /** Categoria-părinte ale cărei fațete de sub-categorie le oferim; absent = nivelul de top. */
  facet_parent_id: z.string().optional(),
  category: multi,
  /** Doar produsele în stoc (aceeași regulă ca badge-ul din card). */
  stock: z
    .union([z.literal("true"), z.literal("1"), z.literal("false"), z.literal("0")])
    .optional()
    .transform((v) => v === "true" || v === "1"),
  /** Interval de preț „min-max"; capetele sunt opționale („-500", „100-"). */
  price: z.string().optional(),
  /**
   * Doar produsele bifate „La ofertă" în admin (tagul `oferta`).
   *
   * Nu se deduce din `compare_at_price`: aproape tot catalogul are un preț
   * tăiat, deci criteriul acela ar întoarce tot magazinul. Oferta e o selecție
   * făcută manual, nu o proprietate a prețului.
   */
  sale: z
    .union([z.literal("true"), z.literal("1"), z.literal("false"), z.literal("0")])
    .optional()
    .transform((v) => v === "true" || v === "1"),
  /**
   * Doar produsele care poartă tagul dat (ex. `recomandat`, scris de bifa
   * „Recomandat" din admin).
   *
   * Complementar lui `sale`, care are parametru propriu pentru că e criteriul
   * paginii /oferte. Aici selecția e liberă, ca prima pagină să poată cere
   * „produsele bifate din categoria asta" fără să aducă tot catalogul și să
   * caute tagul în memorie — un produs bifat dar aflat pe pagina a treia n-ar
   * urca niciodată în vitrină.
   */
  tag: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : undefined)),
  sort: z.enum(["created_at", "price_asc", "price_desc"]).default("created_at"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
})
  // Cheile filtrelor sunt dinamice (le definește adminul) — se citesc separat
  // din `req.query`, după ce știm ce filtre se aplică.
  .passthrough()

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

/**
 * Categorii-container care n-au sens ca valoare de filtru.
 *
 * „Oferte" e aici pentru că nu mai e sursa ofertelor: pagina /oferte listează
 * după bifa „La ofertă" de pe produs. Lăsată în fațetă, `/store?category=Oferte`
 * ar rămâne o a doua listă de oferte, care se depărtează de prima la fiecare
 * bifare — exact contradicția pe care redirectul de pe `/categories/oferte` o
 * închide la nivel de URL.
 */
const CATEGORY_FACET_BLOCKLIST = new Set(["fara categorie", "oferte"])

/**
 * Tagul care marchează un produs ca fiind la ofertă.
 *
 * Exact unul, și exact cel pe care îl scrie bifa „La ofertă" din admin: dacă
 * am accepta aici și sinonime moștenite din import (`sale`, `reducere`, …), un
 * produs care le poartă ar apărea pe /oferte în timp ce bifa arată „Preț
 * normal", iar operatorul n-ar avea cum să-l scoată din admin — bifa scoate
 * doar `oferta`. Trebuie să rămână aliniat cu `SALE_TAG` din storefront
 * (`lib/util/sale.ts`).
 */
const SALE_TAG = "oferta"

/** Cheia filtrului de marcă — numele lui se scot din fațeta „Categorie". */
const BRAND_KEY = "brand"

/** Valorile unui parametru repetat din `req.query`, curățate. */
const queryValues = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v == null ? [] : [v])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)

/** Rotunjirea capetelor unui interval: zecimale doar la valori mici (inch). */
const roundRange = (min: number, max: number) =>
  max < 100
    ? { min: Math.floor(min * 10) / 10, max: Math.ceil(max * 10) / 10 }
    : { min: Math.floor(min), max: Math.ceil(max) }

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

/**
 * `inventory_quantity` NU e o coloană a variantei — `/store/products` o
 * calculează într-un middleware, iar `query.graph` o întoarce mereu `null`.
 * Fără pasul ăsta, orice variantă cu `manage_inventory` ajunge în storefront cu
 * stoc necunoscut, iar cardul din listă o arată drept „Stoc epuizat" chiar dacă
 * mai e marfă.
 *
 * Se calculează pe canalul de vânzare al publishable key-ului (ca la
 * `/store/products`); fără un canal unic, cădem pe disponibilitatea totală.
 */
const attachInventoryQuantity = async (
  query: any,
  products: any[],
  channelIds: string[]
) => {
  const managed = products
    .flatMap((p: any) => p.variants ?? [])
    .filter((v: any) => v?.id && v.manage_inventory)
  if (!managed.length) return

  const variant_ids = managed.map((v: any) => v.id)
  const availability =
    channelIds.length === 1
      ? await getVariantAvailability(query, {
          variant_ids,
          sales_channel_id: channelIds[0],
        })
      : await getTotalVariantAvailability(query, { variant_ids })

  for (const v of managed) {
    v.inventory_quantity = availability[v.id]?.availability ?? 0
  }
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

  /* ---------------- Filtrele aplicabile + selecția lor ---------------- */

  // Filtrele categoriilor din scope și ale celor bifate în fațetă: pe /store,
  // bifând „Telefoane mobile" apar și RAM-ul, stocarea, diagonala.
  const filterConfig = await loadFilterConfig(knex)
  const applicable = attributesForCategories(filterConfig, [
    ...categoryScopeIds,
    ...selectedCategoryIds,
  ])
  const brandAttr = filterConfig.attributes.find((a) => a.key === BRAND_KEY)

  type SelectSel = { attr: FilterAttributeRow; valueIds: string[]; raw: string[] }
  type RangeSel = { attr: FilterAttributeRow; min: number | null; max: number | null }
  const selectSel = new Map<string, SelectSel>()
  const rangeSel = new Map<string, RangeSel>()
  const rawQuery = req.query as Record<string, unknown>

  for (const attr of applicable) {
    const raw = queryValues(rawQuery[attr.key])
    if (!raw.length) continue
    if (attr.type === "number") {
      const r = parsePrice(raw[0])
      if (r.min != null || r.max != null) rangeSel.set(attr.key, { attr, ...r })
      continue
    }
    // Slug-ul e forma canonică; numele și alias-urile se acceptă pentru
    // URL-urile vechi (`?brand=Apple`, `?storage=256GB`, `?color=Black`).
    const byKey = new Map<string, string>()
    for (const v of attr.values) {
      for (const k of [v.slug, v.value, ...v.aliases]) {
        const mk = matchKey(k)
        if (mk && !byKey.has(mk)) byKey.set(mk, v.id)
      }
    }
    const valueIds = [
      ...new Set(raw.map((r) => byKey.get(matchKey(r))).filter(Boolean) as string[]),
    ]
    selectSel.set(attr.key, { attr, valueIds, raw })
  }

  /* ---------------- CTE-ul de scope ---------------- */

  // Bindings NUMITE, nu poziționale. Cu `?` ordinea din array trebuie să
  // corespundă ordinii `?`-urilor din textul SQL — de acolo a venit bug-ul în
  // care moneda, legată în JOIN, era consumată ca sales_channel_id. Cu fragmente
  // de WHERE construite pentru șapte CTE-uri diferite, ordinea devine
  // imposibil de urmărit; numele o fac irelevantă.
  const b: Record<string, any> = { currency }
  let seq = 0
  const bind = (v: any, prefix = "p") => {
    const key = `${prefix}_${seq++}`
    b[key] = v
    return `:${key}`
  }
  const bindList = (values: any[], prefix: string) =>
    values.map((v) => bind(v, prefix)).join(",")

  const scopeWhere: string[] = [
    "p.deleted_at IS NULL",
    "p.status = 'published'",
    "COALESCE(p.metadata->>'hidden','') <> 'true'",
  ]
  if (channelIds.length) {
    scopeWhere.push(
      `p.id IN (SELECT product_id FROM product_sales_channel WHERE sales_channel_id IN (${bindList(
        channelIds,
        "ch"
      )}))`
    )
  }
  if (categoryScopeIds.length) {
    scopeWhere.push(
      `p.id IN (SELECT product_id FROM product_category_product WHERE product_category_id IN (${bindList(
        categoryScopeIds,
        "scope"
      )}))`
    )
  }
  if (q.collection_id) {
    scopeWhere.push(`p.collection_id = ${bind(q.collection_id, "coll")}`)
  }
  // Oferta îngustează SCOPE-ul, nu setul filtrat: pe /oferte fațetele și
  // intervalul de preț trebuie să descrie ofertele, nu tot catalogul.
  if (q.sale) {
    scopeWhere.push(
      `p.id IN (
        SELECT pt.product_id
        FROM product_tags pt
        JOIN product_tag t ON t.id = pt.product_tag_id AND t.deleted_at IS NULL
        WHERE LOWER(t.value) = ${bind(SALE_TAG, "sale")}
      )`
    )
  }

  // Același filtru, cu tagul cerut de client (ex. `recomandat`). Îngustează tot
  // scope-ul, ca fațetele și prețurile să descrie selecția, nu tot catalogul.
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

  // Căutarea îngustează SCOPE-ul, nu doar setul filtrat: și fațetele, și
  // intervalul de preț trebuie să se refere la rezultatele căutării, altfel
  // panoul de filtre ar oferi mărci care nu apar în ce vede clientul.
  // Termenii sunt deja fără diacritice și cu litere mici, la fel ca fiecare
  // coloană prin `foldSql` — deci `LIKE`, nu `ILIKE`.
  const terms = searchTerms(q.q).map(foldTerm)
  for (const term of terms) {
    const t = bind(`%${escapeLike(term)}%`, "q")
    scopeWhere.push(`(
      ${foldSql("p.title")} LIKE ${t}
      OR ${foldSql("p.subtitle")} LIKE ${t}
      OR ${foldSql("p.handle")} LIKE ${t}
      OR EXISTS (
        SELECT 1
        FROM product_filter_value pfv
        JOIN filter_value fv ON fv.id = pfv.value_id AND fv.deleted_at IS NULL
        WHERE pfv.product_id = p.id AND pfv.deleted_at IS NULL
          AND pfv.attribute_id = ${bind(brandAttr?.id ?? "", "qbrand")}
          AND ${foldSql("fv.value")} LIKE ${t}
      )
      OR EXISTS (
        SELECT 1 FROM product_variant pv
        WHERE pv.product_id = p.id AND pv.deleted_at IS NULL
          AND (${foldSql("pv.title")} LIKE ${t} OR ${foldSql("pv.sku")} LIKE ${t})
      )
      OR EXISTS (
        SELECT 1
        FROM product_category_product pcp
        JOIN product_category pc ON pc.id = pcp.product_category_id
                                AND pc.deleted_at IS NULL
        WHERE pcp.product_id = p.id AND ${foldSql("pc.name")} LIKE ${t}
      )
    )`)
  }

  /**
   * „În stoc", cu aceeași regulă ca badge-ul din cardul de produs: vreo
   * variantă fără inventar gestionat, cu backorder sau cu stoc disponibil în
   * locațiile canalului de vânzare. Un produs fără variante contează în stoc,
   * tot ca în card. Jumătate din catalogul importat e epuizat — fără criteriul
   * ăsta în față, prima pagină a oricărei liste era plină de „Stoc epuizat".
   */
  const locationFilter = channelIds.length
    ? `AND il.location_id IN (
         SELECT stock_location_id FROM sales_channel_stock_location
         WHERE deleted_at IS NULL AND sales_channel_id IN (${bindList(channelIds, "sloc")})
       )`
    : ""
  const inStockSql = `(
    COUNT(v.id) = 0
    OR BOOL_OR(
      NOT v.manage_inventory
      OR v.allow_backorder
      OR EXISTS (
        SELECT 1
        FROM product_variant_inventory_item pvi
        JOIN inventory_level il ON il.inventory_item_id = pvi.inventory_item_id
                               AND il.deleted_at IS NULL ${locationFilter}
        WHERE pvi.variant_id = v.id AND pvi.deleted_at IS NULL
        GROUP BY pvi.inventory_item_id, pvi.required_quantity
        HAVING SUM(il.stocked_quantity - il.reserved_quantity) >= pvi.required_quantity
      )
    )
  )`

  /**
   * Scope-ul, cu prețul pe care îl vede clientul.
   *
   * Nu prețul de bază: un produs cu preț promoțional se afișează cu prețul
   * redus, deci după el trebuie și sortat și filtrat — altfel un telefon arătat
   * la 2.999 lei ar cădea în intervalul 3.000–3.500. Prețul efectiv e cel mai
   * mic dintre prețul de bază și prețurile din listele `sale` active care se
   * aplică tuturor (`rules_count = 0`; o listă legată de un grup de clienți nu
   * are ce căuta în fațetele publice).
   */
  const scopedCte = `
    scoped AS (
      SELECT p.id,
             p.title,
             p.created_at,
             MIN(ep.amount) AS price,
             ${inStockSql} AS in_stock
      FROM product p
      LEFT JOIN product_variant v ON v.product_id = p.id AND v.deleted_at IS NULL
      LEFT JOIN product_variant_price_set vps ON vps.variant_id = v.id
      LEFT JOIN LATERAL (
        SELECT MIN(pr.amount) AS amount
        FROM price pr
        LEFT JOIN price_list pl ON pl.id = pr.price_list_id AND pl.deleted_at IS NULL
        WHERE pr.price_set_id = vps.price_set_id
          AND pr.deleted_at IS NULL
          AND pr.currency_code = :currency
          AND (
            pr.price_list_id IS NULL
            OR (
              pl.status = 'active'
              AND pl.rules_count = 0
              AND (pl.starts_at IS NULL OR pl.starts_at <= NOW())
              AND (pl.ends_at   IS NULL OR pl.ends_at   >= NOW())
            )
          )
      ) ep ON TRUE
      WHERE ${scopeWhere.join(" AND ")}
      GROUP BY p.id
    )`

  /* ---------------- Clauzele de filtrare ---------------- */

  /**
   * Clauzele selecției curente, cu posibilitatea de a sări peste una.
   *
   * O fațetă se îngustează după TOATE celelalte filtre, dar niciodată după
   * propria selecție: altfel, bifând „Apple", restul mărcilor ar arăta 0 și
   * selecția multiplă în interiorul unei fațete ar deveni imposibilă.
   * În interiorul unei fațete valorile sunt SAU, între fațete ȘI.
   *
   * `exclude` e cheia unui filtru de atribut, sau una dintre fațetele fixe.
   */
  const filterClauses = (exclude?: string): string[] => {
    const out: string[] = []
    for (const [key, sel] of selectSel) {
      if (exclude === `attr:${key}`) continue
      // Valori necunoscute (link vechi, valoare ștearsă) se ignoră: n-ar
      // apărea ca chip în panou, deci clientul n-ar avea ce debifa ca să iasă
      // dintr-o listă goală.
      if (!sel.valueIds.length) continue
      out.push(
        `id IN (SELECT product_id FROM product_filter_value WHERE deleted_at IS NULL AND attribute_id = ${bind(
          sel.attr.id,
          "fa"
        )} AND value_id IN (${bindList(sel.valueIds, "fv")}))`
      )
    }
    for (const [key, sel] of rangeSel) {
      if (exclude === `attr:${key}`) continue
      const conds = [
        "deleted_at IS NULL",
        `attribute_id = ${bind(sel.attr.id, "ra")}`,
        "value_number IS NOT NULL",
      ]
      // `value_number` e `real` (float pe 4 octeți): 6.1 stă ca 6.0999999. Fără
      // rotunjire, „de la 6.1" ar exclude exact telefoanele de 6.1 inch.
      if (sel.min != null) conds.push(`ROUND(value_number::numeric, 2) >= ${bind(sel.min, "rmin")}`)
      if (sel.max != null) conds.push(`ROUND(value_number::numeric, 2) <= ${bind(sel.max, "rmax")}`)
      out.push(`id IN (SELECT product_id FROM product_filter_value WHERE ${conds.join(" AND ")})`)
    }
    if (exclude !== "stock" && q.stock) out.push("in_stock")
    if (exclude !== "category") {
      if (selectedCategoryIds.length) {
        out.push(
          `id IN (SELECT product_id FROM product_category_product WHERE product_category_id IN (${bindList(
            selectedCategoryIds,
            "cat"
          )}))`
        )
      } else if (q.category.length) {
        // Nume cerut care nu corespunde niciunei categorii → set gol, nu „toate".
        out.push("FALSE")
      }
    }
    if (exclude !== "price") {
      if (price.min != null) out.push(`price >= ${bind(price.min, "pmin")}`)
      if (price.max != null) out.push(`price <= ${bind(price.max, "pmax")}`)
      // Un produs fără preț nu poate satisface un interval de preț.
      if (price.min != null || price.max != null) out.push("price IS NOT NULL")
    }
    return out
  }

  /** `SELECT * FROM scoped` filtrat cu tot, mai puțin cheia exclusă. */
  const facetCte = (name: string, exclude: string) => {
    const clauses = filterClauses(exclude)
    return `${name} AS (SELECT * FROM scoped${
      clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""
    })`
  }

  const allClauses = filterClauses()
  const filteredCte = `filtered AS (SELECT * FROM scoped${
    allClauses.length ? ` WHERE ${allClauses.join(" AND ")}` : ""
  })`

  /* ---------------- Fațetele, fiecare peste setul îngustat de celelalte ---------------- */

  const selectAttrs = applicable.filter((a) => a.type === "select")
  const numberAttrs = applicable.filter((a) => a.type === "number")

  // Un singur SQL pentru toate filtrele select: câte un CTE per filtru (setul
  // filtrat fără propria selecție), numărat pe valori și lipit cu UNION ALL.
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
      GROUP BY pfv.value_id`
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
             ROUND(MIN(pfv.value_number)::numeric, 2)::float AS min,
             ROUND(MAX(pfv.value_number)::numeric, 2)::float AS max,
             COUNT(DISTINCT s.id)::int AS count
      FROM fn_${i} s
      JOIN product_filter_value pfv ON pfv.product_id = s.id AND pfv.deleted_at IS NULL
      WHERE pfv.attribute_id = ${bind(a.id, "fa")} AND pfv.value_number IS NOT NULL`
      )
      .join("\n    UNION ALL\n    ")}`
    : null

  // Totalul filtrat și câte produse din el sunt în stoc (fără filtrul de stoc).
  const totalsSql = `
    WITH ${scopedCte}, ${filteredCte}, ${facetCte("f_stock", "stock")}
    SELECT (SELECT COUNT(*)::int FROM filtered) AS total,
           (SELECT COUNT(*)::int FROM f_stock WHERE in_stock) AS in_stock`

  const priceSql = `
    WITH ${scopedCte}, ${facetCte("f_price", "price")}
    SELECT MIN(price)::float AS min, MAX(price)::float AS max FROM f_price WHERE price IS NOT NULL`

  const categoryFacetSql = `
    WITH ${scopedCte}, ${facetCte("f_category", "category")}
    SELECT c.name AS value, COUNT(DISTINCT s.id)::int AS count
    FROM f_category s
    JOIN product_category_product pcp ON pcp.product_id = s.id
    JOIN product_category c ON c.id = pcp.product_category_id AND c.deleted_at IS NULL
    WHERE c.parent_category_id IS NOT DISTINCT FROM ${
      q.facet_parent_id ? bind(q.facet_parent_id, "fparent") : "NULL"
    }
    GROUP BY c.name`

  // Importul în masă a dat același `created_at` la zeci de produse deodată, iar
  // și prețurile se repetă — fără `id` la coadă ordinea nu e totală și paginile
  // se suprapun între cereri (Postgres nu garantează stabilitatea la egalitate).
  const baseOrderBy =
    q.sort === "price_asc"
      ? "price ASC NULLS LAST, created_at DESC, id DESC"
      : q.sort === "price_desc"
        ? "price DESC NULLS LAST, created_at DESC, id DESC"
        : "created_at DESC, id DESC"

  // La căutare, „cel mai recent" e un criteriu prost pe primul ecran: cine
  // scrie „iphone" vrea telefonul, nu husa de iPhone importată cel mai târziu.
  // Fără date de vânzări, cele mai bune semnale sunt în titlu:
  //   1. titlul începe cu ce s-a căutat („iPhone 15 …");
  //   2. termenul apare devreme în titlu — „Telefon mobil Apple iPhone 15" e
  //      despre iPhone, „Husa … pentru Apple Iphone 15 Pro" e despre husă;
  //   3. titlul e scurt, deci produsul nu e o variație accesorizată a lui.
  // Produsele care se potrivesc doar prin categorie sau SKU n-au termenul în
  // titlu: POSITION dă 0, iar NULLIF le trimite la coadă, nu în frunte.
  const relevance = terms.length
    ? [
        `CASE WHEN ${foldSql("title")} LIKE ${bind(
          `${escapeLike(terms.join(" "))}%`,
          "rank"
        )} THEN 0 ELSE 1 END`,
        `NULLIF(POSITION(${bind(terms[0], "rank")} IN ${foldSql(
          "title"
        )}), 0) NULLS LAST`,
        "LENGTH(title)",
      ].join(", ") + ", "
    : ""

  // Stocul trece înaintea oricărui alt criteriu, inclusiv relevanța la căutare
  // și sortarea după preț: un produs epuizat nu are ce căuta pe primul ecran.
  const orderBy = `in_stock DESC, ${relevance}${baseOrderBy}`

  const pageSql = `
    WITH ${scopedCte}, ${filteredCte}
    SELECT id, COUNT(*) OVER ()::int AS total
    FROM filtered
    ORDER BY ${orderBy}
    LIMIT ${bind(q.limit, "lim")} OFFSET ${bind((q.page - 1) * q.limit, "off")}`

  /* ---------------- Execuție ---------------- */

  // Toate interogările primesc același obiect de bindings; knex ignoră cheile
  // care nu apar în textul SQL respectiv.
  let selectRows: any[], numberRows: any[], totalsRow: any
  let priceRow: any, categoryRowsFacet: any[], pageRows: any[]
  try {
    const empty = Promise.resolve({ rows: [] as any[] })
    const [sf, nf, tt, pr, cf, pg] = await Promise.all([
      selectFacetSql ? knex.raw(selectFacetSql, b) : empty,
      numberFacetSql ? knex.raw(numberFacetSql, b) : empty,
      knex.raw(totalsSql, b),
      knex.raw(priceSql, b),
      knex.raw(categoryFacetSql, b),
      knex.raw(pageSql, b),
    ])
    selectRows = sf.rows
    numberRows = nf.rows
    totalsRow = tt.rows[0]
    priceRow = pr.rows[0]
    categoryRowsFacet = cf.rows
    pageRows = pg.rows
  } catch (e: any) {
    logger.error(`/store/catalog: interogare eșuată — ${e?.message}`)
    return res.status(500).json({ message: "Catalogul nu a putut fi filtrat." })
  }

  // Din totaluri, nu din pagină: o pagină dincolo de capăt n-are rânduri, dar
  // numărul de rezultate rămâne același.
  const count: number = totalsRow?.total ?? 0
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

    await attachInventoryQuantity(query, products, channelIds)
  }

  /* ---------------- Formatarea fațetelor ---------------- */

  const byCountThenName = (a: any, b: any) =>
    b.count - a.count || a.value.localeCompare(b.value)

  // Mărcile se scot din fațeta „Categorie" (subcategoriile-marcă ar dubla
  // fațeta „Marcă"). Lista vine din valorile filtrului de marcă, nu din ce e
  // în scope — regula trebuie să fie stabilă când filtrezi pe altă marcă.
  const brandNames = new Set((brandAttr?.values ?? []).map((v) => normName(v.value)))

  // Categoriile duplicate din import se unesc după numele normalizat.
  const categoryMerged = new Map<string, { value: string; count: number }>()
  for (const r of categoryRowsFacet) {
    const key = normName(r.value)
    if (!key || CATEGORY_FACET_BLOCKLIST.has(key) || brandNames.has(key)) continue
    const e = categoryMerged.get(key) ?? { value: r.value, count: 0 }
    e.count += r.count
    categoryMerged.set(key, e)
  }
  const category = Array.from(categoryMerged.values()).sort(byCountThenName)
  // O valoare bifată poate să nu mai apară deloc dacă altă fațetă o exclude
  // complet — și atunci n-ar mai putea fi debifată din panou. O readăugăm cu 0.
  for (const value of q.category) {
    if (!category.some((v) => normName(v.value) === normName(value))) {
      category.push({ value, count: 0 })
    }
  }

  const attributes: any[] = []
  for (const attr of applicable) {
    const base = {
      key: attr.key,
      label: attr.label,
      type: attr.type,
      display: attr.display,
      unit: attr.unit,
    }

    if (attr.type === "number") {
      const row = numberRows.find((r) => r.key === attr.key)
      const sel = rangeSel.get(attr.key)
      const hasRange = row && row.min != null && row.max != null && row.max > row.min
      if (!hasRange && !sel) continue
      attributes.push({
        ...base,
        range: hasRange ? roundRange(row.min, row.max) : null,
        selected: sel ? { min: sel.min, max: sel.max } : null,
      })
      continue
    }

    const sel = selectSel.get(attr.key)
    const counts = new Map<string, number>(
      selectRows.filter((r) => r.key === attr.key).map((r) => [r.value_id, r.count])
    )
    const selectedIds = new Set(sel?.valueIds ?? [])
    const values = attr.values
      .filter((v) => counts.has(v.id) || selectedIds.has(v.id))
      .map((v) => ({
        value: v.value,
        slug: v.slug,
        hex: v.hex,
        count: counts.get(v.id) ?? 0,
        rank: v.rank,
      }))
    if (!values.length && !sel) continue

    // Un filtru cu o singură valoare care acoperă tot rezultatul nu filtrează
    // nimic. Unul cu o valoare pe o parte din rezultate („5G") e un comutator
    // util, deci rămâne.
    if (!sel && values.length === 1 && values[0].count >= count) continue

    if (values.some((v) => v.rank > 0)) {
      values.sort((a, b) => a.rank - b.rank || byCountThenName(a, b))
    } else if (values.every((v) => numericSortKey(v.value) != null)) {
      values.sort((a, b) => numericSortKey(a.value)! - numericSortKey(b.value)!)
    } else {
      values.sort(byCountThenName)
    }

    attributes.push({
      ...base,
      values: values.map(({ rank: _rank, ...v }) => v),
      selected: attr.values.filter((v) => selectedIds.has(v.id)).map((v) => v.slug),
    })
  }

  const facets = {
    category,
    priceRange:
      priceRow?.min != null && priceRow?.max != null && priceRow.max > priceRow.min
        ? { min: Math.floor(priceRow.min), max: Math.ceil(priceRow.max) }
        : null,
    stock: { count: totalsRow?.in_stock ?? 0 },
    attributes,
  }

  return res.json({ products, count, facets })
}
