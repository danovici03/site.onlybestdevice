import { HttpTypes } from "@medusajs/types"

import { categorySlug } from "@lib/util/category-slug"
import { emptySelectedFilters } from "@lib/util/product-filters"
import {
  RAIL_MAX_ITEMS,
  RAIL_PAGE_SIZE,
  type RailKind,
  type RailPage,
  type RailSource,
  type RailTab,
} from "@lib/util/rail"
import { listBestSellers } from "./best-sellers"
import { listCategories } from "./categories"
import { listCatalog, listProducts } from "./products"

/**
 * Produsele rail-urilor de pe prima pagină (Oferte, Produse recomandate, Cele
 * mai vândute). Toate trei arată la fel — același card, aceleași taburi — și
 * diferă doar prin criteriul de selecție; vezi `RailKind` în `@lib/util/rail`.
 */

/** Câte poziții de clasament citim o dată pentru „Cele mai vândute". */
const BEST_SELLERS_RANK_MAX = 48

/**
 * Tagul scris de bifa „Recomandat" din admin.
 *
 * Exact unul, ca la `oferta`: dacă am accepta și sinonime (`iconic`, moștenit
 * din starter), un produs care le poartă ar urca în secțiune fără ca bifa din
 * admin să arate ceva — și n-ar avea cum să fie scos de acolo. Trebuie să
 * rămână aliniat cu widgetul `backend/src/admin/widgets/product-featured.tsx`.
 */
const FEATURED_TAG = "recomandat"

/** Categorii-coș, bune ca filtru în catalog dar nu ca tag pe prima pagină. */
const isMiscCategory = (name: string): boolean =>
  ["diverse", "fara-categorie"].includes(categorySlug(name))

/**
 * O pagină dintr-un rail. Aceeași funcție servește și randarea de pe server
 * (pagina 1), și acțiunea chemată din browser la drag — altfel cele două ar
 * putea ajunge să numere paginile diferit.
 */
export const fetchRailPage = async (
  source: RailSource,
  page = 1,
  limit = RAIL_PAGE_SIZE
): Promise<RailPage> => {
  if (source.kind === "bestsellers") {
    return fetchBestSellersPage(source, page, limit)
  }
  if (source.kind === "featured") {
    return fetchFeaturedPage(source, page, limit)
  }

  const { products, count } = await listCatalog({
    countryCode: source.countryCode,
    selected: categorySelection(source.category),
    sale: true,
    page,
    limit,
  })

  return { products, hasMore: page * limit < Math.min(count, RAIL_MAX_ITEMS) }
}

/** Selecția de catalog îngustată la o categorie de nivel 1 (după nume). */
const categorySelection = (category?: string) => {
  const selected = emptySelectedFilters()
  if (category) {
    selected.category = [category]
  }
  return selected
}

/**
 * „Produse recomandate": produsele bifate „Recomandat" în admin, apoi
 * catalogul recent al categoriei.
 *
 * Bifatele se cer separat, prin filtrul de tag al rutei de catalog — nu se
 * caută tagul în pagina deja adusă. Diferența contează: un produs bifat care
 * stă pe pagina a treia a categoriei n-ar urca niciodată în vitrină, iar bifa
 * din admin ar părea că nu face nimic.
 *
 * Fără nicio bifă, secțiunea rămâne catalogul recent — deci nu se golește
 * pentru că n-a apucat nimeni să aleagă.
 */
const fetchFeaturedPage = async (
  source: RailSource,
  page: number,
  limit: number
): Promise<RailPage> => {
  const selected = categorySelection(source.category)

  const [pinned, { products, count }] = await Promise.all([
    listCatalog({
      countryCode: source.countryCode,
      selected,
      tag: FEATURED_TAG,
      page: 1,
      limit: RAIL_MAX_ITEMS,
    }),
    listCatalog({ countryCode: source.countryCode, selected, page, limit }),
  ])

  const pinnedIds = new Set(pinned.products.map((p) => p.id))
  // Bifatele stau pe prima pagină (cât încap); dacă cineva bifează mai multe
  // decât încap, restul rămân la locul lor din catalog — o vitrină nu e o
  // listă completă.
  const head = page === 1 ? pinned.products.slice(0, limit) : []

  return {
    products: [...head, ...products.filter((p) => !pinnedIds.has(p.id))].slice(
      0,
      limit
    ),
    hasMore: page * limit < Math.min(count, RAIL_MAX_ITEMS),
  }
}

