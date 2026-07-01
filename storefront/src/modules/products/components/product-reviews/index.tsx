import {
  listProductReviews,
  retrieveOwnReview,
  type ReviewSort,
} from "@lib/data/reviews"
import { retrieveCustomer } from "@lib/data/customer"
import Link from "next/link"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Lock, Clock, CheckCircle, XCircle } from "@phosphor-icons/react/dist/ssr"

import ReviewSummary from "./review-summary"
import ReviewItem from "./review-item"
import ReviewForm from "./review-form"
import ReviewSortControl from "./review-sort"

type Props = {
  productId: string
  countryCode: string
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

  const [data, customer, ownReview] = await Promise.all([
    listProductReviews(productId, {
      limit: PAGE_SIZE,
      offset,
      sort: normalizedSort,
    }),
    retrieveCustomer().catch(() => null),
    retrieveOwnReview(productId).catch(() => null),
  ])

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))

  const loginHref = `/${countryCode}/account?redirect=/${countryCode}#reviews`

  return (
    <section
      id="reviews"
      className="content-container my-12 lg:my-24 scroll-mt-28"
      data-testid="product-reviews"
    >
      <header className="flex items-end justify-between mb-6 lg:mb-8 flex-wrap gap-3">
        <h2 className="font-serif text-2xl lg:text-4xl text-brand-dark">
          Recenziile clienților
        </h2>
        {data.stats.total > 0 && (
          <ReviewSortControl current={normalizedSort} />
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-7 flex flex-col gap-6 lg:gap-8">
          <ReviewSummary stats={data.stats} />

          {data.stats.total > 0 && (
            <div className="flex flex-col">
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
            {!customer ? (
              <LoginPrompt loginHref={loginHref} />
            ) : ownReview ? (
              <OwnReviewBanner review={ownReview} />
            ) : (
              <ReviewForm productId={productId} />
            )}

            <PolicyCard />
          </div>
        </aside>
      </div>
    </section>
  )
}

const LoginPrompt = ({ loginHref }: { loginHref: string }) => (
  <div className="bg-brand-light rounded-3xl lg:rounded-[2rem] p-6 lg:p-10 flex flex-col gap-3 lg:gap-4">
    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-brand-accent/15 flex items-center justify-center text-brand-accent">
      <Lock size={20} weight="duotone" />
    </div>
    <h3 className="font-serif text-xl lg:text-2xl text-brand-dark">
      Doar pentru clienții înregistrați
    </h3>
    <p className="text-sm text-brand-dark/60 leading-relaxed">
      Pentru a garanta autenticitatea recenziilor, doar clienții cu cont pot
      publica părerea lor. Autentifică-te sau creează-ți un cont în câteva
      secunde.
    </p>
    <LocalizedClientLink
      href="/account"
      className="self-start inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-6 py-3 text-sm font-bold hover:bg-brand-accent transition-colors"
    >
      Autentifică-te ca să scrii o recenzie
    </LocalizedClientLink>
  </div>
)

const OwnReviewBanner = ({
  review,
}: {
  review: NonNullable<Awaited<ReturnType<typeof retrieveOwnReview>>>
}) => {
  const icon =
    review.status === "approved" ? (
      <CheckCircle size={22} weight="duotone" />
    ) : review.status === "rejected" ? (
      <XCircle size={22} weight="duotone" />
    ) : (
      <Clock size={22} weight="duotone" />
    )
  const title =
    review.status === "approved"
      ? "Recenzia ta este publicată"
      : review.status === "rejected"
        ? "Recenzie nepublicată"
        : "Recenzie în moderare"
  const body =
    review.status === "approved"
      ? "Mulțumim că ți-ai împărtășit experiența. Părerea ta îi ajută pe ceilalți clienți să aleagă."
      : review.status === "rejected"
        ? "Recenzia ta nu respectă regulile noastre și nu a fost publicată. Contactează-ne dacă ai nevoie de clarificări."
        : "Verificăm recenzia ta. Va fi publicată în scurt timp."

  return (
    <div className="bg-brand-light rounded-3xl lg:rounded-[2rem] p-6 lg:p-10 flex flex-col gap-3 lg:gap-4">
      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-brand-accent/15 flex items-center justify-center text-brand-accent">
        {icon}
      </div>
      <h3 className="font-serif text-xl lg:text-2xl text-brand-dark">{title}</h3>
      <p className="text-sm text-brand-dark/60 leading-relaxed">{body}</p>
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
          Precedente
        </Link>
      )}
      <span className="px-4 py-2 text-sm text-brand-dark/60">
        Pagina {page} di {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={buildHref(page + 1)}
          className="px-4 py-2 rounded-full border border-brand-dark/10 hover:border-brand-accent text-sm transition-colors"
          scroll={false}
        >
          Successiva
        </Link>
      )}
    </nav>
  )
}

export default ProductReviews
