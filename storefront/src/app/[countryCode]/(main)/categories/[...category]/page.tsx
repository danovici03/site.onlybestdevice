import { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"

import {
  CategoriesUnavailableError,
  categoryPathSegments,
  getCategoryByHandle,
  getCategoryPath,
  listCategories,
} from "@lib/data/categories"
import { categorySlug } from "@lib/util/category-slug"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import CategoryTemplate from "@modules/categories/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { parseSelectedFilters } from "@lib/util/product-filters"
import { failStaticParams } from "@lib/util/static-params"

type Props = {
  params: Promise<{ category: string[]; countryCode: string }>
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
    // Fațetele cu selecție multiplă vin ca parametru repetat, deci și ca array.
    category?: string | string[]
    brand?: string | string[]
    storage?: string | string[]
    ram?: string | string[]
    color?: string | string[]
    price?: string
  }>
}

export async function generateStaticParams() {
  try {
    const product_categories = await listCategories()

    if (!product_categories) {
      return []
    }

    const countryCodes = await listRegions().then((regions: StoreRegion[]) =>
      regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
    )

    // Calea canonică (slug-uri, nu handle-uri): o subcategorie trăiește la
    // /categories/telefoane-mobile/apple, nu /categories/apple-tablete.
    const byId = new Map<string, any>(
      product_categories.map((c: any) => [c.id, c])
    )
    const pathOf = (category: any): string[] => {
      const path: string[] = []
      const seen = new Set<string>()
      let cur: any = category
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id)
        path.unshift(categorySlug(cur.name))
        cur = cur.parent_category?.id ? byId.get(cur.parent_category.id) : null
      }
      return path
    }

    const staticParams = countryCodes
      ?.map((countryCode: string | undefined) =>
        product_categories.map((category: any) => ({
          countryCode,
          category: pathOf(category),
        }))
      )
      .flat()

    return staticParams
  } catch (error) {
    failStaticParams("categorii", error)
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params

  // `notFound()` stă în afara try-ului: el semnalează prin excepție, iar un
  // catch care înghite tot l-ar transforma exact în ce vrem să evităm.
  let productCategory
  try {
    productCategory = await getCategoryByHandle(params.category)
  } catch (error) {
    // Backend-ul inaccesibil NU e un 404: lăsăm eroarea să urce, ca pagina să
    // răspundă 5xx și crawlerul să revină, în loc să creadă că a dispărut
    // categoria.
    if (error instanceof CategoriesUnavailableError) {
      throw error
    }
    productCategory = undefined
  }

  if (!productCategory) {
    notFound()
  }

  const description =
    productCategory.description ?? `Categoria ${productCategory.name}.`

  // Canonic e calea ierarhică completă, nu segmentele cerute: forma plată
  // (`/categories/apple`) rămâne accesibilă, dar nu se indexează separat.
  const path = await getCategoryPath(productCategory.id)

  return {
    title: productCategory.name,
    description,
    alternates: {
      canonical: `/categories/${(path.length
        ? categoryPathSegments(path)
        : params.category
      ).join("/")}`,
    },
  }
}

export default async function CategoryPage(props: Props) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { sortBy, page } = searchParams
  const filters = parseSelectedFilters(searchParams)

  const productCategory = await getCategoryByHandle(params.category)

  if (!productCategory) {
    notFound()
  }

  // Calea completă vine de aici, nu din `parent_category`: API-ul nu întoarce
  // decât un nivel de părinte, deci breadcrumb-ul unei categorii de nivel 3 ar
  // pierde bunicul.
  const path = await getCategoryPath(productCategory.id)
  const canonical = categoryPathSegments(path)

  // O categorie are exact un URL. Formele vechi — cea plată (`/categories/apple-tablete`)
  // și cea cu handle-ul sufixat (`/categories/tablete/apple-tablete`) — se
  // rezolvă în continuare, dar pleacă mai departe cu 308 spre forma canonică,
  // ca să nu se indexeze aceeași pagină de mai multe ori.
  if (canonical.length && canonical.join("/") !== params.category.join("/")) {
    // Filtrele merg cu noi: un link salvat către o categorie filtrată trebuie
    // să ajungă tot pe rezultatele filtrate, nu pe catalogul întreg.
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (value == null) continue
      for (const v of Array.isArray(value) ? value : [value]) qs.append(key, v)
    }
    const query = qs.toString()
    permanentRedirect(
      `/${params.countryCode}/categories/${canonical.join("/")}${
        query ? `?${query}` : ""
      }`
    )
  }

  return (
    <CategoryTemplate
      category={productCategory}
      path={path}
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      filters={filters}
    />
  )
}
