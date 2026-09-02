import { sdk } from "@lib/config"
import { categorySlug } from "@lib/util/category-slug"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listCategories = async (query?: Record<string, any>) => {
  const next = {
    ...(await getCacheOptions("categories")),
  }

  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories)
}

type CategoryNode = {
  id: string
  handle: string
  name: string
  parent_category_id: string | null
}

/** Un nivel din calea unei categorii, pentru breadcrumb și URL canonic. */
export type CategoryCrumb = { slug: string; handle: string; name: string }

/**
 * Toate categoriile reduse la (id, handle, părinte) — câteva zeci de rânduri,
 * cache-uite alături de restul datelor de categorii.
 *
 * Ruta `/store/product-categories` nu întoarce lanțul de părinți mai adânc de
 * un nivel (`*parent_category.parent_category` e ignorat în silence), așa că
 * ierarhia se reconstruiește local din lista plată.
 *
 * Întoarce `null` când backend-ul nu răspunde — deliberat diferit de lista
 * goală. Cine rezolvă un URL de categorie trebuie să poată deosebi „categoria
 * nu există" (404 legitim) de „n-am putut întreba" (indisponibilitate
 * temporară): un 404 servit în fereastra de redeploy scoate pagina din index,
 * pe când un 5xx e doar reîncercat de crawleri.
 */
const listCategoryNodes = async (): Promise<CategoryNode[] | null> => {
  const next = {
    ...(await getCacheOptions("categories")),
  }

  return sdk.client
    .fetch<{ product_categories: CategoryNode[] }>(
      "/store/product-categories",
      {
        query: { fields: "id,handle,name,parent_category_id", limit: 1000 },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories ?? [])
    .catch((e) => {
      console.error(
        "[categorii] lista de categorii n-a putut fi citită:",
        e?.message ?? e
      )
      return null
    })
}

const crumbOf = (n: CategoryNode): CategoryCrumb => ({
  slug: categorySlug(n.name),
  handle: n.handle,
  name: n.name,
})

/**
 * Calea de la rădăcină până la categorie, inclusiv — URL-ul canonic
 * („telefoane-mobile/apple/iphone-16") plus numele pentru breadcrumb.
 */
export const getCategoryPath = async (
  categoryId: string
): Promise<CategoryCrumb[]> => {
  // Aici lipsa datelor e recuperabilă: fără cale, apelantul păstrează url-ul
  // cerut și sare peste breadcrumb — nu merită să pice pagina pentru atât.
  const nodes = (await listCategoryNodes()) ?? []
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const path: CategoryCrumb[] = []
  const seen = new Set<string>()
  let cur = byId.get(categoryId)
  // `seen` oprește urcarea dacă datele conțin o buclă de părinți.
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    path.unshift(crumbOf(cur))
    cur = cur.parent_category_id ? byId.get(cur.parent_category_id) : undefined
  }
  return path
}

/** Calea ca segmente de URL — slug-uri curate, fără sufixul de dezambiguizare. */
export const categoryPathSegments = (path: CategoryCrumb[]): string[] =>
  path.map((c) => c.slug)

/**
 * Rezolvă segmentele de URL la o categorie, coborând prin ierarhie.
 *
 * Fiecare segment se caută **între copiii nodului curent** (rădăcinile, pentru
 * primul), potrivind pe slug-ul numelui sau pe handle. Astfel
 * `/categories/tablete/apple` și `/categories/laptop/apple` duc la două
 * categorii diferite, deși handle-urile din baza de date rămân dezambiguizate
 * (`apple-tablete`, `apple-laptop`).
 *
 * Potrivirea pe handle e păstrată ca să nu rupem URL-urile deja publicate cu
 * sufix (`/categories/tablete/apple-tablete`) — apelantul compară calea cerută
 * cu `path` și face 308 către forma canonică.
 *
 * Un singur segment se caută în toată ierarhia, nu doar între rădăcini: forma
 * plată `/categories/apple-tablete` a fost multă vreme singura care funcționa.
 *
 * Aruncă dacă lista de categorii nu poate fi citită. Pare aspru, dar
 * alternativa e mai rea: apelantul ar da `notFound()`, adică un 404 pe o
 * categorie care există — exact răspunsul care scoate pagina din index dacă
 * nimerește un crawler în fereastra de redeploy.
 */
export class CategoriesUnavailableError extends Error {
  constructor() {
    super("Lista de categorii nu e disponibilă (backend inaccesibil).")
    this.name = "CategoriesUnavailableError"
  }
}

const resolveSegments = async (
  segments: string[]
): Promise<CategoryNode | undefined> => {
  const nodes = await listCategoryNodes()
  if (nodes === null) {
    throw new CategoriesUnavailableError()
  }
  if (!nodes.length || !segments.length) {
    return undefined
  }

  const childrenOf = new Map<string | null, CategoryNode[]>()
  for (const n of nodes) {
    const key = n.parent_category_id ?? null
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), n])
  }

  const matches = (n: CategoryNode, seg: string) =>
    n.handle === seg || categorySlug(n.name) === seg

  let cur: CategoryNode | undefined
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const pool = childrenOf.get(cur?.id ?? null) ?? []
    let next = pool.find((n) => matches(n, seg))

    // Un singur segment: acceptăm și o categorie de orice adâncime (forma
    // plată). Cu mai multe segmente, calea trebuie să fie reală.
    if (!next && i === 0 && segments.length === 1) {
      next = nodes.find((n) => matches(n, seg))
    }

    if (!next) {
      return undefined
    }
    cur = next
  }
  return cur
}

/**
 * Categoria din segmentele de URL, ierarhic sau plat.
 *
 * Varianta din starter cerea `handle: "telefoane-mobile/apple"` — o cale
 * lipită, care nu corespundea niciunui handle Medusa (acelea sunt plate), deci
 * orice URL ierarhic dădea 404.
 */
export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const node = await resolveSegments(categoryHandle)
  if (!node) {
    return undefined
  }

  const next = {
    ...(await getCacheOptions("categories")),
  }

  // Nodul din lista plată n-are copiii și produsele; le cerem pe handle-ul
  // real, care e unic.
  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products",
          handle: node.handle,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories[0])
}

/**
 * Rădăcini care nu spun nimic despre produs: „Oferte" e o etichetă comercială,
 * iar „Fără categorie" e groapa de gunoi a importului. Aceleași excluse ca
 * fațeta de categorie din backend (`CATEGORY_FACET_BLOCKLIST`).
 */
const BREADCRUMB_ROOT_BLOCKLIST = new Set(["oferte", "fara-categorie"])

/**
 * Calea celei mai adânci categorii a unui produs — baza breadcrumb-ului de pe
 * pagina produsului. Un produs e legat și de părinți („Telefoane mobile") și de
 * frunză („Samsung"); pentru breadcrumb ne interesează lanțul cel mai lung.
 */
export const getProductCategoryPath = async (
  categories?: { id?: string }[] | null
): Promise<CategoryCrumb[]> => {
  const ids = (categories ?? [])
    .map((c) => c?.id)
    .filter((id): id is string => !!id)

  if (!ids.length) {
    return []
  }

  const paths = await Promise.all(ids.map((id) => getCategoryPath(id)))
  const usable = paths.filter(
    (p) => p.length && !BREADCRUMB_ROOT_BLOCKLIST.has(p[0].slug)
  )

  return (usable.length ? usable : paths).reduce<CategoryCrumb[]>(
    (best, p) => (p.length > best.length ? p : best),
    []
  )
}
