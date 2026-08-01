import { listProductReviews, type ReviewSort } from "@lib/data/reviews"
import Link from "next/link"

import ReviewSummary from "./review-summary"
import ReviewItem from "./review-item"
import ReviewPanel from "./review-panel"
import ReviewSortControl from "./review-sort"

type Props = {
  productId: string
  countryCode: string
  // Pagina de produs NU mai pasează sort/page din searchParams — citirea lor
  // ar face toate paginile de produs dinamice. Pagina statică servește mereu
  // sortarea implicită; când apar destule recenzii cât să conteze sortarea,
  // lista trebuie mutată pe fetch client-side (ReviewSortControl navighează cu
  // ?review_sort=, dar pe o pagină statică query-ul nu re-randează serverul).
  sort?: string
  page?: string
}

const PAGE_SIZE = 6

const normalizeSort = (s?: string): ReviewSort => {
  if (s === "highest" || s === "lowest") return s
  return "recent"
}

const ProductReviews = async ({
  productId,
  countryCode,
  sort,
  page,
}: Props) => {
  const normalizedSort = normalizeSort(sort)
  const pageNum = Math.max(1, Number(page) || 1)
  const offset = (pageNum - 1) * PAGE_SIZE

  // Fără date per-utilizator aici: componenta se randează la build și intră în
  // cache-ul comun al paginii. Cine e vizitatorul și dacă are deja o recenzie
  // se decid în browser, în `ReviewPanel`.
  const data = await listProductReviews(productId, {
    limit: PAGE_SIZE,
    offset,
    sort: normalizedSort,
  })

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))

  // Randat ca panou în acordeonul „Detalii produs" (product-tabs) — titlul și
  // ancora #reviews stau pe <details>, aici doar conținutul.
  return (
    <div data-testid="product-reviews">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-7 flex flex-col gap-6 lg:gap-8">
          <ReviewSummary stats={data.stats} />

          {data.stats.total > 0 && (
            <div className="flex flex-col">
              <div className="flex justify-end mb-2">
                <ReviewSortControl current={normalizedSort} />
              </div>
              {data.reviews.map((r) => (
                <ReviewItem key={r.id} review={r} />
              ))}

              {totalPages > 1 && <Pagination
                page={pageNum}
                totalPages={totalPages}
                sort={normalizedSort}
              />}
            </div>
          )}
        </div>

        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-28 flex flex-col gap-4">
            <ReviewPanel productId={productId} />

            <PolicyCard />
          </div>
        </aside>
      </div>
    </div>
  )
}

const PolicyCard = () => (
  <div className="rounded-[2rem] border border-brand-dark/10 p-6 text-xs text-brand-dark/60 leading-relaxed">
    <p className="font-bold text-brand-dark/80 mb-1">
      Cum gestionăm recenziile
    </p>
    Recenziile sunt publicate doar după o achiziție verificată sau o verificare
    manuală. Nu ștergem și nu modificăm recenziile negative dacă respectă
    regulile noastre.
  </div>
)

const Pagination = ({
  page,
  totalPages,
  sort,
}: {
  page: number
  totalPages: number
  sort: ReviewSort
}) => {
  const buildHref = (p: number) => {
    const params = new URLSearchParams()
    if (sort !== "recent") params.set("review_sort", sort)
    if (p !== 1) params.set("review_page", String(p))
    const qs = params.toString()
    return qs ? `?${qs}#reviews` : "#reviews"
  }

  return (
    <nav
      className="flex items-center justify-center gap-2 mt-8"
      aria-label="Paginare recenzii"
    >
      {page > 1 && (
        <Link
          href={buildHref(page - 1)}
          className="px-4 py-2 rounded-full border border-brand-dark/10 hover:border-brand-accent text-sm transition-colors"
          scroll={false}
        >
          Anterioare
        </Link>
      )}
      <span className="px-4 py-2 text-sm text-brand-dark/60">
        Pagina {page} din {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={buildHref(page + 1)}
          className="px-4 py-2 rounded-full border border-brand-dark/10 hover:border-brand-accent text-sm transition-colors"
          scroll={false}
        >
          Următoarele
        </Link>
      )}
    </nav>
  )
}

export default ProductReviews
