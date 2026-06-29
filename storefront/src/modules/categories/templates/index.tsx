import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ArrowRight } from "@phosphor-icons/react/dist/ssr"

import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import MobileSortFab from "@modules/store/components/mobile-sort-fab"
import RefinementBar from "@modules/store/components/refinement-bar"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import type { SelectedFilters } from "@lib/util/product-filters"

export default function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
  filters,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
  filters?: SelectedFilters
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  const parents: HttpTypes.StoreProductCategory[] = []
  const collectParents = (cat: HttpTypes.StoreProductCategory) => {
    if (cat.parent_category) {
      parents.unshift(cat.parent_category)
      collectParents(cat.parent_category)
    }
  }
  collectParents(category)

  const directParent = parents[parents.length - 1]
  const eyebrow = directParent ? directParent.name : "Stanza"

  const children = category.category_children ?? []
  const hasChildren = children.length > 0

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
          Catalogo
        </LocalizedClientLink>
        {parents.map((parent) => (
          <span key={parent.id} className="flex items-center gap-2">
            <span className="text-brand-dark/30">/</span>
            <LocalizedClientLink
              href={`/categories/${parent.handle}`}
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
          <span className="hidden lg:inline text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50">
            {eyebrow}
          </span>
          <h1
            className="font-serif text-3xl sm:text-5xl lg:text-6xl text-brand-dark leading-[1.05]"
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

      {hasChildren && (
        <>
          <ul className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mb-5">
            {children.map((c) => (
              <li key={c.id} className="shrink-0">
                <LocalizedClientLink
                  href={`/categories/${c.handle}`}
                  className="group inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-light hover:bg-brand-dark transition-colors"
                >
                  <span className="font-bold text-sm text-brand-dark group-hover:text-white transition-colors whitespace-nowrap">
                    {c.name}
                  </span>
                  <ArrowRight
                    size={12}
                    weight="bold"
                    className="text-brand-dark/60 group-hover:text-white transition-colors"
                  />
                </LocalizedClientLink>
              </li>
            ))}
          </ul>

          <div className="hidden lg:block mb-10">
            <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50 mb-4">
              Sotto-categorie
            </h2>
            <ul className="grid grid-cols-3 lg:grid-cols-4 gap-4">
              {children.map((c) => (
                <li key={c.id}>
                  <LocalizedClientLink
                    href={`/categories/${c.handle}`}
                    className="group flex items-center justify-between gap-3 px-5 py-4 rounded-[1.25rem] bg-brand-light hover:bg-brand-dark transition-colors"
                  >
                    <span className="font-bold text-base text-brand-dark group-hover:text-white transition-colors truncate">
                      {c.name}
                    </span>
                    <span className="w-8 h-8 rounded-full bg-white/60 group-hover:bg-white/15 flex items-center justify-center text-brand-dark group-hover:text-white shrink-0 transition-colors">
                      <ArrowRight
                        size={14}
                        weight="bold"
                        className="group-hover:translate-x-0.5 transition-transform"
                      />
                    </span>
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

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
        />
      </Suspense>
    </section>
  )
}
