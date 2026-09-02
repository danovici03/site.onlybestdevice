import { notFound } from "next/navigation"
import { Suspense } from "react"

import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import MobileSortFab from "@modules/store/components/mobile-sort-fab"
import RefinementBar from "@modules/store/components/refinement-bar"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import type { CategoryCrumb } from "@lib/data/categories"
import type { SelectedFilters } from "@lib/util/product-filters"

export default function CategoryTemplate({
  category,
  path = [],
  sortBy,
  page,
  countryCode,
  filters,
}: {
  category: HttpTypes.StoreProductCategory
  /** Calea de la rădăcină până la categoria curentă, inclusiv. */
  path?: CategoryCrumb[]
  sortBy?: SortOptions
  page?: string
  countryCode: string
  filters?: SelectedFilters
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  // Strămoșii cu URL-ul lor ierarhic: fiecare crumb linkează calea de la
  // rădăcină până la el, nu doar handle-ul propriu.
  const ancestors = path.slice(0, -1).map((crumb, i) => ({
    ...crumb,
    href: `/categories/${path
      .slice(0, i + 1)
      .map((c) => c.slug)
      .join("/")}`,
  }))

  const collectDescendantIds = (
    cat: HttpTypes.StoreProductCategory
  ): string[] => {
    const out = [cat.id]
    for (const c of cat.category_children ?? []) {
      out.push(...collectDescendantIds(c))
    }
    return out
  }
  const categoryIds = collectDescendantIds(category)

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
        {ancestors.map((parent) => (
          <span key={parent.handle} className="flex items-center gap-2">
            <span className="text-brand-dark/30">/</span>
            <LocalizedClientLink
              href={parent.href}
              className="hover:text-brand-dark transition-colors"
            >
              {parent.name}
            </LocalizedClientLink>
          </span>
        ))}
        <span className="flex items-center gap-2">
          <span className="text-brand-dark/30">/</span>
          <span className="text-brand-dark/80">{category.name}</span>
        </span>
      </nav>

      <div className="flex flex-col gap-4 lg:gap-6 lg:flex-row lg:items-end lg:justify-between mb-5 lg:mb-10">
        <header className="flex flex-col gap-2 sm:gap-4 max-w-2xl">
          <h1
            className="font-serif text-2xl sm:text-3xl lg:text-4xl text-brand-dark leading-tight"
            data-testid="category-page-title"
          >
            {category.name}
          </h1>
          {category.description && (
            <p className="text-brand-dark/60 font-medium text-sm sm:text-base leading-relaxed line-clamp-2 sm:line-clamp-none">
              {category.description}
            </p>
          )}
        </header>

        <div className="hidden lg:block lg:pb-2">
          <RefinementBar sortBy={sort} />
        </div>
      </div>

      {/* Subcategoriile (mărcile) nu mai apar ca șir de chips sub titlu:
          aceleași valori sunt în filtre, unde se combină cu preț și stoc.
          Paginile /categories/tablete/apple rămân valide, doar că se ajunge
          la ele din filtre și din meniu, nu dintr-un rând de butoane care
          ocupa două rânduri pe mobil. */}
      <MobileSortFab sortBy={sort} />

      <Suspense
        fallback={
          <SkeletonProductGrid
            numberOfProducts={category.products?.length ?? 8}
          />
        }
      >
        <PaginatedProducts
          sortBy={sort}
          page={pageNumber}
          categoryId={categoryIds.length > 1 ? categoryIds : category.id}
          countryCode={countryCode}
          filters={filters}
          facetParentId={category.id}
        />
      </Suspense>
    </section>
  )
}
