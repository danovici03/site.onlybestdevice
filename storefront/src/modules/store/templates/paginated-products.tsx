import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { sortProducts } from "@lib/util/sort-products"
import {
  applyFilters,
  computeFacets,
  emptySelectedFilters,
  hasAnyFacet,
  type SelectedFilters,
} from "@lib/util/product-filters"
import ProductCard from "@modules/products/components/product-card"
import { Pagination } from "@modules/store/components/pagination"
import ProductFilters from "@modules/store/components/product-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

const PRODUCT_LIMIT = 12
// Câte produse aducem pentru fațete + filtrare (filtrarea e în memorie, peste
// acest set). Setat ca să acopere tot catalogul (≈600 produse) într-o singură
// cerere cache-uită, ca fațetele și filtrarea să fie complete — nu doar un eșantion.
const FETCH_LIMIT = 1000

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  order?: string
}

export default async function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  categoryId,
  productsIds,
  countryCode,
  filters,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryId?: string | string[]
  productsIds?: string[]
  countryCode: string
  filters?: SelectedFilters
}) {
  const selected = filters ?? emptySelectedFilters()

  const queryParams: PaginatedProductsParams = {
    limit: FETCH_LIMIT,
  }

  if (collectionId) {
    queryParams["collection_id"] = [collectionId]
  }

  if (categoryId) {
    queryParams["category_id"] = Array.isArray(categoryId)
      ? categoryId
      : [categoryId]
  }

  if (productsIds) {
    queryParams["id"] = productsIds
  }

  if (sortBy === "created_at") {
    queryParams["order"] = "created_at"
  }

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  const {
    response: { products: fetched },
  } = await listProducts({
    pageParam: 0,
    queryParams,
    countryCode,
  })

  // Sortează tot setul, calculează fațetele din el (stabile), apoi filtrează.
  const allSorted = sortProducts(fetched, sortBy ?? "created_at")
  const facets = computeFacets(allSorted)
  const filtered = applyFilters(allSorted, selected)

  const totalPages = Math.ceil(filtered.length / PRODUCT_LIMIT)
  const offset = (page - 1) * PRODUCT_LIMIT
  const pageItems = filtered.slice(offset, offset + PRODUCT_LIMIT)

  return (
    <>
      {hasAnyFacet(facets) && (
        <ProductFilters
          facets={facets}
          selected={selected}
          resultCount={filtered.length}
        />
      )}

      {pageItems.length === 0 ? (
        <div className="w-full rounded-[2rem] border border-brand-dark/10 bg-brand-light/50 p-12 text-center">
          <p className="font-serif text-2xl text-brand-dark">
            Niciun produs găsit
          </p>
          <p className="text-brand-dark/60 mt-2 text-sm">
            Încearcă să modifici filtrele sau revino la tot catalogul.
          </p>
        </div>
      ) : (
        <>
          <ul
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 w-full"
            data-testid="products-list"
          >
            {pageItems.map((p, idx) => (
              <li key={p.id} className="h-full">
                <ProductCard product={p} priority={idx < 4} />
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <Pagination
              data-testid="product-pagination"
              page={page}
              totalPages={totalPages}
            />
          )}
        </>
      )}
    </>
  )
}
