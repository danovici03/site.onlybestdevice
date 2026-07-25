import { Suspense } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import MobileSortFab from "@modules/store/components/mobile-sort-fab"
import RefinementBar from "@modules/store/components/refinement-bar"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import { HttpTypes } from "@medusajs/types"
import type { SelectedFilters } from "@lib/util/product-filters"

export default function CollectionTemplate({
  sortBy,
  collection,
  page,
  countryCode,
  filters,
}: {
  sortBy?: SortOptions
  collection: HttpTypes.StoreCollection
  page?: string
  countryCode: string
  filters?: SelectedFilters
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <section
      className="content-container py-5 lg:py-12"
      data-testid="category-container"
    >
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-[0.2em] font-bold text-brand-dark/50 mb-4 lg:mb-8"
      >
        <LocalizedClientLink
          href="/store"
          className="hover:text-brand-dark transition-colors"
        >
          Catalog
        </LocalizedClientLink>
        <span className="flex items-center gap-2">
          <span className="text-brand-dark/30">/</span>
          <span className="text-brand-dark/80">{collection.title}</span>
        </span>
      </nav>

      <div className="flex flex-col gap-4 lg:gap-6 lg:flex-row lg:items-end lg:justify-between mb-5 lg:mb-10">
        <header className="flex flex-col gap-2 sm:gap-4 max-w-2xl">
          <span className="hidden lg:inline text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50">
            Colecție
          </span>
          <h1
            className="font-serif text-3xl sm:text-5xl lg:text-6xl text-brand-dark leading-[1.05]"
            data-testid="collection-page-title"
          >
            {collection.title}
          </h1>
        </header>

        <div className="hidden lg:block lg:pb-2">
          <RefinementBar sortBy={sort} />
        </div>
      </div>

      <MobileSortFab sortBy={sort} />

      <Suspense
        fallback={
          <SkeletonProductGrid
            numberOfProducts={collection.products?.length}
          />
        }
      >
        <PaginatedProducts
          sortBy={sort}
          page={pageNumber}
          collectionId={collection.id}
          countryCode={countryCode}
          filters={filters}
          categoryScope={{ parentId: null }}
        />
      </Suspense>
    </section>
  )
}
