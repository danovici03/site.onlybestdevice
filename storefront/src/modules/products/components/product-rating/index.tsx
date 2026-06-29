import { Star, StarHalf } from "@phosphor-icons/react/dist/ssr"

type ProductRatingProps = {
  rating: number
  reviewCount?: number
  reviewLabel?: string
}

const ProductRating = ({
  rating,
  reviewCount,
  reviewLabel = "recensioni",
}: ProductRatingProps) => {
  const clamped = Math.max(0, Math.min(5, rating))
  const stars = Array.from({ length: 5 }, (_, i) => {
    const value = clamped - i
    if (value >= 0.75) return "full" as const
    if (value >= 0.25) return "half" as const
    return "empty" as const
  })

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className="flex items-center gap-0.5 text-brand-accent"
        aria-label={`Valutazione ${clamped.toFixed(1)} su 5`}
      >
        {stars.map((kind, i) =>
          kind === "full" ? (
            <Star key={i} size={16} weight="fill" />
          ) : kind === "half" ? (
            <StarHalf key={i} size={16} weight="fill" />
          ) : (
            <Star key={i} size={16} weight="regular" className="opacity-30" />
          )
        )}
      </div>
      <span className="font-bold text-brand-dark">{clamped.toFixed(1)}</span>
      {typeof reviewCount === "number" && reviewCount > 0 && (
        <>
          <span className="text-brand-dark/30">·</span>
          <span className="text-brand-dark/60">
            {reviewCount} {reviewLabel}
          </span>
        </>
      )}
    </div>
  )
}

export default ProductRating
