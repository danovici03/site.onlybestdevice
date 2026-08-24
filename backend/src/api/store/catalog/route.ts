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
 * GET /store/catalog?region_id=…&category_id=…&brand=Apple&brand=Samsung&page=1
 *
 * Fațetele de marcă/stocare/RAM/culoare vin din `product.metadata`
 * (`filter_*`), scrise de scriptul `extract-product-filters.ts`.
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
  brand: multi,
  storage: multi,
  ram: multi,
  color: multi,
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

/** Trebuie să rămână aliniat cu `FilterKey` din storefront. */
type FilterKey = "category" | "brand" | "storage" | "ram" | "color"
const FILTER_KEYS: FilterKey[] = [
  "category",
  "brand",
  "storage",
  "ram",
  "color",
]

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
 * Cuvintele căutării. Se caută pe cuvinte, nu pe șirul întreg: „iphone negru"
 * trebuie să găsească „Apple iPhone 15 · Midnight negru", unde cele două
 * cuvinte nu sunt lipite. Maxim 6 — restul nu mai schimbă rezultatul, dar ar
 * adăuga clauze SQL la nesfârșit.
 */
const searchTerms = (raw?: string): string[] => {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return []

  const tokens = trimmed
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 6)

  // O căutare din cuvinte de o literă („s") n-ar lăsa niciun token, iar zero
  // clauze înseamnă „fără filtru" — adică tot catalogul, sub titlul „Rezultate
  // pentru «s»". Căutăm atunci șirul ca atare: puține rezultate e un răspuns
  // corect, tot catalogul nu e.
  return tokens.length ? tokens : [trimmed]
}

/** `%`, `_` și `\` sunt metacaractere în ILIKE — le neutralizăm. */
const escapeLike = (s: string): string => s.replace(/[\\%_]/g, "\\$&")

/**
 * Catalogul are titluri și cu, și fără diacritice — importurile din WooCommerce
 * au venit în ambele feluri („Husa de protectie" lângă „Husă"). Fără
 * normalizare, „husă" găsea 2 produse și „husa" alte 7, iar clientul nu are cum
 * să ghicească ce variantă a scris operatorul.
 *
 * Aceeași hartă se aplică termenului (în JS) și coloanelor (prin TRANSLATE, în
 * SQL) — de aceea e o listă explicită și nu o normalizare NFD: NFD ar acoperi
 * în JS litere pe care TRANSLATE nu le-ar acoperi în SQL, iar cele două părți
 * ar înceta să se potrivească.
 */
const DIACRITICS = {
  ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
  á: "a", à: "a", ä: "a", é: "e", è: "e", ë: "e", í: "i", ì: "i", ï: "i",
  ó: "o", ò: "o", ö: "o", ú: "u", ù: "u", ü: "u", ç: "c", ñ: "n",
} as const

const DIACRITICS_FROM = Object.keys(DIACRITICS).join("")
const DIACRITICS_TO = Object.values(DIACRITICS).join("")

/** Varianta fără diacritice, cu litere mici — pentru termenul căutat. */
const foldTerm = (s: string): string =>
  s.toLowerCase().replace(/./gu, (c) => (DIACRITICS as Record<string, string>)[c] ?? c)

/** Aceeași normalizare, dar pentru o expresie SQL. */
const foldSql = (expr: string): string =>
  `TRANSLATE(LOWER(${expr}), '${DIACRITICS_FROM}', '${DIACRITICS_TO}')`

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
      OR ${foldSql("p.metadata->>'filter_brand'")} LIKE ${t}
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
             p.metadata->>'filter_brand'     AS brand,
             p.metadata->>'filter_storage'   AS storage,
             p.metadata->>'filter_ram'       AS ram,
             p.metadata->>'filter_color'     AS color,
             p.metadata->>'filter_color_hex' AS color_hex,
             MIN(ep.amount) AS price
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
   */
  type Excludable = FilterKey | "price"
  const filterClauses = (exclude?: Excludable): string[] => {
    const out: string[] = []
    const inList = (col: string, values: string[], key: FilterKey) => {
      if (exclude === key || !values.length) return
      out.push(`${col} IN (${bindList(values, key)})`)
    }
    inList("brand", q.brand, "brand")
    inList("storage", q.storage, "storage")
    inList("ram", q.ram, "ram")
    if (exclude !== "color" && q.color.length) {
      out.push(
        `LOWER(color) IN (${bindList(
          q.color.map((c) => c.toLowerCase()),
          "color"
        )})`
      )
    }
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
  const facetCte = (name: string, exclude: Excludable) => {
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

  const facetSql = `
    WITH ${scopedCte},
      ${facetCte("f_brand", "brand")},
      ${facetCte("f_storage", "storage")},
      ${facetCte("f_ram", "ram")},
      ${facetCte("f_color", "color")}
    SELECT 'brand'   AS facet, brand   AS value, NULL AS hex, COUNT(*)::int AS count FROM f_brand   WHERE brand   IS NOT NULL GROUP BY brand
    UNION ALL
    SELECT 'storage', storage, NULL, COUNT(*)::int FROM f_storage WHERE storage IS NOT NULL GROUP BY storage
    UNION ALL
    SELECT 'ram',     ram,     NULL, COUNT(*)::int FROM f_ram     WHERE ram     IS NOT NULL GROUP BY ram
    UNION ALL
    SELECT 'color',   color,   MIN(color_hex), COUNT(*)::int FROM f_color WHERE color IS NOT NULL GROUP BY color
    UNION ALL
    -- Toate mărcile din scope, neîngustate: regula care scoate din fațeta
    -- „Categorie" numele care coincid cu mărci trebuie să fie stabilă. Altfel
    -- „Apple" ar reapărea ca sub-categorie exact când filtrezi pe Samsung.
    SELECT 'brand_all', brand, NULL, COUNT(*)::int FROM scoped WHERE brand IS NOT NULL GROUP BY brand`

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

  const orderBy = `${relevance}${baseOrderBy}`

  const pageSql = `
    WITH ${scopedCte}, ${filteredCte}
    SELECT id, COUNT(*) OVER ()::int AS total
    FROM filtered
    ORDER BY ${orderBy}
    LIMIT ${bind(q.limit, "lim")} OFFSET ${bind((q.page - 1) * q.limit, "off")}`

  /* ---------------- Execuție ---------------- */

  // Toate interogările primesc același obiect de bindings; knex ignoră cheile
  // care nu apar în textul SQL respectiv.
  let facetRows: any[], priceRow: any, categoryRowsFacet: any[], pageRows: any[]
  try {
    const [f, pr, cf, pg] = await Promise.all([
      knex.raw(facetSql, b),
      knex.raw(priceSql, b),
      knex.raw(categoryFacetSql, b),
      knex.raw(pageSql, b),
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
  const brandNames = new Set(pick("brand_all").map((v) => normName(v.value)))

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

  const facets: Record<string, any> = {
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

  // O valoare bifată poate să nu mai apară deloc dacă altă fațetă o exclude
  // complet — și atunci n-ar mai putea fi debifată din panou. O readăugăm cu 0,
  // ca să rămână vizibilă și clicabilă.
  for (const key of FILTER_KEYS) {
    for (const value of q[key]) {
      const exists = facets[key].some(
        (v: any) => normName(v.value) === normName(value)
      )
      if (!exists) facets[key].push({ value, count: 0 })
    }
  }

  return res.json({ products, count, facets })
}
