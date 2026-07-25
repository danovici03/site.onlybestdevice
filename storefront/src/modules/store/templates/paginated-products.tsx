import { listCatalog } from "@lib/data/products"
import {
  emptySelectedFilters,
  hasAnyFacet,
  type SelectedFilters,
} from "@lib/util/product-filters"
import ProductCard from "@modules/products/components/product-card"
import { Pagination } from "@modules/store/components/pagination"
import ProductFilters from "@modules/store/components/product-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

const PRODUCT_LIMIT = 12

export default async function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  categoryId,
  countryCode,
  filters,
  facetParentId,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryId?: string | string[]
  countryCode: string
  filters?: SelectedFilters
  /**
   * Categoria ale cărei sub-categorii sunt oferite ca fațetă. Lipsă (sau null)
   * = categoriile de top, cum e pe /store.
   */
  facetParentId?: string | null
}) {
  const selected = filters ?? emptySelectedFilters()

  const categoryIds = categoryId
    ? Array.isArray(categoryId)
      ? categoryId
      : [categoryId]
    : undefined

  const { products, count, facets } = await listCatalog({
    countryCode,
    categoryIds,
    collectionId,
    facetParentId,
    selected,
    sortBy: sortBy ?? "created_at",
    page,
    limit: PRODUCT_LIMIT,
  })

  const totalPages = Math.ceil(count / PRODUCT_LIMIT)

  return (
    <>
      {hasAnyFacet(facets) && (
        <ProductFilters
          facets={facets}
          selected={selected}
          resultCount={count}
        />
      )}

      {products.length === 0 ? (
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
            {products.map((p, idx) => (
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
