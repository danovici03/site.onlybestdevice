"use server"

import { sdk } from "@lib/config"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import {
  FILTER_KEYS,
  emptyFacets,
  serializePrice,
  type Facets,
  type SelectedFilters,
} from "@lib/util/product-filters"
import { getCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  // Fără getAuthHeaders(): catalogul e conținut public, iar citirea
  // cookie-ului de auth la prerender ar face toate paginile dinamice.
  // Prețurile per-client (customer groups) nu sunt folosite; dacă apar
  // vreodată, se afișează client-side, nu prin HTML-ul comun.
  const headers = {}

  const next = {
    ...(await getCacheOptions("products")),
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields:
            // Atenție: relațiile trebuie prefixate cu `+`/`*` — fără prefix,
            // Medusa înlocuiește setul default de câmpuri al produsului
            // (handle, title, thumbnail dispar).
            "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,+categories.id,+categories.name,+categories.parent_category_id,",
          ...queryParams,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null

      // Produsele „de serviciu" (ex. garanția extinsă) au metadata.hidden și
      // nu apar în listări (magazin, rail-uri, produse similare). Rămân
      // accesibile când sunt cerute explicit după handle sau id.
      const isDirectLookup = Boolean(queryParams?.handle || queryParams?.id)
      const visible = isDirectLookup
        ? products
        : products.filter(
            (p) => (p.metadata as Record<string, unknown> | null)?.hidden !== "true"
          )

      return {
        response: {
          products: visible,
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  const limit = queryParams?.limit || 12

  const {
    response: { products, count },
  } = await listProducts({
    pageParam: 0,
    queryParams: {
      ...queryParams,
      limit: 100,
    },
    countryCode,
  })

  const sortedProducts = sortProducts(products, sortBy)

  const pageParam = (page - 1) * limit

  const nextPage = count > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count,
    },
    nextPage,
    queryParams,
  }
}

/**
 * Catalog filtrat, servit de ruta custom `/store/catalog` din backend.
 *
 * Spre deosebire de `listProducts`, nu aduce tot catalogul ca să filtreze în
 * memorie: filtrarea, numărătoarea fațetelor și paginarea se fac în SQL, iar
 * peste rețea vine doar pagina curentă plus contoarele.
 */
export const listCatalog = async ({
  countryCode,
  categoryIds,
  collectionId,
  facetParentId,
  selected,
  q,
  sale,
  sortBy = "created_at",
  page = 1,
  limit = 12,
}: {
  countryCode: string
  categoryIds?: string[]
  collectionId?: string
  facetParentId?: string | null
  selected: SelectedFilters
  /** Doar produsele bifate „La ofertă" în admin. */
  sale?: boolean
  /** Căutare liberă; îngustează și fațetele, nu doar lista de produse. */
  q?: string
  sortBy?: SortOptions
  page?: number
  limit?: number
}): Promise<{ products: HttpTypes.StoreProduct[]; count: number; facets: Facets }> => {
  const region = await getRegion(countryCode)
  if (!region) {
    return { products: [], count: 0, facets: emptyFacets() }
  }

  const query: Record<string, string | string[] | number> = {
    region_id: region.id,
    sort: sortBy,
    page,
    limit,
  }
  if (categoryIds?.length) query.category_id = categoryIds
  if (collectionId) query.collection_id = collectionId
  if (sale) query.sale = "true"
  // Peste 120 de caractere `/store/catalog` respinge cererea cu 400, iar
  // clientul ar vedea „niciun rezultat" fără să înțeleagă de ce — un titlu de
  // produs lipit în bară trece ușor de limită. Tăiem în loc să refuzăm.
  const term = q?.trim().slice(0, 120)
  if (term) query.q = term
  // Absent = fațeta de categorie oferă nivelul de top.
  if (facetParentId) query.facet_parent_id = facetParentId

  for (const key of FILTER_KEYS) {
    // Array, nu CSV: valorile pot conține virgule (numele de categorii).
    if (selected[key].length) query[key] = selected[key]
  }
  const price = serializePrice(selected.price)
  if (price) query.price = price

  const headers = {}
  const next = { ...(await getCacheOptions("products")) }

  return sdk.client
    .fetch<{
      products: HttpTypes.StoreProduct[]
      count: number
      facets: Facets
    }>(`/store/catalog`, {
      method: "GET",
      query,
      headers,
      next,
      cache: "force-cache",
    })
    .catch((e) => {
      // Fără log, un catalog picat arată exact ca „niciun produs găsit".
      console.error("[catalog] cererea a eșuat:", e?.message ?? e)
      return { products: [], count: 0, facets: emptyFacets() }
    })
}
