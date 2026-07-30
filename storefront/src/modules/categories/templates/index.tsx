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
import { categorySlug } from "@lib/util/category-slug"
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

  const directParent = ancestors[ancestors.length - 1]
  const eyebrow = directParent ? directParent.name : "Catalog"

  // Slug-uri, nu handle-uri: URL-ul canonic al unei subcategorii e
  // /categories/tablete/apple, nu /categories/tablete/apple-tablete.
  const currentPath = path.length
    ? path.map((c) => c.slug)
    : [categorySlug(category.name ?? "")]

  const children = (category.category_children ?? []).filter(
    (c): c is HttpTypes.StoreProductCategory & { name: string } =>
      Boolean(c?.name)
  )

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

      {children.length > 0 && (
        <nav
          aria-label="Subcategorii"
          className="flex flex-wrap gap-2 mb-5 lg:mb-8"
          data-testid="subcategory-links"
        >
          {children.map((child) => (
            <LocalizedClientLink
              key={child.id}
              href={`/categories/${[
                ...currentPath,
                categorySlug(child.name),
              ].join("/")}`}
              className="rounded-full border border-brand-dark/15 px-4 py-2 text-sm font-medium text-brand-dark/70 transition-colors hover:border-brand-dark/40 hover:text-brand-dark"
            >
              {child.name}
            </LocalizedClientLink>
          ))}
        </nav>
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
          facetParentId={category.id}
        />
      </Suspense>
    </section>
  )
}
