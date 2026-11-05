import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import MobileSortFab from "@modules/store/components/mobile-sort-fab"
import RefinementBar from "@modules/store/components/refinement-bar"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import type { SelectedFilters } from "@lib/util/product-filters"

import { SECOND_HAND_TAG } from "@lib/util/second-hand"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = async ({
  sortBy,
  page,
  countryCode,
  filters,
  q,
  sale,
  secondHand,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  filters?: SelectedFilters
  /** Prezent pe /search: aceeași listă, îngustată de căutare. */
  q?: string
  /** Prezent pe /oferte: doar produsele bifate „La ofertă" în admin. */
  sale?: boolean
  /** Prezent pe /second-hand: doar produsele bifate „Second Hand”. */
  secondHand?: boolean
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"
  const term = q?.trim()

  const eyebrow = term
    ? "Rezultate pentru"
    : sale
      ? "Oferte"
      : secondHand
        ? "Second Hand"
        : "Catalog"
  // Pe căutare titlul e doar termenul: „Rezultate pentru …" ca titlu era o
  // frază lungă care se rupea pe două rânduri și împingea bara de sortare.
  const heading = term ? (
    <>„{term}”</>
  ) : sale ? (
    "Ofertele săptămânii"
  ) : secondHand ? (
    "Telefoane second hand"
  ) : (
    "Toate produsele"
  )
  const lead = term
    ? "Filtrează rezultatele după marcă, preț sau categorie."
    : sale
      ? "Produsele alese de noi, la preț redus — stoc limitat."
      : secondHand
        ? "Produse folosite, verificate și testate de noi — cu garanție, grad de aspect și sănătatea bateriei afișate la fiecare."
        : "Explorează întreaga gamă Onlybestdevice — device-uri alese cu grijă pentru tine."

  return (
    <section
      className="content-container py-5 lg:py-12"
      data-testid="category-container"
    >
      <div className="flex flex-col gap-4 lg:gap-6 lg:flex-row lg:items-end lg:justify-between mb-5 lg:mb-10">
        <header className="flex flex-col gap-2 sm:gap-4 max-w-2xl">
          <span className="text-[11px] lg:text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50">
            {eyebrow}
          </span>
          <h1
            className="font-serif text-2xl sm:text-3xl lg:text-4xl text-brand-dark leading-tight break-words"
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
          tag={secondHand ? SECOND_HAND_TAG : undefined}
        />
      </Suspense>
    </section>
  )
}

export default StoreTemplate
