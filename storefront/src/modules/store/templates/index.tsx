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
  q,
  sale,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  filters?: SelectedFilters
  /** Prezent pe /search: aceeași listă, îngustată de căutare. */
  q?: string
  /** Prezent pe /oferte: doar produsele bifate „La ofertă" în admin. */
  sale?: boolean
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"
  const term = q?.trim()

  const eyebrow = term ? "Căutare" : sale ? "Oferte" : "Catalog"
  const heading = term ? (
    <>Rezultate pentru „{term}”</>
  ) : sale ? (
    "Ofertele săptămânii"
  ) : (
    "Toate produsele"
  )
  const lead = term
    ? "Filtrează rezultatele după marcă, preț sau categorie."
    : sale
      ? "Produsele alese de noi, la preț redus — stoc limitat."
      : "Explorează întreaga gamă onlybestdevice — device-uri alese cu grijă pentru tine."

  return (
    <section
      className="content-container py-5 lg:py-12"
      data-testid="category-container"
    >
      <div className="flex flex-col gap-4 lg:gap-6 lg:flex-row lg:items-end lg:justify-between mb-5 lg:mb-10">
        <header className="flex flex-col gap-2 sm:gap-4 max-w-2xl">
          <span className="hidden lg:inline text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50">
            {eyebrow}
          </span>
          <h1
            className="font-serif text-3xl sm:text-5xl lg:text-6xl text-brand-dark leading-[1.05]"
            data-testid="store-page-title"
          >
            {heading}
          </h1>
          <p className="text-brand-dark/60 font-medium text-sm sm:text-base leading-relaxed line-clamp-2 sm:line-clamp-none">
            {lead}
          </p>
        </header>

        <div className="hidden lg:block lg:pb-2">
          <RefinementBar sortBy={sort} />
        </div>
      </div>

      <MobileSortFab sortBy={sort} />

      {/* `key` forțează un Suspense nou la fiecare căutare — altfel React
          păstrează grila veche pe ecran cât se încarcă rezultatele noi, iar
          scrisul în bară pare că n-a făcut nimic. */}
      <Suspense key={term ?? ""} fallback={<SkeletonProductGrid />}>
        <PaginatedProducts
          sortBy={sort}
          page={pageNumber}
          countryCode={countryCode}
          filters={filters}
          facetParentId={null}
          q={term}
          sale={sale}
        />
      </Suspense>
    </section>
  )
}

export default StoreTemplate
