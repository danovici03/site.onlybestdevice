import { Star, SealCheck } from "@phosphor-icons/react/dist/ssr"
import type { ReviewDTO } from "@lib/data/reviews"

const Stars = ({ value }: { value: number }) => (
  <div
    className="flex items-center gap-0.5 text-brand-accent"
    aria-label={`${value} din 5 stele`}
  >
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={16}
        weight={i < value ? "fill" : "regular"}
        className={i < value ? "" : "opacity-25"}
      />
    ))}
  </div>
)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

const ReviewItem = ({ review }: { review: ReviewDTO }) => {
  return (
    <article className="py-6 border-b border-brand-dark/10 last:border-0">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        <span className="font-bold text-brand-dark">
          {review.customer_name}
        </span>
        <span className="text-sm text-brand-dark/50">
          {formatDate(review.created_at)}
        </span>
        {review.is_verified_purchase && (
          <span className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.15em] font-bold text-brand-accent bg-brand-accent/10 px-2 py-1 rounded-full">
            <SealCheck size={14} weight="fill" />
            Achiziție verificată
          </span>
        )}
      </header>

      <div className="flex items-center gap-3 mb-3">
        <Stars value={review.rating} />
        <span className="text-sm text-brand-dark/50">
          {review.rating}/5
        </span>
      </div>

      {review.title && (
        <h4 className="font-bold text-brand-dark mb-2">{review.title}</h4>
      )}

      <p className="text-brand-dark/80 leading-relaxed whitespace-pre-line">
        {review.body}
      </p>

      {review.admin_response && (
        <div className="mt-4 pl-4 border-l-2 border-brand-accent/40 bg-brand-accent/5 rounded-r-lg py-3 pr-4">
          <div className="text-xs uppercase tracking-[0.15em] font-bold text-brand-accent mb-1">
            Răspuns de la onlybestdevice
          </div>
          <p className="text-sm text-brand-dark/80 leading-relaxed whitespace-pre-line">
            {review.admin_response}
          </p>
        </div>
      )}
    </article>
  )
}

export default ReviewItem
