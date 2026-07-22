import { Suspense } from "react"
import { ArrowRight } from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"

import { getCategoryByHandle, listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
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

  const [topCategories, armadiCategory] = await Promise.all([
    listCategories({ parent_category_id: "null" }),
    getCategoryByHandle(["armadi"]).catch(() => null),
  ])

  // "Stanze" — only top-level categories that have sub-categories.
  // This naturally excludes the Medusa starter demo categories (merch,
  // sweatshirts, pants, shirts) which are flat with no children.
  const stanze = (topCategories as any[]).filter(
    (c) => (c.category_children?.length ?? 0) > 0
  )

  // Surface "Armadi" alongside the stanze even though it's a sub-category,
  // since it's a new tipologia we want highlighted on Store.
  const browseCategories: any[] = [...stanze]
  if (armadiCategory && !browseCategories.some((c) => c.id === (armadiCategory as any).id)) {
    browseCategories.push(armadiCategory)
  }

  // Fetch a representative product thumbnail for each browse tile, looking at
  // the category itself and all its immediate sub-categories.
  const browseThumbs = new Map<string, string>()
  const browseProductCounts = new Map<string, number>()
  await Promise.all(
    browseCategories.map(async (c) => {
      const catIds = [
        c.id,
        ...((c.category_children ?? []) as any[]).map((cc: any) => cc.id),
      ]
      const {
        response: { products, count },
      } = await listProducts({
        countryCode,
        queryParams: { category_id: catIds, limit: 1 } as any,
      })
      const thumb = products[0]?.thumbnail ?? products[0]?.images?.[0]?.url
      if (thumb) browseThumbs.set(c.id, thumb)
      browseProductCounts.set(c.id, count ?? 0)
    })
  )

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

      {browseCategories.length > 0 && (
        <div className="mb-8 lg:mb-10">
          <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50 mb-4">
            Răsfoiește pe categorii
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 lg:gap-5">
            {browseCategories.map((cat) => {
              const childCount = cat.category_children?.length ?? 0
              const productCount = browseProductCounts.get(cat.id) ?? 0
              const thumb = browseThumbs.get(cat.id)
              return (
                <li key={cat.id}>
                  <LocalizedClientLink
                    href={`/categories/${cat.handle}`}
                    className="group relative block aspect-[5/4] sm:aspect-[4/5] lg:aspect-[5/4] rounded-[1.5rem] overflow-hidden bg-brand-light"
                  >
                    {thumb ? (
                      <>
                        <Image
                          src={thumb}
                          alt={cat.name}
                          fill
                          sizes="(min-width: 1024px) 32vw, (min-width: 640px) 33vw, 50vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/85 via-brand-dark/20 to-transparent" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-light to-brand-dark/10" />
                    )}
                    <span className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center text-brand-dark opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight size={14} weight="bold" />
                    </span>
                    <div
                      className={`absolute inset-x-0 bottom-0 p-5 flex flex-col gap-1 ${
                        thumb ? "text-white" : "text-brand-dark"
                      }`}
                    >
                      <h3 className="font-serif text-2xl sm:text-3xl leading-tight">
                        {cat.name}
                      </h3>
                      <span
                        className={`text-[11px] uppercase tracking-[0.18em] font-bold ${
                          thumb ? "text-white/75" : "text-brand-dark/50"
                        }`}
                      >
                        {childCount > 0
                          ? `${childCount} ${childCount === 1 ? "tipologie" : "tipologii"}`
                          : `${productCount} ${productCount === 1 ? "produs" : "produse"}`}
                      </span>
                    </div>
                  </LocalizedClientLink>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <Suspense fallback={<SkeletonProductGrid />}>
        <PaginatedProducts
          sortBy={sort}
          page={pageNumber}
          countryCode={countryCode}
          filters={filters}
        />
      </Suspense>
    </section>
  )
}

export default StoreTemplate
