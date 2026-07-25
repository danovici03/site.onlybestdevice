import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import MobileSortFab from "@modules/store/components/mobile-sort-fab"
import RefinementBar from "@modules/store/components/refinement-bar"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import type { SelectedFilters } from "@lib/util/product-filters"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = async ({
  sortBy,
  page,
  countryCode,
  filters,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  filters?: SelectedFilters
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  return (
    <section
      className="content-container py-5 lg:py-12"
      data-testid="category-container"
    >
      <div className="flex flex-col gap-4 lg:gap-6 lg:flex-row lg:items-end lg:justify-between mb-5 lg:mb-10">
        <header className="flex flex-col gap-2 sm:gap-4 max-w-2xl">
          <span className="hidden lg:inline text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50">
            Catalog
          </span>
          <h1
            className="font-serif text-3xl sm:text-5xl lg:text-6xl text-brand-dark leading-[1.05]"
            data-testid="store-page-title"
          >
            Toate produsele
          </h1>
          <p className="text-brand-dark/60 font-medium text-sm sm:text-base leading-relaxed line-clamp-2 sm:line-clamp-none">
            Explorează întreaga gamă onlybestdevice — device-uri alese cu grijă
            pentru tine.
          </p>
        </header>

        <div className="hidden lg:block lg:pb-2">
          <RefinementBar sortBy={sort} />
        </div>
      </div>

      <MobileSortFab sortBy={sort} />

      <Suspense fallback={<SkeletonProductGrid />}>
        <PaginatedProducts
          sortBy={sort}
          page={pageNumber}
          countryCode={countryCode}
          filters={filters}
          categoryScope={{ parentId: null }}
        />
      </Suspense>
    </section>
  )
}

export default StoreTemplate