/**
 * „Cele mai vândute": clasamentul din comenzi pus în fața catalogului
 * categoriei.
 *
 * Restul paginilor vin din `/store/catalog`, NU din `/store/products`. Ruta de
 * catalog ordonează `created_at DESC, id DESC`; listarea standard ordonează
 * doar după `created_at`, iar importul în masă a dat aceeași dată la zeci de
 * produse — ordinea nu e totală, deci paginile se suprapun de la o cerere la
 * alta. Cu ea, rail-ul aducea pagini pe jumătate duplicate și se oprea după
 * două încărcări.
 *
 * Clasamentul apare doar pe prima pagină (e scurt: câteva comenzi acoperă
 * câteva produse), iar produsele lui se scot din paginile următoare de catalog.
 */
const fetchBestSellersPage = async (
  source: RailSource,
  page: number,
  limit: number
): Promise<RailPage> => {
  const { countryCode, category, categoryIds } = source

  // Categoriile duplicate din import au clasamente separate — le citim pe toate
  // și le unim, altfel un tab ar arăta clasamentul unei singure copii.
  const ranking = (
    await Promise.all(
      (categoryIds?.length ? categoryIds : [undefined]).map((categoryId) =>
        listBestSellers({ categoryId, limit: BEST_SELLERS_RANK_MAX })
      )
    )
  )
    .flat()
    .sort((a, b) => b.sold - a.sold)

  const rankedIds: string[] = []
  for (const entry of ranking) {
    if (!rankedIds.includes(entry.product_id)) rankedIds.push(entry.product_id)
  }

  const ranked: HttpTypes.StoreProduct[] = []
  if (page === 1 && rankedIds.length) {
    const wanted = rankedIds.slice(0, limit)
    const { response } = await listProducts({
      countryCode,
      queryParams: { id: wanted, limit: wanted.length },
    })
    const byId = new Map(response.products.map((p) => [p.id, p]))
    ranked.push(
      ...wanted
        .map((id) => byId.get(id))
        .filter((p): p is HttpTypes.StoreProduct => !!p)
    )
  }

  const { products: fillers, count } = await listCatalog({
    countryCode,
    selected: categorySelection(category),
    page,
    limit,
  })

  const shown = new Set([...rankedIds, ...ranked.map((p) => p.id)])
  const products = [
    ...ranked,
    ...fillers.filter((p) => !shown.has(p.id)),
  ].slice(0, limit)

  return {
    products,
    hasMore: page * limit < Math.min(count, RAIL_MAX_ITEMS),
  }
}

/**
 * Taburile unui rail: „Toate" plus categoriile de nivel 1 care chiar au
 * produse în selecția respectivă.
 *
 * Lista vine din fațeta de categorie a catalogului, nu din arborele de
 * categorii: fațeta e deja îngustată la ce vede clientul (publicat, în canalul
 * de vânzare, la ofertă când e cazul), deci nu apar taburi goale. Numele se
 * mapează înapoi la id-uri pentru clasamentul de vânzări, care lucrează pe id.
 */
export const buildRailTabs = async ({
  kind,
  countryCode,
  maxTabs = 8,
  limit = RAIL_PAGE_SIZE,
}: {
  kind: RailKind
  countryCode: string
  maxTabs?: number
  limit?: number
}): Promise<RailTab[]> => {
  const [{ facets, count }, categories] = await Promise.all([
    listCatalog({
      countryCode,
      selected: emptySelectedFilters(),
      sale: kind === "sale",
      page: 1,
      limit: 1,
    }),
    listCategories({ parent_category_id: "null" }),
  ])

  if (!count) return []

  const idsBySlug = new Map<string, string[]>()
  for (const c of categories) {
    const key = categorySlug(c.name ?? "")
    if (!key) continue
    idsBySlug.set(key, [...(idsBySlug.get(key) ?? []), c.id])
  }

  // Fațeta vine sortată descrescător după numărul de produse. „Diverse" e
  // coșul de resturi al importului: are produse cât să urce în față, dar e
  // ultimul tag pe care vrem să-l propunem clientului.
  const ordered = [...facets.category].sort(
    (a, b) => Number(isMiscCategory(a.value)) - Number(isMiscCategory(b.value))
  )

  const sources: Omit<RailTab, "products" | "hasMore">[] = [
    { id: "all", label: "Toate" },
    ...ordered.slice(0, maxTabs).map((f) => {
      const slug = categorySlug(f.value)
      return {
        id: slug || f.value,
        label: f.value,
        category: f.value,
        categoryIds: idsBySlug.get(slug) ?? [],
      }
    }),
  ]

  const tabs = await Promise.all(
    sources.map(async (source) => {
      const { products, hasMore } = await fetchRailPage(
        {
          kind,
          countryCode,
          category: source.category,
          categoryIds: source.categoryIds,
        },
        1,
        limit
      )
      return { ...source, products, hasMore }
    })
  )

  // Un tab fără produse (categorie rămasă doar cu produse ascunse, clasament
  // gol fără umplutură) ar fi un buton care golește secțiunea la click.
  return tabs.filter((t) => t.products.length > 0)
}
